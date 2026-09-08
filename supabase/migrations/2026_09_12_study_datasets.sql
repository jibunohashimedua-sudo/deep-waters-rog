-- Deep Waters Elite — the study datasets behind the Bench's lenses.
--
-- Additive only. Five new tables, nothing existing touched.
--
-- Every table is reference data: read-only to a signed-in reader, written
-- only by the import scripts in /scripts using the service-role key. There
-- are therefore SELECT policies and no INSERT/UPDATE/DELETE policies at
-- all — the service role bypasses RLS, and nobody else can write.
--
-- Dated 2026_09_12 so it sorts after 2026_09_11_elite_pastoral_and_sermons.

-- ============================================================
-- 1. STRONG'S ENTRIES — one row per Strong's number
-- ============================================================
create table if not exists public.strongs_entries (
  strongs_id text primary key,                    -- canonical: 'G25', 'H430'
  language text not null check (language in ('greek', 'hebrew')),
  lemma text,
  transliteration text,
  definition text,
  source text not null
);

-- No secondary index. Every read is `where strongs_id = $1` or
-- `where strongs_id in (...)`, which the primary key already serves.

-- ============================================================
-- 2. VERSE WORDS — the KJV, one row per tagged word per Strong's number
-- ============================================================
-- A <w> element in the KJV can carry more than one Strong's number
-- ("strong:H0853 strong:H01254"), so a word with two numbers is two rows
-- sharing a word_index. That is what lets the concordance find a verse by
-- either number while the Words lens still groups by the word as printed.
create table if not exists public.verse_words (
  id bigint generated always as identity primary key,
  book text not null,
  chapter int not null,
  verse int not null,
  word_index int not null,
  word_text text not null,
  strongs_id text not null,
  -- Canonical position of the book, 0–65. Stored because ordering by book
  -- *name* is alphabetical, and a concordance that lists Amos before Acts
  -- and takes the first fifty is not a concordance.
  book_index smallint not null,
  constraint verse_words_unique unique (book, chapter, verse, word_index, strongs_id)
);

-- The Words lens: `where book = $1 and chapter = $2 and verse = $3`.
-- Served by the leading columns of verse_words_unique, so no second index
-- is created for it — a redundant index on 367k rows is 30MB of nothing.

-- The Concordance: `where strongs_id = $1 order by book_index, chapter, verse`.
-- This index answers the filter and supplies the order, so the query never
-- sorts, and the count below is an index-only scan.
create index if not exists verse_words_strongs_idx
  on public.verse_words (strongs_id, book_index, chapter, verse);

-- ============================================================
-- 2b. KJV VERSE TEXT
-- ============================================================
-- Not in the original list of five, and added deliberately.
--
-- Two of the lenses are specified in terms of text they must show: the
-- concordance marks the word "in the returned text", and every cross
-- reference comes "with its verse text". Without the text to hand, each of
-- those rows would be a separate call to API.Bible — twelve round trips to
-- draw one pane. The KJV is public domain and it is already being parsed
-- for verse_words, so it is stored once, here, and both lenses read it.
create table if not exists public.kjv_verses (
  book text not null,
  chapter int not null,
  verse int not null,
  text text not null,
  book_index smallint not null,
  primary key (book, chapter, verse)
);

-- Every read is by exact reference, or by a handful of them at once. The
-- primary key answers both; no secondary index earns its keep.

-- ============================================================
-- 3. CROSS REFERENCES
-- ============================================================
create table if not exists public.cross_refs (
  id bigint generated always as identity primary key,
  book text not null,
  chapter int not null,
  verse int not null,
  -- How it reads: "Exodus 20:11", "Genesis 1:1-5".
  target_ref text not null,
  -- The same reference in parts, so the lens can fetch the target's text
  -- without parsing a display string back apart.
  target_book text not null,
  target_chapter int not null,
  target_verse_start int not null,
  target_verse_end int not null,
  votes int not null default 0,
  constraint cross_refs_unique unique (book, chapter, verse, target_ref)
);

-- The lens: `where book/chapter/verse order by votes desc limit 12`. The
-- unique constraint's leading columns answer the filter; votes is in this
-- index so the strongest references come back without a sort.
create index if not exists cross_refs_ref_votes_idx
  on public.cross_refs (book, chapter, verse, votes desc);

-- ============================================================
-- 4. COMMENTARY
-- ============================================================
-- Matthew Henry writes on passages, not verses: "Verses 1-21". verse_start
-- and verse_end hold that span, and the lens asks for the span that
-- contains the pinned verse.
create table if not exists public.commentary_entries (
  id bigint generated always as identity primary key,
  source text not null,
  book text not null,
  chapter int not null,
  verse_start int not null,
  verse_end int not null,
  body text not null,
  constraint commentary_entries_unique unique (source, book, chapter, verse_start, verse_end)
);

create index if not exists commentary_entries_ref_idx
  on public.commentary_entries (book, chapter);

-- ============================================================
-- 5. VINE'S
-- ============================================================
-- The table exists; it is empty on purpose. No edition of Vine's
-- Expository Dictionary could be found under a licence clean enough to
-- import, so the Vine's lens keeps its honest empty state rather than
-- being filled with a different dictionary wearing Vine's name.
create table if not exists public.vines_entries (
  id bigint generated always as identity primary key,
  word text not null,
  strongs_id text,
  body text not null,
  source text not null,
  constraint vines_entries_unique unique (word, strongs_id)
);

create index if not exists vines_entries_strongs_idx
  on public.vines_entries (strongs_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Reference data: any signed-in reader may read it, nobody may write it.
-- ============================================================
alter table public.strongs_entries    enable row level security;
alter table public.kjv_verses         enable row level security;
alter table public.verse_words        enable row level security;
alter table public.cross_refs         enable row level security;
alter table public.commentary_entries enable row level security;
alter table public.vines_entries      enable row level security;

drop policy if exists "strongs_entries_read"    on public.strongs_entries;
drop policy if exists "kjv_verses_read"         on public.kjv_verses;
drop policy if exists "verse_words_read"        on public.verse_words;
drop policy if exists "cross_refs_read"         on public.cross_refs;
drop policy if exists "commentary_entries_read" on public.commentary_entries;
drop policy if exists "vines_entries_read"      on public.vines_entries;

create policy "strongs_entries_read" on public.strongs_entries
  for select to authenticated using (true);
create policy "kjv_verses_read" on public.kjv_verses
  for select to authenticated using (true);
create policy "verse_words_read" on public.verse_words
  for select to authenticated using (true);
create policy "cross_refs_read" on public.cross_refs
  for select to authenticated using (true);
create policy "commentary_entries_read" on public.commentary_entries
  for select to authenticated using (true);
create policy "vines_entries_read" on public.vines_entries
  for select to authenticated using (true);
