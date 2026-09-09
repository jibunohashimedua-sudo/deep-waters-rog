-- ============================================================
-- Deep Waters — Private members
--
-- One member is invisible to the whole church. Not muted, not hidden
-- behind a filter someone can turn off: absent. He does not appear in a
-- list, a count, an average, an autocomplete or an export, and his rows
-- cannot be read by anyone — admin, pastoral or otherwise — except
-- himself and the one account that owns his privacy.
--
-- Three mechanisms, because there are three ways to read this database
-- and RLS only closes one of them:
--
--   §3  RESTRICTIVE policies       — closes the PostgREST/anon path.
--                                    Restrictive policies are AND-ed with
--                                    everything else, so an "admins can
--                                    read all" permissive policy cannot
--                                    OR its way past them.
--   §4  views                      — a view runs as its owner, and its
--                                    owner is not subject to RLS. Every
--                                    view over a user table gets the
--                                    filter written into it by hand.
--   §5  security definer functions — same reason. Church Pulse is six of
--                                    them and every one is filtered.
--
-- Additive. Nothing is dropped that is not immediately recreated, and
-- every statement is idempotent: safe to run twice.
--
-- Dated 2026_09_17 so it sorts after 2026_09_16_retire_badges_trigger.sql,
-- the last migration applied. Ordering matters more than the wall clock:
-- this file has to run last.
-- ============================================================


-- ============================================================
-- 1. THE COLUMNS
-- ============================================================
alter table public.profiles
  add column if not exists is_private boolean not null default false;

alter table public.profiles
  add column if not exists private_owner_id uuid references public.profiles(id) on delete set null;

-- The only question ever asked of these two columns is "is this person
-- private, and if so whose". One partial index answers it.
create index if not exists profiles_private_owner_idx
  on public.profiles (private_owner_id)
  where is_private;


-- ============================================================
-- 2. WHO IS PRIVATE, AND WHOSE
--
-- Keyed on email rather than on a uuid typed into a migration, because
-- the member this was written for had not signed up yet. A uuid would
-- have had to be filled in by hand after the fact, and the day it was
-- forgotten he would have been an ordinary visible member with no sign
-- that anything was wrong.
--
-- The seed is applied now (a no-op for an account that does not exist)
-- and again by trigger the moment a matching profile is created. There
-- is no window in which he is visible.
-- ============================================================
create table if not exists public.private_member_seeds (
  email       text primary key,
  owner_email text not null,
  created_at  timestamptz not null default now()
);

alter table public.private_member_seeds enable row level security;

-- No policies, and no grants. Nothing reads this table but the security
-- definer function below, which runs as its owner. A list of who is
-- hidden is itself a leak.
revoke all on public.private_member_seeds from anon, authenticated;

insert into public.private_member_seeds (email, owner_email)
values ('elkanahboadi170@gmail.com', 'jibunohashimedua@gmail.com')
on conflict (email) do update set owner_email = excluded.owner_email;


-- ------------------------------------------------------------
-- 2a. The write guard
--
-- profiles_update_own_or_admin lets a member update their own row, and
-- PostgREST has no column-level grant we can express through a policy.
-- guard_is_pastoral already carries is_pastoral forward on a non-admin
-- update for exactly that reason; is_private and private_owner_id need
-- the same treatment and something stricter than "unless admin" —
-- privacy here is not an admin power, it is the owner's.
--
-- So: those two columns move only inside apply_private_member_seeds(),
-- which sets dw.private_seed for the duration of its own transaction.
-- Every other update carries the old values forward. No error, no failed
-- save of the fields someone was actually editing — the flags just do
-- not move.
-- ------------------------------------------------------------
create or replace function public.guard_is_pastoral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seeding boolean := coalesce(current_setting('dw.private_seed', true), '') = 'on';
begin
  if new.is_pastoral is distinct from old.is_pastoral
     and not seeding
     and not public.is_admin() then
    new.is_pastoral := old.is_pastoral;
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


