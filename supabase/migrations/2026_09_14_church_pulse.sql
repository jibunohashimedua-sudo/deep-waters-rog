-- ============================================================
-- Deep Waters — Church Pulse
--
-- The pastoral care screen. One page that answers "who is being carried
-- and who has gone quiet", and a care log so two people don't ring the
-- same person.
--
-- Additive only. Nothing here drops, renames or re-declares an existing
-- table, view, policy or trigger. The one existing object touched is
-- public.prayer_requests, which gains a nullable-by-default boolean.
--
-- Dated 2026_09_14 so it sorts after 2026_09_13_word_study.sql, the last
-- migration already applied. Ordering matters more than the wall clock:
-- this file has to run last.
--
-- Run: paste into the Supabase SQL editor and press Run once. Safe to
-- re-run — everything here is idempotent.
-- ============================================================


-- ============================================================
-- 1. THE GATE, IN SQL
--
-- lib/auth.ts reads profiles.is_pastoral for the route. The database has
-- to answer the same question for itself, because every read on this page
-- crosses other people's rows and RLS has to be the thing that stops a
-- member reaching them — not the absence of a link in a menu.
--
-- Shaped exactly like public.is_admin(): stable, security definer, one
-- lookup against profiles.
-- ============================================================
create or replace function public.is_pastoral_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_pastoral from public.profiles p where p.id = auth.uid()),
    false
  );
$$;


-- ============================================================
-- 2. THE CARE LOG
--
-- What was done about a person, by whom, and when. Two kinds: a bare
-- "reached out" tick, and a note with a body.
--
-- Readable and writable by pastoral users only. Never by the member it
-- concerns — including when that member is themselves pastoral, which is
-- why the select policy carries `subject_user_id <> auth.uid()` rather
-- than resting on the flag alone. Never by other cohort members. Not by
-- admins either: running the app and carrying people are different jobs,
-- and only one of them needs this.
-- ============================================================
create table if not exists public.care_log (
  id              uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles(id) on delete cascade,
  author_user_id  uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('reached_out', 'note')),
  body            text,
  created_at      timestamptz not null default now()
);

-- The log is always read for one person, newest first. That is the index.
create index if not exists care_log_subject_idx
  on public.care_log (subject_user_id, created_at desc);

alter table public.care_log enable row level security;

drop policy if exists "care_log_select_pastoral" on public.care_log;
drop policy if exists "care_log_insert_pastoral" on public.care_log;
drop policy if exists "care_log_update_own"      on public.care_log;
drop policy if exists "care_log_delete_own"      on public.care_log;

create policy "care_log_select_pastoral" on public.care_log
  for select using (
    public.is_pastoral_user() and subject_user_id <> auth.uid()
  );

create policy "care_log_insert_pastoral" on public.care_log
  for insert with check (
    public.is_pastoral_user()
    and auth.uid() = author_user_id
    and subject_user_id <> auth.uid()
  );

-- A correction to your own entry, and a way to withdraw it. Someone
-- else's entry is theirs.
create policy "care_log_update_own" on public.care_log
  for update using (public.is_pastoral_user() and auth.uid() = author_user_id);

create policy "care_log_delete_own" on public.care_log
  for delete using (public.is_pastoral_user() and auth.uid() = author_user_id);


-- ============================================================
-- 3. A PRAYER CAN ASK FOR A PASTOR
--
-- The pulse shows two kinds of waiting prayer: one nobody has responded
-- to, and one whose author asked for a pastor. The second needed a flag;
-- there wasn't one. Default false, so every prayer already on the wall
-- reads exactly as it did before.
-- ============================================================
alter table public.prayer_requests
  add column if not exists needs_pastor boolean not null default false;


-- ============================================================
-- 4. INDEXES FOR THE QUIET CALCULATION
--
-- "Quiet" is days since a person's last recorded activity of ANY kind —
-- a completed day, a chapter read, a reflection, a comment, an amen, a
-- prayer post. Not just plan completions: someone reading their Bible
-- daily outside the plan would otherwise be flagged as silent, which is
-- the exact opposite of the truth.
--
-- That means five max(timestamp) group-by-user scans. Each of these five
-- tables already has an index, and not one of them helps here:
--
--   completions      completions_user_idx (user_id)        — no timestamp
--   chapter_reads    chapter_reads_user_day_idx (user_id, day_number)
--   comments         comments_completion_idx (completion_id, created_at)
--   reactions        primary key (completion_id, user_id)  — wrong leading col
--   prayer_requests  prayer_created_idx (created_at desc)  — no user
--
-- Each index below is (user_id, <timestamp> desc), which is what a
-- per-user max of that timestamp actually reads.
-- ============================================================
create index if not exists completions_user_completed_idx
  on public.completions (user_id, completed_at desc);

