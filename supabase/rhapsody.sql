-- ============================================================
-- Deep Waters: Rhapsody of Realities (private, members only)
--
-- Run this ONCE in the Supabase SQL Editor, before the new
-- Rhapsody pages go live. It is safe to run again — every
-- statement checks for what it creates first.
--
-- What it makes:
--   1. A PRIVATE storage bucket `rhapsody` for the monthly PDFs.
--      Nothing in it is reachable by URL. Files are handed out
--      only as short-lived signed links, made on the server for
--      a signed-in member.
--   2. `rhapsody_editions` — one row per monthly PDF.
--   3. `rhapsody_days`     — one row per calendar date, pointing
--      at the article for that day and its page in the PDF.
--   4. Row-level security matching `study_notes`: members read,
--      admins write. Signed-out visitors get nothing at all.
-- ============================================================

-- ---------- BUCKET (private) ----------
insert into storage.buckets (id, name, public)
  values ('rhapsody', 'rhapsody', false)
  on conflict (id) do update set public = false;

-- ---------- EDITIONS (one PDF per month) ----------
create table if not exists public.rhapsody_editions (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,          -- always the 1st of the month
  title text not null,                 -- e.g. 'September 2026'
  file_path text not null,             -- path inside the private bucket
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- DAYS (one article per calendar date) ----------
create table if not exists public.rhapsody_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  edition_id uuid not null references public.rhapsody_editions(id) on delete cascade,
  title text,
  page_number int not null default 1 check (page_number >= 1),
  created_at timestamptz default now()
);
create index if not exists rhapsody_days_edition_idx on public.rhapsody_days(edition_id);
create index if not exists rhapsody_days_date_idx on public.rhapsody_days(date);

-- ---------- ROW LEVEL SECURITY ----------
alter table public.rhapsody_editions enable row level security;
alter table public.rhapsody_days enable row level security;

-- Read: any signed-in member. `auth.uid() is not null` is the whole
-- guard — a signed-out request has no uid, so it sees nothing.
drop policy if exists "rhapsody_editions_read" on public.rhapsody_editions;
create policy "rhapsody_editions_read" on public.rhapsody_editions for select
  using (auth.uid() is not null);

drop policy if exists "rhapsody_editions_write_admin" on public.rhapsody_editions;
create policy "rhapsody_editions_write_admin" on public.rhapsody_editions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rhapsody_days_read" on public.rhapsody_days;
create policy "rhapsody_days_read" on public.rhapsody_days for select
  using (auth.uid() is not null);

drop policy if exists "rhapsody_days_write_admin" on public.rhapsody_days;
create policy "rhapsody_days_write_admin" on public.rhapsody_days for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- STORAGE POLICIES ----------
-- Admins upload, replace and delete the PDFs straight from the
-- admin page. There is deliberately NO read policy here: members
-- never touch the bucket. The reader page asks the server for a
-- signed link instead, and the server checks they're signed in
-- before it makes one.
drop policy if exists "rhapsody admin manage" on storage.objects;
create policy "rhapsody admin manage" on storage.objects for all
  using (bucket_id = 'rhapsody' and public.is_admin())
  with check (bucket_id = 'rhapsody' and public.is_admin());