-- ------------------------------------------------------------
-- 2b. Applying the seed
--
-- Returns the number of profiles it changed, so running it by hand tells
-- you whether it found anybody.
-- ------------------------------------------------------------
create or replace function public.apply_private_member_seeds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
begin
  perform set_config('dw.private_seed', 'on', true);

  with pairs as (
    select
      member_profile.id as member_id,
      owner_profile.id  as owner_id
    from public.private_member_seeds s
    join auth.users member_user      on lower(member_user.email) = lower(s.email)
    join public.profiles member_profile on member_profile.id = member_user.id
    join auth.users owner_user       on lower(owner_user.email) = lower(s.owner_email)
    join public.profiles owner_profile  on owner_profile.id = owner_user.id
  )
  update public.profiles p
     set is_private       = true,
         is_pastoral      = true,
         private_owner_id = pairs.owner_id
    from pairs
   where p.id = pairs.member_id
     and (
       p.is_private is distinct from true
       or p.is_pastoral is distinct from true
       or p.private_owner_id is distinct from pairs.owner_id
     );

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.apply_private_member_seeds() from public, anon, authenticated;

-- Apply to anyone already here.
select public.apply_private_member_seeds();

-- And to anyone who arrives later. AFTER INSERT rather than BEFORE,
-- because the seed lookup joins the row it is about.
create or replace function public.private_member_on_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_private_member_seeds();
  return null;
end;
$$;

drop trigger if exists private_member_seed_trigger on public.profiles;
create trigger private_member_seed_trigger
  after insert on public.profiles
  for each row execute function public.private_member_on_new_profile();


-- ============================================================
-- 3. THE VISIBILITY FUNCTION, AND THE RESTRICTIVE POLICIES
-- ============================================================

-- May the current caller see this person?
--
-- false only for a private member seen by anyone who is neither himself
-- nor his owner. Everything else — an ordinary member, a null user
-- column, a row whose author has been deleted — is true, so this can be
-- dropped onto a nullable column without silently hiding rows that have
-- nothing to do with anybody.
--
-- security definer so it can read profiles without tripping the very
-- policy it is used by, which would recurse.
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
        or auth.uid() = p.id
        or auth.uid() = coalesce(p.private_owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
      from public.profiles p
      where p.id = target
    ),
    true
  );
$$;

grant execute on function public.can_see_user(uuid) to anon, authenticated;


-- One policy, one shape, on every table that stores something linked to
-- a person. RESTRICTIVE, so it is AND-ed with the permissive policies
-- already there rather than OR-ed beside them: "admins can read all" and
-- "reports_read_admin" and "profiles_read using (true)" all still apply,
-- and all of them now have to get past this as well.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('profiles',           'id'),
      ('cohorts',            'created_by'),
      ('cohort_members',     'user_id'),
      ('completions',        'user_id'),
      ('chapter_reads',      'user_id'),
      ('comments',           'user_id'),
      ('reactions',          'user_id'),
      ('prayer_requests',    'user_id'),
      ('prayer_prayed',      'user_id'),
      ('announcements',      'author_id'),
      ('badges',             'user_id'),
      ('study_notes',        'author_id'),
      ('testimonials',       'user_id'),
      ('reports',            'reporter_id'),
      ('mentions',           'mentioned_user_id'),
      ('push_subscriptions', 'user_id'),
      ('notifications',      'user_id'),
      ('events',             'user_id'),
      ('highlights',         'user_id'),
      ('verse_notes',        'user_id'),
      ('sermons',            'user_id')
    ) as v(tbl, col)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('drop policy if exists "hide_private_users" on public.%I', t.tbl);
    execute format(
      'create policy "hide_private_users" on public.%I as restrictive for select using (public.can_see_user(%I))',
      t.tbl, t.col
    );
  end loop;
end;
$$;

-- care_log carries two people: who it is about and who wrote it. Both
-- have to be visible for the row to be.
drop policy if exists "hide_private_users" on public.care_log;
create policy "hide_private_users" on public.care_log
  as restrictive for select
  using (
    public.can_see_user(subject_user_id)
    and public.can_see_user(author_user_id)
  );


-- ============================================================
-- 4. THE VIEWS
--
-- A view is not subject to RLS on its base tables — it runs as its
-- owner, and its owner is exempt. Every view below is re-declared with
-- the filter written into it. This is the half of the job that the
-- policies above cannot do, and the half that Church Pulse and the
-- leaderboard actually read.
-- ============================================================

