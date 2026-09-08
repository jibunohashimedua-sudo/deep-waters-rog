import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISOForUser } from "@/lib/dates";
import { tzForCurrentRequest } from "@/lib/serverToday";

/**
 * Start the 90-day plan again from today.
 *
 * Only touches `profiles.start_date`. Completions, reflections, highlights,
 * verse notes and chapter reads stay put — a restart is a fresh horizon
 * laid over the existing record, not a reset. Anyone who wants a full wipe
 * still has `Reset my activity` on /depth.
 *
 * 303 redirect so the browser follows to /today with a plain GET rather
 * than re-POSTing on refresh. Origin comes from the request so this route
 * works on any deployment without a NEXT_PUBLIC_SITE_URL env var.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = todayISOForUser(tzForCurrentRequest());

  const { error } = await supabase
    .from("profiles")
    .update({ start_date: today })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.redirect(new URL("/today", request.url), 303);
}
