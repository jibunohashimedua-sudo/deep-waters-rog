-- ============================================================
-- Deep Waters — Nicknames and preferences
--
-- Two things, and they share a table.
--
--   §1  A nickname. The name a member is known by, which is often not
--       the name on their account. It replaces the account name
--       everywhere members see each other, and never replaces it
--       anywhere an admin or a pastor is looking.
--
--   §2  Preferences. How the app looks and behaves for one person,
--       stored against them rather than in a browser, so it follows
--       them between devices.
--
-- Additive and idempotent: safe to run twice, and safe to run before the
-- code that uses it deploys. Every column has a default that is the
-- behaviour the app already had, so a profile nobody touches keeps
-- working exactly as it does today.
--
-- Dated 2026_09_18 so it sorts after 2026_09_17_private_members.sql.
-- ============================================================


-- ============================================================
-- 1. THE NICKNAME
-- ============================================================

alter table public.profiles
  add column if not exists nickname text;

-- The database's own backstop. The real rules — length, impersonation,
-- profanity, hidden characters — live in lib/nickname.ts, because they
-- have to give a person a sentence explaining what to change. This is
-- only here so a stray write from anywhere else cannot put a line break
-- or a novel into a name that renders in fifty lists.
alter table public.profiles
  drop constraint if exists profiles_nickname_shape;
alter table public.profiles
  add constraint profiles_nickname_shape check (
    nickname is null
    or (
      length(nickname) between 2 and 24
      and nickname !~ '[\r\n\t]'
      and btrim(nickname) = nickname
    )
  );

-- What every member-facing surface shows.
--
-- Generated rather than written by the application, which is the whole
-- point: there is no code path that can leave it blank, no list that can
-- forget to fall back, and no second place for the rule to drift to. An
-- empty nickname is the same as no nickname.
alter table public.profiles
  drop column if exists display_name;
alter table public.profiles
  add column display_name text
  generated always as (coalesce(nullif(btrim(nickname), ''), name)) stored;


-- ============================================================
-- 2. THE PREFERENCES
--
-- Reading, appearance, community, notifications. The three reminder
-- columns already existed and are left alone; everything else is new,
-- and every default is what the app does today.
-- ============================================================

alter table public.profiles
  -- Reading
  add column if not exists book_layout text not null default 'list',
  add column if not exists verse_numbers boolean not null default true,
  add column if not exists text_size text not null default 'medium',
  add column if not exists reading_font text not null default 'serif',
  add column if not exists line_spacing text not null default 'normal',
  -- Appearance
  add column if not exists theme text not null default 'system',
  -- Community
  add column if not exists show_on_leaderboard boolean not null default true,
  add column if not exists share_reading_activity boolean not null default true,
  -- The one-time pointer at this screen, for members who were already
  -- here before it existed. Set once, never shown again.
  add column if not exists prefs_intro_seen boolean not null default false;

-- Each of these is a closed set. A check constraint rather than an enum
-- so a later value is one line here instead of a type migration.
do $$
begin
  alter table public.profiles drop constraint if exists profiles_book_layout_check;
  alter table public.profiles add constraint profiles_book_layout_check
    check (book_layout in ('list', 'grouped'));

  alter table public.profiles drop constraint if exists profiles_text_size_check;
  alter table public.profiles add constraint profiles_text_size_check
    check (text_size in ('small', 'medium', 'large', 'xlarge'));

  alter table public.profiles drop constraint if exists profiles_reading_font_check;
  alter table public.profiles add constraint profiles_reading_font_check
    check (reading_font in ('serif', 'sans'));

  alter table public.profiles drop constraint if exists profiles_line_spacing_check;
  alter table public.profiles add constraint profiles_line_spacing_check
    check (line_spacing in ('tight', 'normal', 'relaxed'));

  alter table public.profiles drop constraint if exists profiles_theme_check;
  alter table public.profiles add constraint profiles_theme_check
    check (theme in ('system', 'light', 'dark'));
