-- ============================================================
-- Deep Waters with ROG: Complete Schema (v2)
-- Run in Supabase SQL Editor. Safe to run on a fresh project.
-- If upgrading from v1, run supabase/migrate_v1_to_v2.sql instead.
-- ============================================================

-- ---------- COHORTS ----------
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  welcome_message text,
  start_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists cohorts_slug_idx on public.cohorts(slug);

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text,
  start_date date not null default current_date,
  cohort_id uuid references public.cohorts(id) on delete set null, -- primary cohort
  role text not null default 'member' check (role in ('member','admin')),
  approved boolean not null default true,
  email_reminders boolean not null default true,
  push_reminders boolean not null default true,
  reminder_hour int not null default 7 check (reminder_hour between 0 and 23),
  created_at timestamptz default now()
);

-- ---------- COHORT MEMBERSHIP (many-to-many) ----------
create table if not exists public.cohort_members (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','leader')),
  joined_at timestamptz default now(),
  primary key (cohort_id, user_id)
);
create index if not exists cohort_members_user_idx on public.cohort_members(user_id);

-- ---------- COMPLETIONS ----------
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_number int not null check (day_number between 1 and 90),
  verse_reference text,
  verse_text text,
  reflection text,
  completed_at timestamptz default now(),
  unique(user_id, day_number)
);
create index if not exists completions_day_idx on public.completions(day_number desc, completed_at desc);
create index if not exists completions_user_idx on public.completions(user_id);

-- ---------- COMMENTS ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists comments_completion_idx on public.comments(completion_id, created_at);

-- ---------- REACTIONS (Amen) ----------
create table if not exists public.reactions (
  completion_id uuid not null references public.completions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (completion_id, user_id)
);

-- ---------- PRAYER REQUESTS ----------
create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  body text not null,
  is_answered boolean not null default false,
  answered_note text,
  created_at timestamptz default now()
);
create index if not exists prayer_created_idx on public.prayer_requests(created_at desc);

create table if not exists public.prayer_prayed (
  prayer_id uuid not null references public.prayer_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (prayer_id, user_id)
);

-- ---------- ANNOUNCEMENTS ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.cohorts(id) on delete cascade, -- null = global
  author_id uuid references public.profiles(id) on delete set null,
  title text,
  body text not null,
  created_at timestamptz default now()
);
create index if not exists announcements_cohort_idx on public.announcements(cohort_id, created_at desc);

-- ---------- BADGES ----------
create table if not exists public.badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null,
  earned_at timestamptz default now(),
  primary key (user_id, badge)
);

-- ---------- STUDY NOTES (one per day, written by ROG) ----------
create table if not exists public.study_notes (
  day_number int primary key check (day_number between 1 and 90),
  title text,
  body text,
  author_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now()
);

-- ---------- TESTIMONIALS ----------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- REPORTS (moderation) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('completion','comment','prayer','testimonial')),
  target_id uuid not null,
  reason text,
  resolved boolean not null default false,
  created_at timestamptz default now()
);

-- ---------- MENTIONS ----------
create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('completion','comment','prayer')),
  source_id uuid not null,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists mentions_user_idx on public.mentions(mentioned_user_id, created_at desc);

-- ---------- PUSH SUBSCRIPTIONS ----------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- ---------- NOTIFICATIONS (in-app inbox) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, -- 'mention','comment','amen','announcement','badge','reminder'
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

-- ---------- EVENTS (analytics) ----------
create table if not exists public.events (
  id bigserial primary key,
  user_id uuid,
  event text not null,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists events_created_idx on public.events(created_at desc);

-- ============================================================
-- VIEWS
-- ============================================================

-- Leaderboard with grace-day streak logic (one single-day gap allowed per streak)
create or replace view public.leaderboard as
with completed as (
  select user_id, day_number
  from public.completions
),
ordered as (
  select
    user_id,
    day_number,
    lag(day_number) over (partition by user_id order by day_number) as prev_day
  from completed
),
-- A "break" happens when the gap is more than 2 (i.e. two or more days missed in a row)
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
    count(c.id) as days_completed,
    max(c.day_number) as highest_day
  from public.profiles p
  left join public.completions c on c.user_id = p.id
  where p.approved = true
  group by p.id
)
select
  t.user_id,
  t.name,
  t.photo_url,
  t.cohort_id,
  t.start_date,
  t.days_completed,
  t.highest_day,
  coalesce(cs.current_streak, 0) as current_streak
from totals t
left join current_streak cs on cs.user_id = t.user_id
order by t.days_completed desc, cs.current_streak desc nulls last;

-- Community feed with reaction + comment counts
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
order by c.completed_at desc;

-- Finishers
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
group by p.id
having count(distinct c.day_number) >= 90
order by finished_at asc;

