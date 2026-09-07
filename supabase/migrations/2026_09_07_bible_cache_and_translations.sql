-- ============================================================
-- Deep Waters — shared Bible cache + per-user translation choice
--
-- Two changes, both needed before the Bible tab and the translation
-- picker will work:
--
--   1. public.bible_cache        a shared store of chapter text, so
--                                free browsing doesn't hammer API.Bible
--   2. profiles.preferred_bible_id  which translation each person reads in
--
-- WHEN TO RUN THIS
-- Run it BEFORE deploying the build that adds the Bible tab. The app
-- still works if you run it after — it just falls back to calling
-- API.Bible every time and everyone reads the King James — but the
-- rate limit is the whole reason the cache exists, so run it first.
--
-- HOW TO RUN IT
-- Supabase dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. Once is enough. Safe to re-run: every statement is
-- idempotent, and re-running never discards cached chapters.
-- ============================================================


-- ---------- 1. SHARED CHAPTER CACHE ----------
-- Keyed by translation AND book AND chapter together. Keying on book and
-- chapter alone would serve somebody the wrong translation from cache the
-- moment two people read the same chapter in different ones.
--
-- This is public scripture text, not user data: one row serves everybody,
-- which is the point — the plan alone would warm most of it, and free
-- browsing then costs almost nothing.
create table if not exists public.bible_cache (
  bible_id    text not null,               -- API.Bible translation id
  book        text not null,               -- book abbreviation, e.g. GEN, 1CO
  chapter     int  not null check (chapter >= 1),
  reference   text not null,               -- display reference from API.Bible
  content     text not null,               -- chapter HTML as returned
  fetched_at  timestamptz not null default now(),
  primary key (bible_id, book, chapter)
);

-- Lets us find and clear stale rows without scanning the whole table.
create index if not exists bible_cache_fetched_idx
  on public.bible_cache(fetched_at);

alter table public.bible_cache enable row level security;

-- Everyone signed in may read the cache; nobody may write to it from the
-- browser. Writes happen server-side with the service role, so a member
-- can never poison scripture text for everybody else.
drop policy if exists "bible_cache_select_all" on public.bible_cache;
create policy "bible_cache_select_all" on public.bible_cache
  for select using (auth.role() = 'authenticated');


-- ---------- 2. PREFERRED TRANSLATION ----------
-- Lives on the profile rather than in the browser, so someone's choice
-- follows them from their phone to their laptop.
--
-- Defaults to the King James id the app has always used, so every existing
-- member carries on reading exactly what they read yesterday.
alter table public.profiles
  add column if not exists preferred_bible_id text
  not null default 'de4e12af7f28f599-02';

-- Backfill anyone whose column somehow landed null (belt and braces —
-- the NOT NULL default should make this a no-op).
update public.profiles
  set preferred_bible_id = 'de4e12af7f28f599-02'
  where preferred_bible_id is null;
