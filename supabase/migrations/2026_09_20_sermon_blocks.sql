-- ============================================================
-- Deep Waters — Sermon blocks: heading, scripture, note
--
-- The model was wrong. A sermon was one passage with blocks hung off it,
-- and the blocks came in two kinds — `verse` and `text`. But a sermon is
-- a title that gathers many scriptures, and `passage_ref` was only ever
-- the first passage anybody happened to send to it.
--
-- So the blocks become three kinds:
--
--     heading    a short line the preacher writes
--     scripture  a reference and the words behind it
--     note       free text
--
-- and `passage_ref` stays exactly where it is, demoted in meaning rather
-- than in schema: it is now the sermon's optional *main* text, and any
-- number of scripture blocks sit in the body beside it.
--
-- Nothing is dropped and nothing is added. This renames the `kind` on
-- blocks already written, in place:
--
--     verse  ->  scripture
--     text   ->  note
--
-- Every other field of every block — id, text, reference — is carried
-- through untouched, and a block with no `kind` at all becomes a note,
-- which is the only guess that cannot lose anything: a note renders its
-- text and nothing else.
--
-- The application reads both spellings either way (lib/sermons.ts,
-- normaliseKind), so this is safe to run before the deploy, after it, or
-- not at all — it only means an unmigrated row is translated on the way
-- out instead of being right in the database. Running it makes the rows
-- honest.
--
-- Idempotent: running it twice is a no-op, because after the first pass
-- there is no block left carrying an old name.
--
-- Dated 2026_09_20 so it sorts after 2026_09_19_close_anonymous_reads.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Count what is about to change, so running this by hand tells
--    you whether it found anything.
-- ------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n
  from public.sermons s
  where exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end
    ) as b
    where b->>'kind' in ('verse', 'text') or b->>'kind' is null
  );
  raise notice 'sermons with blocks to rename: %', n;
end $$;


-- ------------------------------------------------------------
-- 2. The rename.
--
-- jsonb_agg over jsonb_array_elements rebuilds each sermon's array with
-- the one key changed and every other key preserved, in order. The
-- `where` keeps it to rows that actually need it, so a second run does
-- nothing and an untouched sermon keeps its updated_at.
--
-- coalesce on the aggregate covers a sermon whose blocks array is empty:
-- jsonb_agg over no rows is null, and null would wipe the column.
-- ------------------------------------------------------------
update public.sermons s
set blocks = coalesce(
  (
    select jsonb_agg(
      b || jsonb_build_object(
        'kind',
        case b->>'kind'
          when 'verse'     then 'scripture'
          when 'text'      then 'note'
          when 'heading'   then 'heading'
          when 'scripture' then 'scripture'
          when 'note'      then 'note'
          else 'note'
        end
      )
      order by ord
    )
    from jsonb_array_elements(s.blocks) with ordinality as t(b, ord)
  ),
  '[]'::jsonb
)
where jsonb_typeof(s.blocks) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(s.blocks) as b
    where b->>'kind' is distinct from 'heading'
      and b->>'kind' is distinct from 'scripture'
      and b->>'kind' is distinct from 'note'
  );


-- ------------------------------------------------------------
-- 3. Say what the column means now, in the database, where the next
--    person to read the schema will find it.
-- ------------------------------------------------------------
comment on column public.sermons.passage_ref is
  'The sermon''s optional main text. Not its only passage — scripture blocks in `blocks` carry the rest.';

comment on column public.sermons.blocks is
  'Ordered array of {id, kind, text, reference?} where kind is heading | scripture | note. `reference` is set on scripture blocks.';


-- ------------------------------------------------------------
-- 4. Prove it. Every block should now carry one of the three names.
-- ------------------------------------------------------------
do $$
declare
  bad integer;
begin
  select count(*) into bad
  from public.sermons s,
       jsonb_array_elements(
         case when jsonb_typeof(s.blocks) = 'array' then s.blocks else '[]'::jsonb end
       ) as b
  where b->>'kind' not in ('heading', 'scripture', 'note');

  if bad > 0 then
    raise exception 'migration incomplete: % block(s) still carry an unknown kind', bad;
  end if;
  raise notice 'all sermon blocks now carry heading | scripture | note';
end $$;