-- Cohort summary with member count and average progress
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
  from public.completions group by user_id
) sub on sub.user_id = cm.user_id
group by co.id;

-- Verse of the day: most-picked verse reference among completions today (UTC)
create or replace view public.verse_of_the_day as
select
  verse_reference,
  max(verse_text) as verse_text,
  count(*) as picks
from public.completions
where verse_reference is not null and verse_reference <> ''
  and completed_at >= date_trunc('day', now())
group by verse_reference
order by picks desc, verse_reference
limit 1;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Is the current user a leader of a given cohort?
create or replace function public.is_cohort_leader(c uuid)
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.cohort_members
    where cohort_id = c and user_id = auth.uid() and role = 'leader'
  ) or exists (
    select 1 from public.cohorts where id = c and created_by = auth.uid()
  ) or public.is_admin();
$$;

-- Award badges after a completion. Called by trigger.
create or replace function public.award_badges()
returns trigger
language plpgsql security definer
as $$
declare
  total int;
  streak int;
begin
  select count(*) into total from public.completions where user_id = new.user_id;

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

drop trigger if exists award_badges_trigger on public.completions;
create trigger award_badges_trigger
  after insert or update on public.completions
  for each row execute function public.award_badges();

-- Notify on comment
create or replace function public.notify_on_comment()
returns trigger
language plpgsql security definer
as $$
declare
  owner uuid;
  commenter text;
