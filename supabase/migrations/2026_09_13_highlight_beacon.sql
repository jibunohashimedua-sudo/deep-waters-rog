-- ============================================================
-- Deep Waters — add Beacon as the sixth highlight colour
--
-- The palette had five sounding-instrument names — shoal, current, coral,
-- fathom, silt. Six is the size of set a reader can remember and use
-- without any two of them feeling redundant. Beacon is a pink / magenta
-- shoreline light: distinct from coral (red) even under the two common
-- forms of colour vision deficiency, because pink carries a blue channel
-- that red does not.
--
-- Existing highlights keep exactly the colour they have. This migration
-- only widens the allowed set — it never rewrites any row.
--
-- Same shape as 2026_09_07_highlight_colour_names.sql: find the CHECK
-- constraint on `colour` (whatever Postgres named it), drop it, put back
-- a version that adds 'beacon' to the list. Idempotent — re-runnable.
--
-- ------------------------------------------------------------
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Both this migration and the app code need to be in place before a
-- reader can pick Beacon; the deploy handles that. Safe to run in either
-- order — the widened rule still accepts the original five.
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'highlights'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%colour%'
  loop
    execute format('alter table public.highlights drop constraint %I', c.conname);
    raise notice 'dropped constraint %', c.conname;
  end loop;
end
$$;

alter table public.highlights
  add constraint highlights_colour_check
  check (colour in (
    'shoal', 'current', 'coral', 'beacon', 'fathom', 'silt'
  ));

-- Prove the rule now accepts Beacon and still rejects a name that was
-- never in the palette. Same pattern as 2026_09_07 part two: attempt a
-- row inside its own block, rely on the CHECK to raise, roll it back
-- either way.
do $$
declare
  beacon_ok boolean := false;
  unknown_rejected boolean := false;
begin
  begin
    insert into public.highlights
      (user_id, day_number, testament, book, chapter, verse_start, verse_end, colour)
    values
      ('00000000-0000-0000-0000-000000000000', 1, 'ot', 'Psalms', 42, 7, 7, 'beacon');
  exception
    -- The user_id doesn't exist, so the foreign-key trigger will trip
    -- after the CHECK — foreign_key_violation means the CHECK let it
    -- through, which is what we're testing.
    when foreign_key_violation then beacon_ok := true;
    when check_violation       then beacon_ok := false;
    when others                then beacon_ok := false;
  end;

  begin
    insert into public.highlights
      (user_id, day_number, testament, book, chapter, verse_start, verse_end, colour)
    values
      ('00000000-0000-0000-0000-000000000000', 1, 'ot', 'Psalms', 42, 7, 7, 'chartreuse');
  exception
    when check_violation       then unknown_rejected := true;
    when foreign_key_violation then unknown_rejected := false;
    when others                then unknown_rejected := false;
  end;

  if beacon_ok and unknown_rejected then
    raise notice 'Done. highlights.colour now accepts shoal, current, coral, beacon, fathom, silt — and nothing else.';
  else
    raise exception
      'Rule did not settle as expected (beacon_ok=%, unknown_rejected=%). Nothing left behind; re-run.',
      beacon_ok, unknown_rejected;
  end if;
end
$$;