create index if not exists chapter_reads_user_read_at_idx
  on public.chapter_reads (user_id, read_at desc);

create index if not exists comments_user_created_idx
  on public.comments (user_id, created_at desc);

create index if not exists reactions_user_created_idx
  on public.reactions (user_id, created_at desc);

create index if not exists prayer_requests_user_created_idx
  on public.prayer_requests (user_id, created_at desc);


-- ============================================================
-- 5. LAST ACTIVITY PER MEMBER
--
-- Two timestamps per person and nothing else. No reflection text, no
-- note text, no prayer body — this view cannot leak content because it
-- carries none.
--
--   last_read_at      the last time they read: a completed day or a
--                     ticked chapter. This is what "last read" means in
--                     the person sheet, and what "reading today" counts.
--   last_activity_at  the last sign of life of any kind. This is what
--                     "quiet" is measured from.
--
-- GREATEST ignores NULLs in Postgres and returns NULL only when every
-- argument is NULL, which is precisely "never did anything".
--
-- Grants are revoked below. Nothing reads this view except the security
-- definer functions in §6, which run as its owner. It exists so those
-- functions share one definition of activity rather than five copies of
-- the same five joins.
-- ============================================================
create or replace view public.pulse_member_activity as
select
  p.id          as user_id,
  p.name,
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
) pry on pry.user_id = p.id;

revoke all on public.pulse_member_activity from anon, authenticated;


-- ============================================================
-- 6. THE PAGE'S QUERIES
--
-- Every one of these is security definer and opens with the same guard:
-- a caller without the flag gets zero rows. Not an error — the same
-- silence the route keeps. RLS on care_log is the hard edge; this is the
-- soft one in front of it.
--
-- p_today is passed in rather than read from current_date because the
-- app knows the viewer's timezone (the dw_tz cookie, lib/serverToday.ts)
-- and the database does not.
--
-- p_quiet_days is passed in from QUIET_DAYS in lib/pulse.ts, so the
-- threshold has one home on each side of the wire.
-- ============================================================