-- ---------- Leaderboard ----------
create or replace view public.leaderboard as
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
    p.name,
    p.photo_url,
    p.cohort_id,
    p.start_date,
    (select count(*) from public.completions c
       where c.user_id = p.id and c.is_full = true) as days_completed,
    (select max(day_number) from public.completions c
       where c.user_id = p.id and c.is_full = true) as highest_day
  from public.profiles p
  where p.approved = true
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
create or replace view public.community_feed as
select
  c.id,
  c.user_id,
  c.day_number,
  c.verse_reference,
  c.verse_text,
  c.reflection,
  c.completed_at,
  p.name,
  p.photo_url,
  p.cohort_id,
  (select count(*) from public.reactions r where r.completion_id = c.id) as amen_count,
  (select count(*) from public.comments cm where cm.completion_id = c.id) as comment_count
from public.completions c
join public.profiles p on p.id = c.user_id
where c.reflection is not null and c.reflection <> ''
  and p.approved = true
  and public.can_see_user(c.user_id)
order by c.completed_at desc;

-- ---------- Finishers ----------
create or replace view public.finishers as
select
  p.id,
  p.name,
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

-- ---------- Cohort summary ----------
-- Both halves filtered: a private member must not be counted in
-- member_count and must not move avg_days_completed.
create or replace view public.cohort_summary as
select
  co.id,
  co.slug,
  co.name,
  co.description,
  co.welcome_message,
  co.start_date,
  co.created_by,
  co.created_at,
  count(distinct cm.user_id) as member_count,
  coalesce(avg(sub.days_completed), 0)::numeric(5,1) as avg_days_completed
from public.cohorts co
left join public.cohort_members cm
  on cm.cohort_id = co.id
 and public.can_see_user(cm.user_id)
left join (
  select user_id, count(*) as days_completed
  from public.completions where is_full = true group by user_id
) sub on sub.user_id = cm.user_id
group by co.id;

-- ---------- Verse of the day ----------
-- One private reader picking a verse must not be able to move what the
-- whole church is shown.
create or replace view public.verse_of_the_day as
select
  verse_reference,
  max(verse_text) as verse_text,
  count(*) as picks
from public.completions
where verse_reference is not null and verse_reference <> ''
  and completed_at >= date_trunc('day', now())
  and public.can_see_user(user_id)
group by verse_reference
order by picks desc, verse_reference
limit 1;

-- ---------- Pulse member activity ----------
-- The spine of Church Pulse. Filtering here is what keeps a private
-- member out of "reading today", "quiet", the cohort roll-up and the
-- person sheet all at once.
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
) pry on pry.user_id = p.id
where public.can_see_user(p.id);

revoke all on public.pulse_member_activity from anon, authenticated;


-- ============================================================
-- 5. CHURCH PULSE — THE AGGREGATES
--
-- Six security definer functions. Security definer means they run as
-- their owner, which means RLS is off inside them, which means §3 does
-- nothing here. Each one is re-declared below with the filter written
-- in, at every point it touches a person:
--
--   pulse_numbers    on_track reads profiles; new_testimonies reads
--                    testimonials. reading_today and quiet come from
--                    pulse_member_activity, already filtered in §4.
--   pulse_check_on   the "needs attention" list, and the open-prayer
--                    scan behind it.
--   pulse_cohorts    member_count and read_this_week.
--   pulse_curve      the drop-off curve's eligible and completed.
--   pulse_person     the person sheet — refuses outright.
--   pulse_prayers    the waiting-prayer list.
-- ============================================================

-- ---------- 5a. The four numbers ----------
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
      and public.can_see_user(p.id)
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
      and public.can_see_user(t.user_id)
  )
  select reading.n, ontrack.n, silent.n, testimonies.n
  from reading, ontrack, silent, testimonies;
end;
$$;


-- ---------- 5b. Check on these ----------
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
    select distinct pr.user_id
    from public.prayer_requests pr
    where pr.is_answered = false
      and pr.created_at < (p_today)::timestamptz
      and public.can_see_user(pr.user_id)
      and not exists (
        select 1 from public.prayer_prayed pp where pp.prayer_id = pr.id
      )
  ),
  cohort_of as (
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
    where public.can_see_user(p.id)
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
  order by
    case when r.kind = 'prayer_unanswered' then 1 else 0 end,
    r.days_quiet desc,
    r.name asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ---------- 5c. Cohorts ----------
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
        where cm2.cohort_id = co.id
          and cm2.role = 'leader'
          and public.can_see_user(p2.id)
        order by cm2.joined_at asc
        limit 1),
      (select p3.name
         from public.profiles p3
        where p3.id = co.created_by
          and public.can_see_user(p3.id))
    ) as leader_name,
    count(distinct cm.user_id)::int as member_count,
    (count(distinct cm.user_id)
       filter (where a.last_read_at >= (p_today - 6)::timestamptz))::int as read_this_week,
    max(a.last_activity_at) as last_activity_at
  from public.cohorts co
  left join public.cohort_members cm
    on cm.cohort_id = co.id
   and public.can_see_user(cm.user_id)
  left join public.pulse_member_activity a on a.user_id = cm.user_id
  group by co.id, co.slug, co.name, co.created_by
  order by max(a.last_activity_at) asc nulls first, co.name asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ---------- 5d. Where people fall away ----------
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
  where public.can_see_user(p.id)
  group by d.n
  order by d.n;
