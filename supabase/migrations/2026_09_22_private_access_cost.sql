-- ============================================================
-- Deep Waters — Private access: one correctness fix, one cost fix
--
-- 2026_09_17_private_members.sql is right about what it wants and both
-- halves of it need a correction. This file makes no policy weaker. One
-- half makes the guarantee hold in a case where it did not; the other
-- makes it cost almost nothing.
--
-- ------------------------------------------------------------
-- §1  THE CORRECTNESS FIX — can_see_user() said yes to a stranger
-- ------------------------------------------------------------
-- The function reads:
--
--   select coalesce(
--     (select not p.is_private
--          or auth.uid() = p.id
--          or auth.uid() = coalesce(p.private_owner_id, <zero uuid>)
--      from public.profiles p where p.id = target),
--     true)
--
-- For a signed-in caller that is exactly right. For a caller with no
-- session it is not, and the reason is three-valued logic:
--
--   auth.uid() is NULL, so `auth.uid() = p.id` is NULL, not false.
--   For a private member: false OR NULL OR NULL  =  NULL.
--   The subquery returns one row whose value is NULL.
--   coalesce(NULL, true) = TRUE.
--
-- The `coalesce(…, true)` is there for "no profile row exists", which is
-- correct and must stay. It cannot tell that case apart from "the row
-- exists and the comparison was unknown", and so it answers **true** for
-- a private member seen by an anonymous caller.
--
-- Measured, not reasoned: on a local copy of this schema seeded to 500
-- members, with one member marked private —
--
--   himself                   can_see_user = true   feed 9   leaderboard 1
--   his owner                 can_see_user = true   feed 9   leaderboard 1
--   another ordinary member   can_see_user = false  feed 0   leaderboard 0
--   ANON, no session at all   can_see_user = TRUE   feed 9   leaderboard 1
--
-- And on production, with the anon key that ships in every client bundle:
--
--   GET /rest/v1/leaderboard?user_id=eq.<the private member>
--     -> 200, content-range 0-0/1
--
-- So the promise inverted. Every signed-in member of the church was
-- correctly blocked, and any stranger who read the anon key out of the
-- JavaScript could read the row. `community_feed`, `leaderboard`,
-- `cohort_members` and `cohort_summary` are all readable by `anon` —
-- `/c/[slug]` is a public page and needs them.
--
-- The fix is to compare NULL-safely, so an absent session matches nothing
-- rather than matching unknowably. `is not distinct from` is false when
-- one side is NULL and the other is not, which is the answer wanted here.
-- The coalesce around the private_owner_id is kept for the same reason it
-- was there before: NULL owner must not equal NULL caller.
--
-- Nothing changes for a signed-in caller. The only behaviour that changes
-- is that an anonymous reader now gets the same answer a member gets.
--
-- ------------------------------------------------------------
-- §2  THE COST FIX — 10.09 microseconds, 18,505 times
-- ------------------------------------------------------------
-- can_see_user() is `security definer`, and a security definer function is
-- never inlined by the planner. Every call is a full function call with
-- its own executor setup, and `auth.uid()` inside it parses JSON out of a
-- GUC each time.
--
-- Measured on the same 500-member copy (18,505 completions):
--
--   select count(*) from completions                          128.0 ms
--   … where can_see_user(user_id)                             314.8 ms   = 10.09 us per call
--   … where <predicate on the joined profiles row>            194.4 ms
--   … where <anti-join against private profiles>              127.1 ms   = free
--
-- The views pay this per candidate row, before any LIMIT:
--
--   community_feed, first 30 rows      213.9 ms  ->  70.3 ms without the filter  (+143.6 ms)
--   leaderboard, first 100 rows        184.9 ms  ->  42.0 ms without the filter  (+142.9 ms)
--
-- The filter is not the problem; calling it once per completion is. There
-- are 500 people and 18,505 completions, and the answer depends only on
-- the person. So the two hot views ask the question once per person, as a
-- NOT EXISTS against the private set, which Postgres hashes once and
-- anti-joins. `profiles_private_owner_idx` (partial, `where is_private`)
-- is exactly the index for it and already exists.
--
-- The predicate written inline below is the same boolean as the corrected
-- can_see_user(), by construction:
--
--   can_see_user(t)  ==  NOT ( t is private
--                              AND caller is not t
--                              AND caller is not t's owner )
--
-- and for a t with no profiles row the NOT EXISTS is true, which is what
-- the coalesce(…, true) meant.
--
-- The other six views that call can_see_user() are left calling it. Their
-- measured cost is small — finishers +3.8 ms, cohort_summary +3.0 ms —
-- because they ask once per person already, and they get the correctness
-- fix from §1 for nothing.
--
-- Additive and idempotent. No policy is dropped, no grant changes, and
-- every view keeps its exact column list so CREATE OR REPLACE applies.
-- ============================================================


-- ============================================================
-- 1. THE VISIBILITY FUNCTION, MADE NULL-SAFE
-- ============================================================
create or replace function public.can_see_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        not p.is_private
        -- is not distinct from, not =. With no session auth.uid() is NULL,
        -- and `NULL = p.id` is NULL, which coalesce(…, true) below then
        -- read as "yes, you may". This reads as "no, you are not him".
        or auth.uid() is not distinct from p.id
        or auth.uid() is not distinct from coalesce(p.private_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
      from public.profiles p
      where p.id = target
    ),
    -- Still true, and still deliberately: a row whose author has been
    -- deleted, or a nullable user column, is nobody's private business.
    true
  );
