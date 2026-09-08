-- Deep Waters Elite — the gate, and the sermon desk.
--
-- Additive only. Nothing here drops, renames or re-declares an existing
-- table, view, policy or trigger.
--
-- Dated 2026_09_11 so it sorts after 2026_09_10_chapter_reads.sql, which is
-- the last migration already applied. Ordering matters more than the wall
-- clock here: this file has to run last.

-- ============================================================
-- 1. THE GATE
-- One flag on the profile, mirroring is_admin's shape: a plain boolean
-- with a default, read wherever the role is already read.
-- ============================================================
alter table public.profiles
  add column if not exists is_pastoral boolean not null default false;

-- Only an admin can grant it.
--
-- profiles_update_own_or_admin lets a member update their own row, which is
-- right for a name and a start date and wrong for this. PostgREST has no
-- column-level grant we can express through that policy, so the column is
-- guarded at the row instead: a non-admin's update simply carries the old
-- value forward. No error, no failed save of the fields they were actually
-- editing — the flag just doesn't move.
create or replace function public.guard_is_pastoral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_pastoral is distinct from old.is_pastoral and not public.is_admin() then
    new.is_pastoral := old.is_pastoral;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_is_pastoral_trigger on public.profiles;
create trigger guard_is_pastoral_trigger
  before update on public.profiles
  for each row execute function public.guard_is_pastoral();

-- ============================================================
-- 2. SERMONS
-- A sermon is a title, a passage, and an ordered list of blocks.
-- Private to its author, like verse_notes.
-- ============================================================
create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  passage_ref text,
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'preached', 'archived')),
  preached_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sermons_user_idx
  on public.sermons (user_id, updated_at desc);

create or replace function public.touch_sermons()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_sermons_trigger on public.sermons;
create trigger touch_sermons_trigger
  before update on public.sermons
  for each row execute function public.touch_sermons();

alter table public.sermons enable row level security;

-- Own rows only, all four verbs. Not readable by admins, not readable by
-- the community: a sermon in draft is somebody thinking out loud.
drop policy if exists "sermons_select_own" on public.sermons;
drop policy if exists "sermons_insert_own" on public.sermons;
drop policy if exists "sermons_update_own" on public.sermons;
drop policy if exists "sermons_delete_own" on public.sermons;

create policy "sermons_select_own" on public.sermons
  for select using (auth.uid() = user_id);
create policy "sermons_insert_own" on public.sermons
  for insert with check (auth.uid() = user_id);
create policy "sermons_update_own" on public.sermons
  for update using (auth.uid() = user_id);
create policy "sermons_delete_own" on public.sermons
  for delete using (auth.uid() = user_id);

-- Note on removing the flag: dropping is_pastoral from a user takes the
-- Elite surfaces away and leaves every row they wrote in place. Their verse
-- notes are ordinary verse notes, and their sermons sit here until they
-- delete them themselves.
