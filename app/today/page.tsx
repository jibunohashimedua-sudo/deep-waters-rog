import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentDayNumber } from "@/lib/plan";

/**
 * /today is a shortcut to /day/{yourCurrentDay}.
 *
 * All the rendering lives on /day/[n] so every day in the plan has its own
 * URL and any day can be read. This route stays alive because BottomNav,
 * every "back to today" link, and every notification links to /today —
 * they all now land the reader on their own actual today.
 */
export default async function TodayShortcut() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("start_date")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const day = currentDayNumber(profile.start_date);
  redirect(`/day/${day}`);
}
