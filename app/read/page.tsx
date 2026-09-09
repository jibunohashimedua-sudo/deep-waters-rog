import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { currentDayNumber, firstSlotOfTestament } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";

/**
 * The old address for the daily reading.
 *
 * A day's reading is a sequence of chapters at /read/[day]/[slot] now,
 * one to a screen. This route stays alive rather than 404ing because it
 * is in people's history, in old notifications, in links out of /me's
 * verse notes, and on anything anyone has added to their home screen —
 * and because the day view still thinks in testaments, which is the right
 * way to talk about a day even though it is one run to read.
 *
 * ?d= picks the day, ?t= picks which testament to open at.
 */
export default async function ReadRedirect({
  searchParams
}: {
  searchParams: { t?: string; d?: string };
}) {
  const { profile } = await requireProfile();

  const currentDay = currentDayNumber(profile.start_date, todayForCurrentRequest());
  const requested = Number.parseInt(searchParams.d ?? "", 10);
  const day =
    Number.isFinite(requested) && requested >= 1 && requested <= 90
      ? requested
      : currentDay;

  const testament = searchParams.t === "nt" ? "nt" : "ot";
  redirect(`/read/${day}/${firstSlotOfTestament(day, testament)}`);
}
