import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/mentions";
import { READING_PLAN, currentDayNumber } from "@/lib/plan";
import {
  REFLECTION_MAX,
  VERSE_REF_MAX,
  VERSE_TEXT_MAX,
  capText
} from "@/lib/limits";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { day_number } = body;

  if (!day_number || day_number < 1 || day_number > 90) {
    return NextResponse.json({ error: "invalid day" }, { status: 400 });
  }

  // Trim first, refuse over-cap second. Silently truncating a reflection
  // would land only most of what somebody wrote, which is worse than telling
  // them plainly that the box is full.
  if (typeof body.reflection === "string" && body.reflection.trim().length > REFLECTION_MAX) {
    return NextResponse.json({ error: "too_long", field: "reflection", max: REFLECTION_MAX }, { status: 400 });
  }
  if (typeof body.verse_reference === "string" && body.verse_reference.trim().length > VERSE_REF_MAX) {
    return NextResponse.json({ error: "too_long", field: "verse_reference", max: VERSE_REF_MAX }, { status: 400 });
  }
  if (typeof body.verse_text === "string" && body.verse_text.trim().length > VERSE_TEXT_MAX) {
    return NextResponse.json({ error: "too_long", field: "verse_text", max: VERSE_TEXT_MAX }, { status: 400 });
  }
  const reflection = capText(body.reflection, REFLECTION_MAX);
  const verse_reference = capText(body.verse_reference, VERSE_REF_MAX);
  const verse_text = capText(body.verse_text, VERSE_TEXT_MAX);

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
  const hasReflection = reflection !== null && reflection.length > 0;

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
