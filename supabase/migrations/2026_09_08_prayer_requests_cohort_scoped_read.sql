-- Tighten the SELECT policy on public.prayer_requests.
--
-- Before this migration: `prayer_read` = SELECT USING (true) — every
-- signed-in user could read every prayer in the database, including from
-- cohorts they never joined or have left. STRESS_AUDIT.md T3-A.
--
-- After this migration: a signed-in user can read a prayer request iff
--   (a) they authored it, OR
--   (b) it is a global prayer (cohort_id IS NULL), OR
--   (c) they are a current member of the prayer's cohort, OR
--   (d) they are an admin (moderation reach — same OR-admin pattern used
--       by prayer_delete_own_or_admin, testimonials_admin, reports_admin
--       elsewhere in schema.sql, so /admin/reports keeps its ability to
--       display every reported prayer regardless of cohort membership).
--
-- INSERT / UPDATE / DELETE policies are untouched. Only SELECT changes.

drop policy if exists "prayer_read" on public.prayer_requests;

create policy "prayer_read" on public.prayer_requests
  for select using (
    auth.uid() = user_id
    or cohort_id is null
    or exists (
      select 1
      from public.cohort_members cm
      where cm.cohort_id = prayer_requests.cohort_id
        and cm.user_id = auth.uid()
    )
    or public.is_admin()
  );