-- ---------- 6a. The four numbers ----------
--
-- reading_today    read something today: a completed day or a ticked chapter
-- on_track         missed at most one of their last seven plan days —
--                  the same one-day grace the streak already allows
--                  (leaderboard breaks a run on a gap of more than 2)
-- quiet            no activity of any kind for p_quiet_days or more
-- new_testimonies  testimonies written in the last seven days
--
-- Only `quiet` is a call to action. The UI gives that one the amber.
create or replace function public.pulse_numbers(
  p_today      date default current_date,
  p_quiet_days int  default 5
)
returns table (
  reading_today   int,
  on_track        int,
  quiet           int,
  new_testimonies int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  with act as (
    select * from public.pulse_member_activity
  ),
  reading as (
    select count(*)::int as n
    from act
    where act.last_read_at >= p_today::timestamptz
  ),
  ontrack as (
    select count(*)::int as n
    from public.profiles p
    cross join lateral (
      select least(90, greatest(1, (p_today - p.start_date) + 1)) as day
    ) d
    cross join lateral (
      select greatest(1, d.day - 6) as first_day
    ) w
    where p.start_date <= p_today
      and (
        (d.day - w.first_day + 1)
        - (
          select count(*)
          from public.completions c
          where c.user_id = p.id
            and c.is_full = true
            and c.day_number between w.first_day and d.day
        )
      ) <= 1
  ),
  silent as (
    select count(*)::int as n
    from act
    where (p_today - coalesce(act.last_activity_at, act.created_at)::date) >= p_quiet_days
  ),
  testimonies as (
    select count(*)::int as n
    from public.testimonials t
    where t.created_at >= (p_today - 6)::timestamptz
  )
  select reading.n, ontrack.n, silent.n, testimonies.n
  from reading, ontrack, silent, testimonies;
end;
$$;


-- ---------- 6b. Check on these ----------
--
-- The point of the page. One row per person, one reason each, and the
-- reason is never guessed — every field here is a count or a date.
--
-- kind is a code, not a sentence: the wording lives in lib/pulse.ts so
-- there is exactly one place that decides how this is said to a pastor.
--
--   never_started       a profile with no recorded activity, ever
--   quiet               nothing for p_quiet_days or more
--   prayer_unanswered   an open prayer at least a day old that nobody
--                       has marked themselves praying for
--
-- A person appears once, under the first of those that fits.
--
-- streak_before comes from the existing leaderboard view — the length of
-- the most recent run of full days. Someone who was consistent and
-- stopped is a different conversation from someone who never began, and
-- this is the column that tells them apart.
create or replace function public.pulse_check_on(
  p_today      date default current_date,
  p_quiet_days int  default 5,
  p_limit      int  default 50
)
returns table (
  user_id       uuid,
  name          text,
  photo_url     text,
  kind          text,
  days_quiet    int,
  streak_before int,
  cohort_name   text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  with act as (
    select
      a.*,
      (p_today - coalesce(a.last_activity_at, a.created_at)::date) as quiet_days
    from public.pulse_member_activity a
  ),
  waiting as (
    -- An open prayer, old enough to have been seen, that nobody has
    -- responded to. Oldest per author.
    select pr.user_id, min(pr.created_at) as oldest_at
    from public.prayer_requests pr
    where pr.is_answered = false
      and pr.created_at < (p_today)::timestamptz
      and not exists (
        select 1 from public.prayer_prayed pp where pp.prayer_id = pr.id
      )
    group by pr.user_id
  ),
  cohort_of as (
    -- Their primary cohort if they have one, otherwise the first they
    -- joined. Two plain lookups merged, not a nested join — this project
    -- has had HTTP 300s out of ambiguous relationships and the habit is
    -- worth keeping in SQL too.
    select
      p.id as user_id,
      coalesce(
        (select co.name from public.cohorts co where co.id = p.cohort_id),
        (select co2.name
           from public.cohort_members cm
           join public.cohorts co2 on co2.id = cm.cohort_id
          where cm.user_id = p.id
          order by cm.joined_at asc
          limit 1)
      ) as cohort_name
    from public.profiles p
  ),
  reasons as (
    select
      act.user_id,
      act.name,
      act.photo_url,
      case
        when act.last_activity_at is null                then 'never_started'
        when act.quiet_days >= p_quiet_days              then 'quiet'
        when w.user_id is not null                       then 'prayer_unanswered'
        else null
      end as kind,
      act.quiet_days as days_quiet
    from act
    left join waiting w on w.user_id = act.user_id
  )
  select
    r.user_id,
    r.name,
    r.photo_url,
    r.kind,
    r.days_quiet,
    coalesce(lb.current_streak, 0)::int as streak_before,
    c.cohort_name
  from reasons r
  left join public.leaderboard lb on lb.user_id = r.user_id
  left join cohort_of c           on c.user_id = r.user_id
  where r.kind is not null
  -- Silence first, and among the silent the longest silence first. The
  -- prayer rows sit below: nobody there has gone quiet, they are simply
  -- still waiting.
  order by
    case when r.kind = 'prayer_unanswered' then 1 else 0 end,
    r.days_quiet desc,
    r.name asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ---------- 6c. Cohorts ----------
--
-- Every cohort with its leader, how many read this week, and when it
-- last had any activity at all. Sorted quietest first — never by
-- performance, and never with a rank beside a leader's name.
create or replace function public.pulse_cohorts(
  p_today date default current_date,
  p_limit int  default 60
)
returns table (
  cohort_id        uuid,
  slug             text,
  name             text,
  leader_name      text,
  member_count     int,
  read_this_week   int,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  select
    co.id,
    co.slug,
    co.name,
    coalesce(
      (select p2.name
         from public.cohort_members cm2
         join public.profiles p2 on p2.id = cm2.user_id
        where cm2.cohort_id = co.id and cm2.role = 'leader'
        order by cm2.joined_at asc
        limit 1),
      (select p3.name from public.profiles p3 where p3.id = co.created_by)
    ) as leader_name,
    count(distinct cm.user_id)::int as member_count,
    (count(distinct cm.user_id)
       filter (where a.last_read_at >= (p_today - 6)::timestamptz))::int as read_this_week,
    max(a.last_activity_at) as last_activity_at
  from public.cohorts co
  left join public.cohort_members cm       on cm.cohort_id = co.id
  left join public.pulse_member_activity a on a.user_id = cm.user_id
  group by co.id, co.slug, co.name, co.created_by
  order by max(a.last_activity_at) asc nulls first, co.name asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ---------- 6d. Where people fall away ----------
--
-- Completion by day across all ninety. `eligible` is how many members
-- have actually reached that day of their own plan; `completed` is how
-- many of those kept it. A day nobody has reached yet has eligible = 0,
-- and the page draws nothing there rather than a zero.
create or replace function public.pulse_curve(
  p_today date default current_date
)
returns table (
  day_number int,
  eligible   int,
  completed  int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  select
    d.n::int,
    (count(*) filter (where p.start_date + (d.n - 1) <= p_today))::int,
    (count(*) filter (
      where p.start_date + (d.n - 1) <= p_today and c.user_id is not null
    ))::int
  from generate_series(1, 90) as d(n)
  cross join public.profiles p
  left join public.completions c
    on c.user_id = p.id and c.day_number = d.n and c.is_full = true
  group by d.n
  order by d.n;
end;
$$;


-- ---------- 6e. One person ----------
--
-- What the sheet shows above the care log. Activity and membership, no
-- content.
create or replace function public.pulse_person(
  p_user_id uuid,
  p_today   date default current_date
)
returns table (
  user_id          uuid,
  name             text,
  photo_url        text,
  cohort_name      text,
  leader_name      text,
  last_read_at     timestamptz,
  last_activity_at timestamptz,
  days_quiet       int,
  current_day      int,
  streak           int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  with mine as (
    -- Their primary cohort if they have one, otherwise the first they
    -- joined. Same order of preference as pulse_check_on, so the sheet
    -- and the list never name two different cohorts for one person.
    select
      coalesce(
        (select p.cohort_id from public.profiles p where p.id = p_user_id),
        (select cm.cohort_id
           from public.cohort_members cm
          where cm.user_id = p_user_id
          order by cm.joined_at asc
          limit 1)
      ) as cohort_id
  )
  select
    a.user_id,
    a.name,
    a.photo_url,
    (select co.name from public.cohorts co where co.id = m.cohort_id),
    coalesce(
      (select p2.name
         from public.cohort_members cm2
         join public.profiles p2 on p2.id = cm2.user_id
        where cm2.cohort_id = m.cohort_id and cm2.role = 'leader'
        order by cm2.joined_at asc
        limit 1),
      (select p3.name
         from public.cohorts co2
         join public.profiles p3 on p3.id = co2.created_by
        where co2.id = m.cohort_id)
    ),
    a.last_read_at,
    a.last_activity_at,
    (p_today - coalesce(a.last_activity_at, a.created_at)::date)::int,
    least(90, greatest(1, (p_today - a.start_date) + 1))::int,
    coalesce(lb.current_streak, 0)::int
  from public.pulse_member_activity a
  cross join mine m
  left join public.leaderboard lb on lb.user_id = a.user_id
  where a.user_id = p_user_id;
end;
$$;


-- ---------- 6f. Prayers waiting ----------
--
-- Public prayer wall content only. This is the one place on the whole
-- page where a member's own words appear, and they are words they chose
-- to post to a wall.
--
-- Two kinds, both waiting: nobody has responded, or the author asked for
-- a pastor. Oldest first, pastor-asked first.
create or replace function public.pulse_prayers(
  p_limit int default 20
)
returns table (
  id           uuid,
  user_id      uuid,
  name         text,
  photo_url    text,
  body         text,
  created_at   timestamptz,
  prayed_count int,
  needs_pastor boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_pastoral_user() then
    return;
  end if;

  return query
  select
    pr.id,
    pr.user_id,
    p.name,
    p.photo_url,
    pr.body,
    pr.created_at,
    (select count(*) from public.prayer_prayed pp where pp.prayer_id = pr.id)::int,
    pr.needs_pastor
  from public.prayer_requests pr
  join public.profiles p on p.id = pr.user_id
  where pr.is_answered = false
    and (
      pr.needs_pastor = true
      or not exists (select 1 from public.prayer_prayed pp2 where pp2.prayer_id = pr.id)
    )
  order by pr.needs_pastor desc, pr.created_at asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ============================================================
-- 7. GRANTS
--
-- Signed-in callers only. The guard inside each function is what decides
-- whether a signed-in caller gets rows.
-- ============================================================
-- PUBLIC first: a freshly created function carries EXECUTE for PUBLIC,
-- and revoking from anon alone would leave that untouched.
revoke execute on function public.pulse_numbers(date, int)        from public, anon;
revoke execute on function public.pulse_check_on(date, int, int)  from public, anon;
revoke execute on function public.pulse_cohorts(date, int)        from public, anon;
revoke execute on function public.pulse_curve(date)               from public, anon;
revoke execute on function public.pulse_person(uuid, date)        from public, anon;
revoke execute on function public.pulse_prayers(int)              from public, anon;

grant execute on function public.pulse_numbers(date, int)         to authenticated;
grant execute on function public.pulse_check_on(date, int, int)   to authenticated;
grant execute on function public.pulse_cohorts(date, int)         to authenticated;
grant execute on function public.pulse_curve(date)                to authenticated;
grant execute on function public.pulse_person(uuid, date)         to authenticated;
grant execute on function public.pulse_prayers(int)               to authenticated;
