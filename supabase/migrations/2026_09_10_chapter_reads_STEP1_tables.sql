-- ============================================================
-- Deep Waters — chapter progress, STEP 1 of 2: the table and the column
--
-- WHY THIS FILE EXISTS
-- The original migration (2026_09_10_chapter_reads.sql) was run and none
-- of it applied. That is not a mistake at the keyboard — it is how the
-- Supabase SQL Editor works. It sends the whole file as one batch, and
-- Postgres wraps a batch in a single transaction, so if ANY statement
-- near the bottom fails, everything above it is rolled back too. The
-- table gets created and then un-created, and the editor shows one error
-- about the last statement.
--
-- So the file is split. This half has no view definitions in it, which
-- is where the failure is, and it is the half the app actually needs:
-- without it, marking a day complete and ticking a chapter both fail.
--
-- RUN THIS ONE FIRST. Supabase -> SQL Editor -> New query -> paste ->
-- Run. Every statement is idempotent; safe to re-run.
-- ============================================================

-- ---------- CHAPTER READS ----------
-- One row per (user, day, book, chapter) that the reader has ticked
-- as read. Auto-completes the day when the count matches the plan.
create table if not exists public.chapter_reads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  day_number  int  not null check (day_number between 1 and 90),
  book        text not null,
  chapter     int  not null check (chapter >= 1),
  read_at     timestamptz not null default now(),
  unique (user_id, day_number, book, chapter)
);

create index if not exists chapter_reads_user_day_idx
  on public.chapter_reads(user_id, day_number);

alter table public.chapter_reads enable row level security;

drop policy if exists "chapter_reads_select_own" on public.chapter_reads;
drop policy if exists "chapter_reads_insert_own" on public.chapter_reads;
drop policy if exists "chapter_reads_delete_own" on public.chapter_reads;

create policy "chapter_reads_select_own" on public.chapter_reads
  for select using (auth.uid() = user_id);
create policy "chapter_reads_insert_own" on public.chapter_reads
  for insert with check (auth.uid() = user_id);
create policy "chapter_reads_delete_own" on public.chapter_reads
  for delete using (auth.uid() = user_id);

-- ---------- COMPLETIONS · is_full flag ----------
-- A day counts as "full" when the reader has either ticked every
-- chapter for it, or written a reflection on it (the legacy shortcut
-- that pre-dates chapter ticks). Existing rows default to true — they
-- were treated as complete under the old model, and this keeps every
-- streak and badge intact through the migration.
alter table public.completions