begin
  select user_id into owner from public.completions where id = new.completion_id;
  select name into commenter from public.profiles where id = new.user_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications(user_id, kind, title, body, link)
    values (owner, 'comment', commenter || ' commented on your reflection',
            left(new.body, 120), '/community#' || new.completion_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_comment_trigger on public.comments;
create trigger notify_on_comment_trigger
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Notify on amen
create or replace function public.notify_on_amen()
returns trigger
language plpgsql security definer
as $$
declare
  owner uuid;
  reactor text;
begin
  select user_id into owner from public.completions where id = new.completion_id;
  select name into reactor from public.profiles where id = new.user_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications(user_id, kind, title, link)
    values (owner, 'amen', reactor || ' said Amen to your reflection',
            '/community#' || new.completion_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_amen_trigger on public.reactions;
create trigger notify_on_amen_trigger
  after insert on public.reactions
  for each row execute function public.notify_on_amen();

-- Notify on mention
create or replace function public.notify_on_mention()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.notifications(user_id, kind, title, link)
  values (new.mentioned_user_id, 'mention', 'You were mentioned',
          case new.source_type
            when 'completion' then '/community#' || new.source_id
            when 'comment' then '/community'
            when 'prayer' then '/prayer'
          end);
  return new;
end;
$$;

drop trigger if exists notify_on_mention_trigger on public.mentions;
create trigger notify_on_mention_trigger
  after insert on public.mentions
  for each row execute function public.notify_on_mention();

-- Notify all members on cohort announcement
create or replace function public.notify_on_announcement()
returns trigger
language plpgsql security definer
as $$
begin
  if new.cohort_id is null then
    insert into public.notifications(user_id, kind, title, body, link)
    select id, 'announcement', coalesce(new.title, 'Announcement'), left(new.body, 120), '/announcements'
    from public.profiles;
  else
    insert into public.notifications(user_id, kind, title, body, link)
    select user_id, 'announcement', coalesce(new.title, 'Cohort announcement'), left(new.body, 120),
           '/c/' || (select slug from public.cohorts where id = new.cohort_id)
    from public.cohort_members where cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_announcement_trigger on public.announcements;
create trigger notify_on_announcement_trigger
  after insert on public.announcements
  for each row execute function public.notify_on_announcement();

-- Auto-add creator as leader when cohort created
create or replace function public.cohort_creator_is_leader()
returns trigger
language plpgsql security definer
as $$
begin
  if new.created_by is not null then
    insert into public.cohort_members(cohort_id, user_id, role)
    values (new.id, new.created_by, 'leader')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists cohort_creator_trigger on public.cohorts;
create trigger cohort_creator_trigger
  after insert on public.cohorts
  for each row execute function public.cohort_creator_is_leader();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;
alter table public.completions enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_prayed enable row level security;
alter table public.announcements enable row level security;
alter table public.badges enable row level security;
alter table public.study_notes enable row level security;
alter table public.testimonials enable row level security;
alter table public.reports enable row level security;
alter table public.mentions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;

-- Profiles
create policy "profiles_read" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own_or_admin" on public.profiles for update
  using (auth.uid() = id or public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete using (public.is_admin());

-- Cohorts
create policy "cohorts_read" on public.cohorts for select using (true);
create policy "cohorts_insert" on public.cohorts for insert with check (auth.uid() = created_by);
create policy "cohorts_update_leader" on public.cohorts for update using (public.is_cohort_leader(id));
create policy "cohorts_delete_leader" on public.cohorts for delete using (public.is_cohort_leader(id));

-- Cohort members
create policy "cm_read" on public.cohort_members for select using (true);
create policy "cm_insert_self" on public.cohort_members for insert
  with check (auth.uid() = user_id or public.is_cohort_leader(cohort_id));
create policy "cm_delete_self_or_leader" on public.cohort_members for delete
  using (auth.uid() = user_id or public.is_cohort_leader(cohort_id));
create policy "cm_update_leader" on public.cohort_members for update
  using (public.is_cohort_leader(cohort_id));

-- Completions
create policy "completions_read" on public.completions for select using (true);
create policy "completions_insert_own" on public.completions for insert with check (auth.uid() = user_id);
create policy "completions_update_own" on public.completions for update using (auth.uid() = user_id);
create policy "completions_delete_own_or_admin" on public.completions for delete
  using (auth.uid() = user_id or public.is_admin());

-- Comments
create policy "comments_read" on public.comments for select using (true);
create policy "comments_insert_own" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own_or_admin" on public.comments for delete
  using (auth.uid() = user_id or public.is_admin());

-- Reactions
create policy "reactions_read" on public.reactions for select using (true);
create policy "reactions_insert_own" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete_own" on public.reactions for delete using (auth.uid() = user_id);

-- Prayer requests
-- Cohort-scoped read: own prayers + global (cohort_id null) + prayers from
-- cohorts the reader is currently a member of + admin (moderation reach,
-- matching the OR-admin pattern elsewhere in this file). Tightened by
-- migration 2026_09_08_prayer_requests_cohort_scoped_read.sql. STRESS_AUDIT T3-A.
create policy "prayer_read" on public.prayer_requests for select using (
  auth.uid() = user_id
  or cohort_id is null
  or exists (
    select 1 from public.cohort_members cm
    where cm.cohort_id = prayer_requests.cohort_id
      and cm.user_id = auth.uid()
  )
  or public.is_admin()
);
create policy "prayer_insert_own" on public.prayer_requests for insert with check (auth.uid() = user_id);
create policy "prayer_update_own" on public.prayer_requests for update using (auth.uid() = user_id);
create policy "prayer_delete_own_or_admin" on public.prayer_requests for delete
  using (auth.uid() = user_id or public.is_admin());

create policy "prayed_read" on public.prayer_prayed for select using (true);
create policy "prayed_insert_own" on public.prayer_prayed for insert with check (auth.uid() = user_id);
create policy "prayed_delete_own" on public.prayer_prayed for delete using (auth.uid() = user_id);

-- Announcements
create policy "announcements_read" on public.announcements for select using (true);
create policy "announcements_insert_leader" on public.announcements for insert
  with check (
    auth.uid() = author_id and
    (cohort_id is null and public.is_admin() or cohort_id is not null and public.is_cohort_leader(cohort_id))
  );
create policy "announcements_delete_leader" on public.announcements for delete
  using (public.is_admin() or (cohort_id is not null and public.is_cohort_leader(cohort_id)));

-- Badges (system writes, everyone reads)
create policy "badges_read" on public.badges for select using (true);

-- Study notes
create policy "notes_read" on public.study_notes for select using (true);
create policy "notes_write_admin" on public.study_notes for all using (public.is_admin());

-- Testimonials
create policy "testimonials_read_approved_or_own" on public.testimonials for select
  using (approved = true or auth.uid() = user_id or public.is_admin());
create policy "testimonials_insert_own" on public.testimonials for insert with check (auth.uid() = user_id);
create policy "testimonials_update_admin" on public.testimonials for update using (public.is_admin());
create policy "testimonials_delete_own_or_admin" on public.testimonials for delete
  using (auth.uid() = user_id or public.is_admin());

-- Reports
create policy "reports_read_admin" on public.reports for select using (public.is_admin());
create policy "reports_insert_any" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_update_admin" on public.reports for update using (public.is_admin());

-- Mentions
create policy "mentions_read" on public.mentions for select using (true);
create policy "mentions_insert_any" on public.mentions for insert with check (auth.uid() is not null);

-- Push subscriptions
create policy "push_own" on public.push_subscriptions for all using (auth.uid() = user_id);

-- Notifications
create policy "notifications_own_read" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_own_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_own_delete" on public.notifications for delete using (auth.uid() = user_id);

-- Events
create policy "events_insert_any" on public.events for insert with check (true);
create policy "events_read_admin" on public.events for select using (public.is_admin());

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.completions;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.prayer_requests;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- ============================================================
-- SEED: Make the first user an admin (run after you sign up)
-- Replace the email with yours, then run this line separately.
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================
