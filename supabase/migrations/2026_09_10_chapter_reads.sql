-- ============================================================
-- Deep Waters — chapter-level reading progress
-- Adds per-chapter tick marks, an is_full flag on completions, and
-- updates streaks + badges to only count fully-read days.
--
-- Run: paste into Supabase SQL Editor and press Run once. Safe to
-- re-run — everything is idempotent.
-- ============================================================

-- ---------- CHAPTER READS ----------
-- One row per (user, day, book, chapter) that the reader has ticked
-- as read. Auto-completes the day when the count matches the plan.
create table if not exists public.chapter_reads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  day_number  int  not null check (day_number between 1 and 90),
  book        text not null,
  chapter     int  not null check (chapter >= 1),
  read_at     timestamptz not null default now(),
  unique (user_id, day_number, book, chapter)
);

create index if not exists chapter_reads_user_day_idx
  on public.chapter_reads(user_id, day_number);

alter table public.chapter_reads enable row level security;

drop policy if exists "chapter_reads_select_own" on public.chapter_reads;
drop policy if exists "chapter_reads_insert_own" on public.chapter_reads;
drop policy if exists "chapter_reads_delete_own" on public.chapter_reads;

create policy "chapter_reads_select_own" on public.chapter_reads
  for select using (auth.uid() = user_id);
create policy "chapter_reads_insert_own" on public.chapter_reads
  for insert with check (auth.uid() = user_id);
create policy "chapter_reads_delete_own" on public.chapter_reads
  for delete using (auth.uid() = user_id);

-- ---------- COMPLETIONS · is_full flag ----------
-- A day counts as "full" when the reader has either ticked every
-- chapter for it, or written a reflection on it (the legacy shortcut
-- that pre-dates chapter ticks). Existing rows default to true — they
-- were treated as complete under the old model, and this keeps every
-- streak and badge intact through the migration.
alter table public.completions
  add column if not exists is_full boolean not null default true;

-- ---------- Leaderboard · only full days count for streak & totals ----------
-- Re-declared in one CREATE OR REPLACE so re-runs stay clean. The
-- streak windowing is unchanged; only the source rows are narrower.
create or replace view public.leaderboard as
with completed as (
  select user_id, day_number
  from public.completions
  where is_full = true
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

-- ---------- Finishers · only full 90 counts ----------
create or replace view public.finishers as
select
  p.id,
  p.name,
  p.photo_url,
  p.cohort_id,
  max(c.completed_at) as finished_at
from public.profiles p
join public.completions c on c.user_id = p.id
where p.approved = true and c.is_full = true
group by p.id
having count(distinct c.day_number) >= 90
order by finished_at asc;

-- ---------- Cohort summary · only full days count ----------
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
left join public.cohort_members cm on cm.cohort_id = co.id
left join (
  select user_id, count(*) as days_completed
  from public.completions where is_full = true group by user_id
) sub on sub.user_id = cm.user_id
group by co.id;

-- ---------- Badges · only fire on full days ----------
-- Rewritten so partial completions (is_full=false) don't award
-- milestones. Existing awarded badges aren't revoked — the badges
-- table is its own history.
create or replace function public.award_badges()
returns trigger
language plpgsql security definer
as $$
declare
  total int;
  streak int;
begin
  if new.is_full is not true then
    return new;
  end if;

  select count(*) into total
  from public.completions
  where user_id = new.user_id and is_full = true;

  if total >= 1 then
    insert into public.badges(user_id, badge) values (new.user_id, 'first_day')
    on conflict do nothing;
  end if;
  if new.day_number >= 30 then
    insert into public.badges(user_id, badge) values (new.user_id, 'day_30')
    on conflict do nothing;
  end if;
  if new.day_number >= 60 then
    insert into public.badges(user_id, badge) values (new.user_id, 'day_60')
    on conflict do nothing;
  end if;
  if total >= 90 then
    insert into public.badges(user_id, badge) values (new.user_id, 'day_90')
    on conflict do nothing;
  end if;

  select current_streak into streak from public.leaderboard where user_id = new.user_id;
  if streak >= 7 then
    insert into public.badges(user_id, badge) values (new.user_id, 'streak_7')
    on conflict do nothing;
  end if;
  if streak >= 30 then
    insert into public.badges(user_id, badge) values (new.user_id, 'streak_30')
    on conflict do nothing;
  end if;

  return new;
end;
$$;
