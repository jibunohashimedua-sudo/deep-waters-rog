import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/mentions";
import { READING_PLAN, currentDayNumber } from "@/lib/plan";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { day_number, verse_reference, verse_text, reflection } = body;

  if (!day_number || day_number < 1 || day_number > 90) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }

  // Reading ahead is fine. Marking ahead is not — a completion is a
  // record that a day was done, and a day the reader hasn't reached
  // yet can't have been done. Blocked here as well as in the UI, so
  // curl and the API can't sidestep the disabled button.
  const { data: prof } = await supabase
    .from("profiles")
    .select("start_date")
    .eq("id", user.id)
    .single();
  if (!prof) return NextResponse.json({ error: "no profile" }, { status: 400 });
  const currentDay = currentDayNumber(prof.start_date);
  if (day_number > currentDay) {
    return NextResponse.json(
      { error: "That day hasn't arrived yet" },
      { status: 400 }
    );
  }

  // is_full is true when the reader has either written a reflection or
  // ticked every chapter for this day. Either signal counts as "day
  // done" — a reflection saved without ticking chapters is still the
  // reader saying "I'm done here", and unticking a chapter doesn't
  // demote a day they wrote about.
  const reflectionText = typeof reflection === "string" ? reflection.trim() : "";
  const hasReflection = reflectionText.length > 0;

  const reading = READING_PLAN[day_number - 1];
  const totalChapters = reading.ot.length + reading.nt.length;
  const { count: ticks } = await supabase
    .from("chapter_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("day_number", day_number);
  const chaptersFull = (ticks ?? 0) >= totalChapters;

  const isFull = hasReflection || chaptersFull;

  const { data: row, error } = await supabase
    .from("completions")
    .upsert(
      {
        user_id: user.id,
        day_number,
        verse_reference,
        verse_text,
        reflection,
        is_full: isFull,
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id,day_number" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (reflection && row?.id) {
    try {
      await recordMentions(supabase, "completion", row.id, reflection, user.id);
    } catch (e) {
      console.error("mention recording failed (non-fatal):", e);
    }
  }
  await supabase.from("events").insert({ user_id: user.id, event: "complete_day", meta: { day_number } });

  return NextResponse.json({ ok: true, id: row?.id });
}
