-- ============================================================
-- Deep Waters — highlight colours get their real names
--
-- The five highlights were named amber / mint / sky / rose / lavender when
-- they were marker pens. Under Fathom they are tinted grounds named for the
-- sounding instrument the mark comes from — Shoal, Current, Coral, Fathom,
-- Silt — and the database should say so too. "mint" in particular is now a
-- neutral grey, so the old name is not merely dated, it is wrong.
--
--   amber    -> shoal      sand over shallow water
--   sky      -> current    the blue of moving water
--   rose     -> coral
--   lavender -> fathom     the app's own violet
--   mint     -> silt       grey. Not green: green is sonar's alone.
--
-- ------------------------------------------------------------
-- HOW TO RUN THIS
--
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- It comes in two parts, and the order matters — not because either is
-- risky on its own, but because between them the app is being redeployed,
-- and for those few minutes some requests are served by the old build and
-- some by the new one.
--
--   PART ONE   Run it now, before the deploy lands. It widens the rule to
--              accept both the old names and the new ones, and renames any
--              rows that already exist. From this moment either build can
--              write a highlight and neither is rejected.
--
--   PART TWO   A separate file, run once the deploy is live and you have
--              made a highlight and seen it stick. It narrows the rule
--              back down to the five real names, so nothing can write an
--              old one again.
--
-- If you only ever run Part One, everything works — the column is just
-- looser than it needs to be. If you run Part Two too early, the old build
-- will fail to save a highlight until the deploy catches up. So: Part One
-- now, Part Two after.
--
-- Both parts are safe to re-run.
-- ============================================================


-- ============================================================
-- PART ONE — run now
-- ============================================================

-- The constraint has to come off before the rows can be renamed: the old
-- rule permits only the old five, so the very first UPDATE would trip it.
--
-- Dropped by lookup rather than by name. The original was written inline in
-- the CREATE TABLE, so Postgres named it — almost certainly
-- highlights_colour_check, but "almost certainly" is not something to hang
-- a migration on. This finds every check constraint on the table that
-- mentions the colour column and removes it, whatever it ended up called.
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

-- Both vocabularies, for as long as two builds are in the air.
alter table public.highlights
  add constraint highlights_colour_check
  check (colour in (
    'shoal', 'current', 'coral', 'fathom', 'silt',   -- the real names
    'amber', 'sky', 'rose', 'lavender', 'mint'       -- retired, still accepted
  ));

-- Rename what is already there. At the time of writing this table is empty,
-- so this is a no-op on production — but it is what makes the migration
-- correct on any other copy of the database, and on this one if somebody
-- highlights something between now and when you run it.
update public.highlights set colour = 'shoal'   where colour = 'amber';
update public.highlights set colour = 'current' where colour = 'sky';
update public.highlights set colour = 'coral'   where colour = 'rose';
update public.highlights set colour = 'fathom'  where colour = 'lavender';
update public.highlights set colour = 'silt'    where colour = 'mint';

-- Say what is left, so you can see it worked rather than trusting it did.
do $$
declare
  stale int;
begin
  select count(*) into stale
  from public.highlights
  where colour in ('amber', 'sky', 'rose', 'lavender', 'mint');

  raise notice 'highlights still carrying a retired colour name: %', stale;
end
$$;


-- ============================================================
-- PART TWO lives in its own file:
--   2026_09_07_highlight_colour_names_part_two.sql
--
-- It used to be at the bottom of this one, commented out, waiting to be
-- uncommented. That was a bad way to ship it: a block of SQL that is
-- entirely comments runs perfectly happily and reports "Success, no rows
-- returned", so running it without uncommenting looks exactly like running
-- it properly. Part two is now a file you paste and run whole, and it
-- checks its own work before it says it is done.
-- ============================================================
