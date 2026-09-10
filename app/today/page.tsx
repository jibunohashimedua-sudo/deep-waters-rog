import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { currentDayNumber, hasFinishedPlan } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";

/**
 * /today is a shortcut to /day/{yourCurrentDay}.
 *
 * All the rendering lives on /day/[n] so every day in the plan has its own
 * URL and any day can be read. This route stays alive because BottomNav,
 * every "back to today" link, and every notification links to /today —
 * they all now land the reader on their own actual today.
 */
export default async function TodayShortcut() {
  // Two Supabase round trips used to happen here — getUser(), then a
  // profiles row for one column — and then the browser followed the
  // redirect and /day/[n] paid for both again. requireProfile() reads the
  // row middleware already fetched for this same request, so this hop is
  // now pure arithmetic: no network at all between the tap and the
  // redirect. Same redirects, same order: /login, then /onboarding, then
  // /finished, then the day.
  const { profile } = await requireProfile();

  const today = todayForCurrentRequest();
  // Anyone past day 90 lands on a "you reached the end" page rather than
  // being parked on /day/90 in perpetuity. See app/finished/page.tsx.
  if (hasFinishedPlan(profile.start_date, today)) {
    redirect("/finished");
  }
  const day = currentDayNumber(profile.start_date, today);
  redirect(`/day/${day}`);
}
