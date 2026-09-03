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

  // Add to cohort_members
  await supabase
    .from("cohort_members")
    .upsert({ cohort_id: cohort.id, user_id: user.id, role: "member" }, { onConflict: "cohort_id,user_id" });

  // Set as primary cohort + optionally align start date
  const update: Record<string, unknown> = { cohort_id: cohort.id };
  if (alignStart) update.start_date = cohort.start_date;
  await supabase.from("profiles").update(update).eq("id", user.id);

  // Log event
  await supabase.from("events").insert({ user_id: user.id, event: "cohort_join", meta: { cohort_id: cohort.id } });

  return NextResponse.redirect(new URL(`/c/${cohort.slug}`, request.url));
}
