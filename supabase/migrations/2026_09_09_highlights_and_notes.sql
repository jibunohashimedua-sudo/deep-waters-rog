-- ============================================================
-- Deep Waters — highlights & verse notes
-- Adds two tables for per-user scripture highlighting and notes,
-- with strict RLS so both are private to the user who wrote them.
--
-- Run: paste the whole file into the Supabase SQL Editor and press
-- Run once. Safe to re-run — every statement is idempotent.
-- ============================================================

-- ---------- HIGHLIGHTS ----------
create table if not exists public.highlights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day_number   int  not null check (day_number between 1 and 90),
  testament    text not null check (testament in ('ot','nt')),
  book         text not null,
  chapter      int  not null check (chapter >= 1),
  verse_start  int  not null check (verse_start >= 1),
  verse_end    int  not null check (verse_end >= verse_start),
  colour       text not null check (colour in ('amber','mint','sky','rose','lavender')),
  created_at   timestamptz not null default now()
);

create index if not exists highlights_user_idx
  on public.highlights(user_id);

create index if not exists highlights_chapter_idx
  on public.highlights(user_id, book, chapter);

-- ---------- VERSE NOTES ----------
create table if not exists public.verse_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day_number   int  not null check (day_number between 1 and 90),
  testament    text not null check (testament in ('ot','nt')),
  book         text not null,
  chapter      int  not null check (chapter >= 1),
  verse_start  int  not null check (verse_start >= 1),
  verse_end    int  not null check (verse_end >= verse_start),
  verse_text   text,               -- snapshot of the selection at note time
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists verse_notes_user_idx
  on public.verse_notes(user_id, created_at desc);

create index if not exists verse_notes_chapter_idx
  on public.verse_notes(user_id, book, chapter);

-- Keep updated_at fresh on any edit.
create or replace function public.touch_verse_notes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_verse_notes_trigger on public.verse_notes;
create trigger touch_verse_notes_trigger
  before update on public.verse_notes
  for each row execute function public.touch_verse_notes();

-- ============================================================
-- ROW LEVEL SECURITY
-- Highlights and notes are private to the user who created them —
-- never surfaced to the community, never readable by other members.
-- ============================================================
alter table public.highlights  enable row level security;
alter table public.verse_notes enable row level security;

-- Drop and recreate policies so re-runs stay clean.
drop policy if exists "highlights_select_own" on public.highlights;
drop policy if exists "highlights_insert_own" on public.highlights;
drop policy if exists "highlights_update_own" on public.highlights;
drop policy if exists "highlights_delete_own" on public.highlights;

create policy "highlights_select_own" on public.highlights
  for select using (auth.uid() = user_id);
create policy "highlights_insert_own" on public.highlights
  for insert with check (auth.uid() = user_id);
create policy "highlights_update_own" on public.highlights
  for update using (auth.uid() = user_id);
create policy "highlights_delete_own" on public.highlights
  for delete using (auth.uid() = user_id);

drop policy if exists "verse_notes_select_own" on public.verse_notes;
drop policy if exists "verse_notes_insert_own" on public.verse_notes;
drop policy if exists "verse_notes_update_own" on public.verse_notes;
drop policy if exists "verse_notes_delete_own" on public.verse_notes;

create policy "verse_notes_select_own" on public.verse_notes
  for select using (auth.uid() = user_id);
create policy "verse_notes_insert_own" on public.verse_notes
  for insert with check (auth.uid() = user_id);
create policy "verse_notes_update_own" on public.verse_notes
  for update using (auth.uid() = user_id);
create policy "verse_notes_delete_own" on public.verse_notes
  for delete using (auth.uid() = user_id);
