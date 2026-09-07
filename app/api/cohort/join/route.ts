import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const form = await request.formData();
  const cohortId = form.get("cohort_id")?.toString();
  const alignStart = form.get("align_start") === "1";
  if (!cohortId) return NextResponse.json({ error: "no cohort" }, { status: 400 });

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, slug, start_date")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Add to cohort_members. Previously these three writes were fire-and-forget
  // and the route redirected as though the join had worked, so a failure looked
  // exactly like success until the member noticed they weren't in the cohort.
  const { error: memberError } = await supabase
    .from("cohort_members")
    .upsert({ cohort_id: cohort.id, user_id: user.id, role: "member" }, { onConflict: "cohort_id,user_id" });
  if (memberError) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] cohort join failed:", memberError.message);
    return NextResponse.redirect(new URL(`/c/${cohort.slug}?error=join`, request.url));
  }

  // Set as primary cohort + optionally align start date
  const update: Record<string, unknown> = { cohort_id: cohort.id };
  if (alignStart) update.start_date = cohort.start_date;
  const { error: profileError } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (profileError) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] cohort profile update failed:", profileError.message);
    return NextResponse.redirect(new URL(`/c/${cohort.slug}?error=join`, request.url));
  }

  // Log event. Analytics only — never block the join on it.
  const { error: eventError } = await supabase
    .from("events")
    .insert({ user_id: user.id, event: "cohort_join", meta: { cohort_id: cohort.id } });
  if (eventError) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] cohort join event log failed:", eventError.message);
  }

  return NextResponse.redirect(new URL(`/c/${cohort.slug}`, request.url));
}