end;
$$;


-- ---------- 5e. One person ----------
-- The direct lookup, and so the one most worth trying by hand. It
-- refuses before it reads anything.
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
  if not public.can_see_user(p_user_id) then
    return;
  end if;

  return query
  with mine as (
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
        where cm2.cohort_id = m.cohort_id
          and cm2.role = 'leader'
          and public.can_see_user(p2.id)
        order by cm2.joined_at asc
        limit 1),
      (select p3.name
         from public.cohorts co2
         join public.profiles p3 on p3.id = co2.created_by
        where co2.id = m.cohort_id
          and public.can_see_user(p3.id))
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


-- ---------- 5f. Prayers waiting ----------
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
    and public.can_see_user(pr.user_id)
    and (
      pr.needs_pastor = true
      or not exists (select 1 from public.prayer_prayed pp2 where pp2.prayer_id = pr.id)
    )
  order by pr.needs_pastor desc, pr.created_at asc
  limit greatest(1, least(p_limit, 200));
end;
$$;


-- ============================================================
-- 6. THE OWNER'S OWN VIEW
--
-- Who does this account own? Answered without exposing the flag columns
-- through any other route: the private members section reads this and
-- nothing else, and it returns rows only for the account that owns them.
--
-- security definer, but there is no gate to forget — the where clause is
-- the gate. A caller who owns nobody gets nothing.
-- ============================================================
create or replace function public.my_private_members()
returns table (
  user_id      uuid,
  name         text,
  photo_url    text,
  start_date   date,
  created_at   timestamptz,
  is_pastoral  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.photo_url, p.start_date, p.created_at, p.is_pastoral
  from public.profiles p
  where p.is_private = true
    and p.private_owner_id = auth.uid()
    and auth.uid() is not null
  order by p.name asc;
$$;

revoke execute on function public.my_private_members() from public, anon;
grant execute on function public.my_private_members() to authenticated;


-- ============================================================
-- 7. THE OWNER'S READ
--
-- §3 subtracts. It cannot add, and four of the tables the owner needs are
-- own-rows-only to begin with:
--
--   verse_notes    verse_notes_select_own   using (auth.uid() = user_id)
--   highlights     highlights_select_own    using (auth.uid() = user_id)
--   chapter_reads  chapter_reads_select_own using (auth.uid() = user_id)
--   sermons        sermons_select_own       using (auth.uid() = user_id)
--
-- A restrictive policy is AND-ed with those, so it can only ever take the
-- owner further away from rows he already could not read. Without this
-- section the private members page renders "No notes yet" over a member
-- who has written fifty — the worst failure available here, because it
-- reads as an answer rather than as an error.
--
-- So one permissive policy each, narrow as it goes: it opens exactly the
-- rows of a private member to exactly the account that owns him, and
-- nothing else. It is not an admin power and it does not consult the admin
-- flag; is_private_owner_of() is false for every other account on the
-- project, including the other admin.
-- ============================================================
create or replace function public.is_private_owner_of(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_private
         and auth.uid() is not null
         and auth.uid() = p.private_owner_id
      from public.profiles p
      where p.id = target
    ),
    false
  );
$$;

grant execute on function public.is_private_owner_of(uuid) to anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('verse_notes',   'user_id'),
      ('highlights',    'user_id'),
      ('chapter_reads', 'user_id'),
      ('sermons',       'user_id')
    ) as v(tbl, col)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;
    execute format('drop policy if exists "private_owner_can_read" on public.%I', t.tbl);
    execute format(
      'create policy "private_owner_can_read" on public.%I for select using (public.is_private_owner_of(%I))',
      t.tbl, t.col
    );
  end loop;
end;
$$;
