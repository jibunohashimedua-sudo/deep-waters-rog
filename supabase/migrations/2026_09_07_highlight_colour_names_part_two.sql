-- ============================================================
-- Deep Waters — highlight colours, part two of two
--
-- Part one (2026_09_07_highlight_colour_names.sql) widened the rule on
-- highlights.colour so it accepted both the retired names and the real
-- ones, and renamed any rows that existed. That was so the database and
-- the deploy could change over without a moment where either build's
-- writes were refused.
--
-- This narrows it back down. Afterwards the column accepts exactly:
--
--     shoal   current   coral   fathom   silt
--
-- and nothing else — no amber, no mint.
--
-- ------------------------------------------------------------
-- HOW TO RUN THIS
--
-- Supabase dashboard -> SQL Editor -> New query -> paste the whole file
-- -> Run. There is nothing to uncomment and nothing to leave out.
--
-- Run it only once the new build is live. It is safe to re-run.
--
-- It checks its own work: if it finishes without raising, the rule really
-- did narrow. It cannot report success and have done nothing.
-- ============================================================


-- ---------- 1. Refuse to narrow over rows that would break ----------
-- If any row still carries a retired name, adding the narrow constraint
-- would fail anyway — but it would fail with Postgres's own message about
-- a constraint violation, which doesn't tell you what to do about it.
do $$
declare
  stale int;
begin
  select count(*) into stale
  from public.highlights
  where colour in ('amber', 'sky', 'rose', 'lavender', 'mint');

  if stale > 0 then
    raise exception
      'Stopping: % highlight(s) still carry a retired colour name. Run part one again first, then this.', stale;
  end if;
end
$$;


-- ---------- 2. Narrow the rule ----------
alter table public.highlights
  drop constraint if exists highlights_colour_check;

alter table public.highlights
  add constraint highlights_colour_check
  check (colour in ('shoal', 'current', 'coral', 'fathom', 'silt'));


-- ---------- 3. Prove it, rather than assume it ----------
-- Try to insert a retired colour and confirm the rule throws it out.
--
-- The row could never be written in any case: the user id is all zeros and
-- there is no such profile, so the foreign key stops it even if the colour
-- gets through. Which of the two errors comes back is exactly the test —
-- Postgres evaluates a CHECK during the insert and fires foreign-key
-- triggers after it, so:
--
--     check violation  -> the rule is narrow. Good.
--     anything else    -> the colour was allowed through. Not narrow.
--
-- The whole attempt is inside its own block, so it rolls back either way
-- and nothing is left behind.
do $$
declare
  narrowed boolean := false;
begin
  begin
    insert into public.highlights
      (user_id, day_number, testament, book, chapter, verse_start, verse_end, colour)
    values
      ('00000000-0000-0000-0000-000000000000', 1, 'ot', 'Psalms', 42, 7, 7, 'amber');
  exception
    when check_violation then narrowed := true;
    when others          then narrowed := false;
  end;

  if narrowed then
    raise notice 'Done. highlights.colour now accepts shoal, current, coral, fathom, silt — and nothing else.';
  else
    raise exception
      'The rule did not narrow: a retired colour name is still being accepted. Nothing has been left half-done; run this file again.';
  end if;
end
$$;
