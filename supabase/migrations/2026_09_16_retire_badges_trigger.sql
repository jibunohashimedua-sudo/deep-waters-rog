-- ============================================================
-- Retire the badges trigger — 2026-09-09
--
-- Nothing in the app reads public.badges any more. The Depth page used to
-- list six badges out of this table; it now shows four depths derived from
-- days kept, which needs no table and no round trip, and the onboarding
-- slide that promised "badges for streaks and milestones" has gone with
-- them. Two of the six counted streaks, and this app stopped putting a
-- streak number on screen some weeks ago.
--
-- So award_badges_trigger has been firing on every completion — every
-- insert and every update — to write rows nobody looks at.
--
-- What this migration does NOT do, on purpose:
--
--   * public.award_badges() stays exactly as it is. It is the only record
--     of how the six were earned, and leaving it means the rollback at the
--     bottom of this file is two statements rather than a re-derivation.
--   * The badges table stays, and so does every row in it. Nothing here
--     deletes data. If badges ever come back, or somebody wants to know
--     who reached day 90 before the depths existed, it is all still there.
--
-- The one thing it tightens: badges_read was `using (true)`, so any signed
-- in reader could select every other member's badge rows. Nothing reads
-- them, which is exactly why it went unnoticed — but rows that sit in a
-- table unread should not also sit there world-readable.
-- ============================================================

-- 1. Stop writing.
drop trigger if exists award_badges_trigger on public.completions;

-- 2. Scope the read to the row's own user. public.badges keys on user_id,
--    a uuid referencing public.profiles(id).
drop policy if exists "badges_read" on public.badges;

create policy "badges_read_own" on public.badges
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- ROLLBACK
--
-- Paste these two blocks to put it back exactly as it was. The function is
-- still in place, so the trigger can be recreated against it directly.
--
--   drop policy if exists "badges_read_own" on public.badges;
--   create policy "badges_read" on public.badges for select using (true);
--
--   drop trigger if exists award_badges_trigger on public.completions;
--   create trigger award_badges_trigger
--     after insert or update on public.completions
--     for each row execute function public.award_badges();
--
-- Rows written while the trigger was off will not be backfilled by this.
-- award_badges() only fires on a completion, so a member who crossed a
-- milestone in the meantime gets their row the next time they keep a day.
-- ============================================================
