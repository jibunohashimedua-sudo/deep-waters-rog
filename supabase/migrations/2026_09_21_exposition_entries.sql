-- Deep Waters Elite — word_study_entries becomes exposition_entries.
--
-- The lens this table feeds was renamed from Word study to Exposition,
-- because "Word study" was also the name of the mode in the row above it
-- and one screen cannot hold one name for two kinds of control. The store
-- now carries the name the reader sees.
--
-- A rename and nothing else. No column changes, no data changes, no change
-- to who may read it. All 15,753 rows stay where they are — Postgres
-- renames in the catalogue, so this is instant however large the table is,
-- and the indexes are not rebuilt.
--
-- Dated 2026_09_21 so it sorts after 2026_09_20_sermon_blocks.sql.

-- The table.
alter table if exists public.word_study_entries
  rename to exposition_entries;

-- Everything hanging off it still carries the old name. Renaming these is
-- cosmetic — Postgres does not care — but a constraint that says
-- word_study in an error message about a table called exposition is a
-- puzzle set for whoever reads that message at two in the morning.
alter table public.exposition_entries
  rename constraint word_study_entries_pkey to exposition_entries_pkey;
alter table public.exposition_entries
  rename constraint word_study_entries_unique to exposition_entries_unique;

alter index if exists public.word_study_entries_ref_idx
  rename to exposition_entries_ref_idx;
alter index if exists public.word_study_entries_strongs_idx
  rename to exposition_entries_strongs_idx;

alter sequence if exists public.word_study_entries_id_seq
  rename to exposition_entries_id_seq;

-- The read policy. Dropped and recreated rather than renamed, so the name
-- and the table agree; the rule itself is copied across untouched —
-- readable by a signed-in reader, written by the service role only. A
-- rename is not the place to change who can see something.
drop policy if exists "word_study_entries_read" on public.exposition_entries;
create policy "exposition_entries_read" on public.exposition_entries
  for select to authenticated using (true);

-- Proof it landed: the row count should read 15753.
select count(*) as exposition_rows from public.exposition_entries;