$$;

grant execute on function public.can_see_user(uuid) to anon, authenticated;


-- ============================================================
-- 2. THE COMMUNITY FEED — one question per person, not per reflection
-- ============================================================
create or replace view public.community_feed as
select
  c.id,
  c.user_id,
  c.day_number,
  c.verse_reference,
  c.verse_text,
  c.reflection,
  c.completed_at,
  p.display_name as name,
  p.photo_url,
  p.cohort_id,
  (select count(*) from public.reactions r where r.completion_id = c.id) as amen_count,
  (select count(*) from public.comments cm where cm.completion_id = c.id) as comment_count
from public.completions c
join public.profiles p on p.id = c.user_id
where c.reflection is not null and c.reflection <> ''
  and p.approved = true
  and coalesce(p.share_reading_activity, true) = true
  and not exists (
    select 1
    from public.profiles pv
    where pv.id = c.user_id
      and pv.is_private
      and pv.id is distinct from auth.uid()
      and coalesce(pv.private_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
          is distinct from auth.uid()
  )
order by c.completed_at desc;


-- ============================================================
-- 3. THE LEADERBOARD — the same, in both places it asks
-- ============================================================
create or replace view public.leaderboard as
with completed as (
  select user_id, day_number
  from public.completions
  where is_full = true
    -- Kept, though `totals` below already excludes him and this CTE only
    -- feeds a LEFT JOIN: defence in depth was the point of writing it
    -- twice, and in this shape it costs nothing to keep.
    and not exists (
      select 1 from public.profiles pv
      where pv.id = completions.user_id
        and pv.is_private
        and pv.id is distinct from auth.uid()
        and coalesce(pv.private_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
            is distinct from auth.uid()
    )
),
ordered as (
  select user_id, day_number,
         lag(day_number) over (partition by user_id order by day_number) as prev_day
  from completed
),
breaks as (
  select user_id, day_number,
         case when prev_day is null or day_number - prev_day > 2 then 1 else 0 end as is_break
  from ordered
),
grouped as (
  select user_id, day_number,
         sum(is_break) over (partition by user_id order by day_number) as streak_id
  from breaks
),
streak_lengths as (
  select user_id, streak_id, count(*) as len, max(day_number) as last_day
  from grouped group by user_id, streak_id
),
current_streak as (
  select distinct on (user_id) user_id, len as current_streak
  from streak_lengths order by user_id, last_day desc
),
totals as (
  select
    p.id as user_id,
    p.display_name as name,
    p.photo_url,
    p.cohort_id,
    p.start_date,
    (select count(*) from public.completions c where c.user_id = p.id and c.is_full = true) as days_completed,
    (select max(day_number) from public.completions c where c.user_id = p.id and c.is_full = true) as highest_day
  from public.profiles p
  where p.approved = true
    and coalesce(p.show_on_leaderboard, true) = true
    and not exists (
      select 1 from public.profiles pv
      where pv.id = p.id
        and pv.is_private
        and pv.id is distinct from auth.uid()
        and coalesce(pv.private_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
            is distinct from auth.uid()
    )
)
select
  t.user_id,
  t.name,
  t.photo_url,
  t.cohort_id,
  t.start_date,
  coalesce(t.days_completed, 0) as days_completed,
  t.highest_day,
  coalesce(cs.current_streak, 0) as current_streak
from totals t
left join current_streak cs on cs.user_id = t.user_id
order by t.days_completed desc, cs.current_streak desc nulls last;
