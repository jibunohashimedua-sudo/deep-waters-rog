-- Deep Waters Elite — the Word study lens.
--
-- Replaces the Vine's lens, which never had anything in it. No edition of
-- Vine's Expository Dictionary could be found under a licence clean enough
-- to import, so rather than leave an empty tab wearing a name it cannot
-- honour, the lens is now Word study and carries work that is genuinely
-- public domain.
--
-- Dated 2026_09_13 so it sorts after 2026_09_12_study_datasets.

-- ============================================================
-- 1. WORD STUDY ENTRIES
-- ============================================================
-- One row per passage a commentator wrote on. Both sources comment on
-- ranges rather than single verses, so verse_start/verse_end hold the span
-- and the lens asks for the span containing the pinned verse — the same
-- shape commentary_entries already uses for Matthew Henry.
--
-- strongs_id is nullable and, for now, always null: Keil and Delitzsch key
-- their work to the verse, not to Strong's numbers. The column is here
-- because a source that does key to Strong's can be added without another
-- migration.
create table if not exists public.word_study_entries (
  id bigint generated always as identity primary key,
  -- 'keil_delitzsch' today. Named per row so an entry can always say which
  -- book it came out of, and so two sources can sit side by side.
  source text not null,
  book text not null,
  chapter int not null,
  verse_start int not null,
  verse_end int not null,
  strongs_id text,
  body text not null,
  constraint word_study_entries_unique
    unique (source, book, chapter, verse_start, verse_end)
);

-- The lens: `where book = $1 and chapter = $2 and verse_start <= $3 and
-- verse_end >= $3`. The leading two columns do the narrowing; the spans
-- within one chapter are few enough that filtering them is free.
create index if not exists word_study_entries_ref_idx
  on public.word_study_entries (book, chapter);

-- For a future source that keys to Strong's numbers. Partial, so it costs
-- nothing while every row's strongs_id is null.
create index if not exists word_study_entries_strongs_idx
  on public.word_study_entries (strongs_id)
  where strongs_id is not null;

alter table public.word_study_entries enable row level security;

drop policy if exists "word_study_entries_read" on public.word_study_entries;
create policy "word_study_entries_read" on public.word_study_entries
  for select to authenticated using (true);

-- ============================================================
-- 2. VINE'S GOES
-- ============================================================
-- It was created empty last time and stayed empty. The lens that would
-- have read it no longer exists, so neither should the table. Nothing is
-- lost: it never held a row.
drop table if exists public.vines_entries;

-- ============================================================
-- 3. HOW BIG IS THE DATABASE?
-- ============================================================
-- Printed here so the size before this import is on the record. Run the
-- same line again afterwards to see the size after.
select pg_size_pretty(pg_database_size(current_database())) as database_size;
