-- ============================================================
-- Migration: v1 -> v2
-- Run this if you already ran the original schema.sql.
-- Then run schema.sql (it's idempotent, will add what's missing).
-- ============================================================

-- Add new columns to existing tables
alter table public.cohorts add column if not exists description text;
alter table public.cohorts add column if not exists welcome_message text;

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists approved boolean not null default true;
alter table public.profiles add column if not exists email_reminders boolean not null default true;
alter table public.profiles add column if not exists push_reminders boolean not null default true;
alter table public.profiles add column if not exists reminder_hour int not null default 7;

-- Add role check constraint if missing
do $$
begin
  alter table public.profiles add constraint profiles_role_check check (role in ('member','admin'));
exception when duplicate_object then null; end $$;

-- Migrate existing cohort_id on profiles into cohort_members
create table if not exists public.cohort_members (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','leader')),
  joined_at timestamptz default now(),
  primary key (cohort_id, user_id)
);

insert into public.cohort_members(cohort_id, user_id, role)
select cohort_id, id, 'member' from public.profiles where cohort_id is not null
on conflict do nothing;

-- Make cohort creators leaders
insert into public.cohort_members(cohort_id, user_id, role)
select id, created_by, 'leader' from public.cohorts where created_by is not null
on conflict (cohort_id, user_id) do update set role = 'leader';

-- Drop old views so schema.sql can recreate them with new columns
drop view if exists public.leaderboard cascade;
drop view if exists public.community_feed cascade;
drop view if exists public.finishers cascade;
drop view if exists public.cohort_summary cascade;

-- Drop old policies that will be recreated
drop policy if exists "profiles readable by everyone" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "completions readable by everyone" on public.completions;
drop policy if exists "users insert own completions" on public.completions;
drop policy if exists "users update own completions" on public.completions;
drop policy if exists "cohorts readable by everyone" on public.cohorts;
drop policy if exists "authenticated users create cohorts" on public.cohorts;
drop policy if exists "creators update own cohorts" on public.cohorts;

-- Now run schema.sql to add everything else.