end $$;


-- ============================================================
-- 3. THE VIEWS
--
-- Every member-facing view now reports display_name in the `name`
-- column it already had. That is deliberate: the components reading
-- these views need no change, and a list cannot end up showing the
-- account name because somebody forgot to update it.
--
-- The admin and pastoral views do the opposite — see §4.
--
-- Each view is re-declared in full, keeping the can_see_user() filter
-- from 2026_09_17_private_members.sql. Dropping first because changing a
-- column's source is not something CREATE OR REPLACE VIEW will do.
-- ============================================================

-- ---------- Leaderboard ----------
-- Also honours show_on_leaderboard: someone who would rather not be
-- ranked simply isn't in it. They keep their streak, their badges and
-- their place in every other part of the app; they are only absent from
-- the table of who has read the most, which is the one screen in here
-- that invites comparison.
drop view if exists public.leaderboard;
create view public.leaderboard as
with completed as (
  select user_id, day_number
  from public.completions
  where is_full = true
    and public.can_see_user(user_id)
),
ordered as (
  select
    user_id,
    day_number,
    lag(day_number) over (partition by user_id order by day_number) as prev_day
  from completed
),
breaks as (
  select
    user_id,
    day_number,
    case when prev_day is null or day_number - prev_day > 2 then 1 else 0 end as is_break
  from ordered
),
grouped as (
  select
    user_id,
    day_number,
    sum(is_break) over (partition by user_id order by day_number) as streak_id
  from breaks
),
streak_lengths as (
  select user_id, streak_id, count(*) as len, max(day_number) as last_day
  from grouped
  group by user_id, streak_id
),
current_streak as (
  select distinct on (user_id) user_id, len as current_streak
  from streak_lengths
  order by user_id, last_day desc
),
totals as (
  select
    p.id as user_id,
    p.display_name as name,
    p.photo_url,
    p.cohort_id,
    p.start_date,
    (select count(*) from public.completions c
       where c.user_id = p.id and c.is_full = true) as days_completed,
    (select max(day_number) from public.completions c
       where c.user_id = p.id and c.is_full = true) as highest_day
  from public.profiles p
  where p.approved = true
    and coalesce(p.show_on_leaderboard, true) = true
    and public.can_see_user(p.id)
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

-- ---------- Community feed ----------
-- Also honours share_reading_activity. Turning it off takes a member's
-- completed days and the reflections attached to them out of the feed.
-- It does not delete anything: their reflection is still theirs, still
-- on their day, still in Depth. It just stops being broadcast.
drop view if exists public.community_feed;
create view public.community_feed as
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
  and public.can_see_user(c.user_id)
order by c.completed_at desc;

-- ---------- Finishers ----------
-- No preference gate here. Finishing ninety days is a fact about a
-- person's year, the wall is the church's memory of it, and quietly
-- dropping people out of it would make the wall a lie. Somebody who
-- wants out of everything has is_private for that.
drop view if exists public.finishers;
create view public.finishers as
select
  p.id,
  p.display_name as name,
  p.photo_url,
  p.cohort_id,
  max(c.completed_at) as finished_at
from public.profiles p
join public.completions c on c.user_id = p.id
where p.approved = true
  and c.is_full = true
  and public.can_see_user(p.id)
group by p.id
having count(distinct c.day_number) >= 90
order by finished_at asc;


-- ============================================================
-- 4. WHAT THE PASTORS SEE
--
-- The opposite rule. Church Pulse exists so somebody can notice that a
-- real person has gone quiet and ring them, and "Tobi has not read for
-- eleven days" is no use if the church directory says Oluwatobiloba.
--
-- So the pastoral view keeps `name` as the account name and carries the
-- nickname alongside it. Never instead of it.
-- ============================================================

drop view if exists public.pulse_member_activity;
create view public.pulse_member_activity as
select
  p.id          as user_id,
  p.name,
  p.nickname,
  p.display_name,
  p.photo_url,
  p.start_date,
  p.created_at,
  p.cohort_id,
  greatest(comp.last_at, chap.last_at)                                  as last_read_at,
  greatest(comp.last_at, chap.last_at, cmt.last_at, rct.last_at, pry.last_at)
                                                                        as last_activity_at
from public.profiles p
left join (
  select user_id, max(completed_at) as last_at from public.completions group by user_id
) comp on comp.user_id = p.id
left join (
  select user_id, max(read_at) as last_at from public.chapter_reads group by user_id
) chap on chap.user_id = p.id
left join (
  select user_id, max(created_at) as last_at from public.comments group by user_id
) cmt on cmt.user_id = p.id
left join (
  select user_id, max(created_at) as last_at from public.reactions group by user_id
) rct on rct.user_id = p.id
left join (
  select user_id, max(created_at) as last_at from public.prayer_requests group by user_id
) pry on pry.user_id = p.id
where public.can_see_user(p.id);

revoke all on public.pulse_member_activity from anon, authenticated;


-- ============================================================
-- 5. TWO PEOPLE, ONE NICKNAME
--
-- Nicknames are not unique, and should not be: two Graces in a church is
-- normal and neither of them should have to be Grace2. But a pastor
-- following up "Grace has gone quiet" needs to know there are two.
--
-- This reports, per cohort, every display name worn by more than one
-- person, with who they actually are. Admin and pastoral only.
-- ============================================================

drop view if exists public.cohort_name_clashes;
create view public.cohort_name_clashes as
select
  p.cohort_id,
  p.display_name,
  count(*) over (partition by p.cohort_id, lower(p.display_name)) as sharing,
  p.id as user_id,
  p.name as account_name,
  p.nickname,
  p.photo_url
from public.profiles p
where p.approved = true
  and p.cohort_id is not null
  and public.can_see_user(p.id);

revoke all on public.cohort_name_clashes from anon, authenticated;

-- Same answer, reachable by an admin through PostgREST. Security definer
-- so it can read past RLS, and gated on is_admin() so only an admin can.
create or replace function public.name_clashes_in_cohort(target_cohort uuid)
returns table (
  user_id uuid,
  account_name text,
  nickname text,
  display_name text,
  sharing bigint
)
language sql
security definer
set search_path = public
as $$
  select c.user_id, c.account_name, c.nickname, c.display_name, c.sharing
  from public.cohort_name_clashes c
  where c.cohort_id = target_cohort
    and c.sharing > 1
    and public.is_admin()
  order by lower(c.display_name), c.account_name;
$$;

revoke all on function public.name_clashes_in_cohort(uuid) from public, anon;
grant execute on function public.name_clashes_in_cohort(uuid) to authenticated;


-- ============================================================
-- 6. WHO MAY WRITE WHAT
--
-- The existing guard trigger stops a member granting themselves pastoral
-- access or private status. Role is added to it here: a nickname screen
-- that can write to profiles must not be a way to become an admin.
-- ============================================================

create or replace function public.guard_is_pastoral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seeding boolean := coalesce(current_setting('dw.private_seed', true), 'off') = 'on';
begin
  if new.is_pastoral is distinct from old.is_pastoral and not public.is_admin() then
    new.is_pastoral := old.is_pastoral;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;

  if new.approved is distinct from old.approved and not public.is_admin() then
    new.approved := old.approved;
  end if;

  if new.is_private is distinct from old.is_private and not seeding then
    new.is_private := old.is_private;
  end if;

  if new.private_owner_id is distinct from old.private_owner_id and not seeding then
    new.private_owner_id := old.private_owner_id;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_is_pastoral_trigger on public.profiles;
create trigger guard_is_pastoral_trigger
  before update on public.profiles
  for each row execute function public.guard_is_pastoral();
