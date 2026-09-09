-- ============================================================
-- Deep Waters Elite — the sermon list stops carrying every block
--
-- ELITE_EXCELLENCE_AUDIT P1-B. /sermons was doing `select("*")` over up
-- to 200 rows and then parsing each row's full `blocks` jsonb in order to
-- print one number: how many blocks are in it. The list renders no block
-- text at all, so every byte of every sermon body was travelling for a
-- count.
--
-- PostgREST has no way to ask for a computed expression in `select=`, so
-- the count has to exist as a column. A stored generated column is the
-- smallest thing that can be: it is part of the table, so it inherits the
-- table's own RLS unchanged, needs no grant of its own, no view, and no
-- function.
--
-- This is the one schema addition in the excellence pass. It adds a
-- column. It does not touch a policy, a view, a trigger or a constraint.
--
-- Dated 2026_09_15 so it sorts after 2026_09_14_church_pulse.sql.
--
-- Run: paste into the Supabase SQL editor and press Run once. Safe to
-- re-run. Run it BEFORE deploying — until it exists the list falls back
-- to rendering without the count rather than failing, but the count is
-- the point.
-- ============================================================

-- `jsonb_typeof` guards the cast: `blocks` is jsonb, and jsonb_array_length
-- raises on anything that is not an array. The column default is '[]' and
-- the API only ever writes an array (capBlocks in lib/limits.ts returns
-- one), but a generated column that can raise would make the row
-- unwritable rather than merely wrong, and that is not a trade worth
-- making for a count. Both functions are immutable, which is what a
-- STORED generated column requires.
alter table public.sermons
  add column if not exists block_count int
  generated always as (
    case
      when jsonb_typeof(blocks) = 'array' then jsonb_array_length(blocks)
      else 0
    end
  ) stored;

comment on column public.sermons.block_count is
  'How many blocks are in `blocks`. Generated, so /sermons can list a '
  'sermon without transferring its body. Never written by hand.';
