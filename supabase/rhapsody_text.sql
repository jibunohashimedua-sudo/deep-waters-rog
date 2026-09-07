-- ============================================================
-- Deep Waters: Rhapsody article text
--
-- Run this in the Supabase SQL Editor AFTER rhapsody.sql.
-- Safe to run twice.
--
-- Holds each day's article as text so it can be read on the page
-- itself, in the same serif as the scripture, instead of inside a
-- PDF viewer. The PDF stays where it is — it's still the source the
-- text is pulled from, and it's still there to open if anyone wants
-- the printed layout.
-- ============================================================

alter table public.rhapsody_days add column if not exists verse_text text;
alter table public.rhapsody_days add column if not exists body text;
alter table public.rhapsody_days add column if not exists prayer text;
alter table public.rhapsody_days add column if not exists prayer_label text;
