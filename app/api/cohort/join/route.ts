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

  // Check membership first. If the user is already in this cohort, an
  // upsert is a no-op — but the profile update that used to follow blindly
  // was silently overwriting their `cohort_id` and, when `align_start=1`
  // was ticked (the default on the share form), their `start_date`. That
  // wiped a returning member's real start date and reset their whole plan
  // to Day 1. Now: only alter the profile on a first-time join.
  const { data: existing } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("cohort_id", cohort.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const alreadyMember = !!existing;

  if (!alreadyMember) {
    const { error: memberError } = await supabase
      .from("cohort_members")
      .insert({ cohort_id: cohort.id, user_id: user.id, role: "member" });
    if (memberError) {
      // eslint-disable-next-line no-console
      console.error("[deep-waters] cohort join failed:", memberError.message);
      return NextResponse.redirect(new URL(`/c/${cohort.slug}?error=join`, request.url));
    }

    // Set as primary cohort + optionally align start date. Only on a first
    // join; a re-join never touches these.
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
