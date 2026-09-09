-- ============================================================
-- Deep Waters — Close the anonymous read hole
--
-- Found while wiring the admin "who has read today" list, which is the
-- sort of thing you only notice when you go looking.
--
-- Eight tables carrying member data were readable with
--     select using (true)
-- which does not mean "any member". It means anyone at all, signed in or
-- not. The anon key is in the page source of every deployment — it is
-- meant to be — so with that key and a URL, a stranger on the internet
-- could read the whole church's names, who completed which day and when,
-- and every comment anybody had written under a reflection. No login.
--
-- Verified before writing this: an anonymous GET against
--   /rest/v1/profiles, /rest/v1/completions, /rest/v1/comments,
--   /rest/v1/reactions, /rest/v1/mentions
-- returned rows.
--
-- The fix is the smallest one that closes it: those tables now require a
-- signed-in user. Nothing about what a *member* can see changes, so no
-- screen in the app behaves differently — this only removes the reader
-- who was never supposed to be there.
--
-- What is deliberately NOT changed here, and why:
--
--   cohorts, cohort_members, announcements stay readable, because the
--   cohort invite link (/c/<slug>) is a public share page and needs
--   them. They carry a cohort's name and its notices, not anybody's
--   reading activity.
--
--   Member-to-member visibility of raw completions is left as it is.
--   Tightening that is a product decision — a cohort leader legitimately
--   reads their members' progress, and a private owner reads theirs —
--   and it wants its own pass rather than being smuggled into this one.
--
-- Additive and idempotent. Dated to sort after 2026_09_18.
-- ============================================================


-- ============================================================
-- 1. THE FACES ON A PUBLIC INVITE PAGE
--
-- /c/<slug> shows up to a dozen portraits so a share link looks like a
-- group of people rather than a form. That is the one thing an
-- anonymous visitor legitimately needs out of `profiles`, so it is
-- served by a view that exposes exactly it — a name and a picture, for
-- approved and visible members — instead of by leaving the whole table
-- open.
--
-- A view runs as its owner and is not subject to RLS on its base
-- tables, which is what lets it keep working after §2 closes the table.
-- can_see_user() is written into it by hand for the same reason: a
-- private member must not appear here either.
-- ============================================================

drop view if exists public.cohort_faces;
create view public.cohort_faces as
select
  cm.cohort_id,
  cm.user_id,
  p.display_name as name,
  p.photo_url
from public.cohort_members cm
join public.profiles p on p.id = cm.user_id
where p.approved = true
  and public.can_see_user(cm.user_id);

grant select on public.cohort_faces to anon, authenticated;


-- ============================================================
-- 2. SIGNED IN, OR NOTHING
--
-- `auth.uid() is not null` rather than the `true` these carried.
--
-- Every one of these is still wide open to any signed-in member, which
-- is what the app already assumed and what its screens are built on.
-- The RESTRICTIVE hide_private_users policy from 2026_09_17 is AND-ed
-- with each of them and continues to apply, so a private member stays
-- invisible to everyone including admins.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',        -- names, nicknames, photos, start dates
    'completions',     -- who read which day, and when
    'comments',        -- what people wrote to each other
    'reactions',
    'mentions',
    'badges',
    'prayer_prayed',
    'study_notes'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
  end loop;
end $$;

-- Dropped by the loop above under their real names, which differ from
-- the table names in a few cases. Named out in full here so this file
-- says exactly which policy it is replacing.
drop policy if exists "profiles_read"     on public.profiles;
drop policy if exists "completions_read"  on public.completions;
drop policy if exists "comments_read"     on public.comments;
drop policy if exists "reactions_read"    on public.reactions;
drop policy if exists "mentions_read"     on public.mentions;
drop policy if exists "badges_read"       on public.badges;
drop policy if exists "prayed_read"       on public.prayer_prayed;
drop policy if exists "notes_read"        on public.study_notes;

create policy "profiles_read"    on public.profiles      for select using (auth.uid() is not null);
create policy "completions_read" on public.completions   for select using (auth.uid() is not null);
create policy "comments_read"    on public.comments      for select using (auth.uid() is not null);
create policy "reactions_read"   on public.reactions     for select using (auth.uid() is not null);
create policy "mentions_read"    on public.mentions      for select using (auth.uid() is not null);
create policy "badges_read"      on public.badges        for select using (auth.uid() is not null);
create policy "prayed_read"      on public.prayer_prayed for select using (auth.uid() is not null);
create policy "notes_read"       on public.study_notes   for select using (auth.uid() is not null);
