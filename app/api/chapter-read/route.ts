import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { READING_PLAN, currentDayNumber } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";

/**
 * Record a chapter as read, then recompute whether the day is fully read.
 *
 * The tick itself is one row in chapter_reads. After the tick lands, we
 * count chapter_reads for the day, compare to the plan (OT + NT length),
 * and set completions.is_full accordingly. A reflection saved for the day
 * counts as its own "day full" signal, so unticking never demotes a day
 * the reader wrote about.
 *
 * Two modes, because there are two callers and they want different things:
 *
 *   "toggle" (the default) is the manual check-box on the day view. A
 *   second press takes the tick off again, which is the whole point of a
 *   check-box.
 *
 *   "mark" is the automatic tracker on the reading screen. It can only
 *   ever add. A chapter re-read a week later must not quietly untick
 *   itself, and the tracker has no business removing anything — a row
 *   that is already there is simply success.
 *
 * Reading ahead is fine — reading is a private act. Marking ahead is not,
 * so a chapter tick for a day the reader hasn't reached yet is refused,
 * same rule as /api/complete.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const dayNumber = Number(body?.day_number);
  const book = typeof body?.book === "string" ? body.book : "";
  const chapter = Number(body?.chapter);
  const mode = body?.mode === "mark" ? "mark" : "toggle";

  if (
    !Number.isFinite(dayNumber) || dayNumber < 1 || dayNumber > 90 ||
    !book ||
    !Number.isFinite(chapter) || chapter < 1
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("start_date")
    .eq("id", user.id)
    .single();
  if (!prof) return NextResponse.json({ error: "no profile" }, { status: 400 });

  const currentDay = currentDayNumber(prof.start_date, todayForCurrentRequest());
  if (dayNumber > currentDay) {
    return NextResponse.json({ error: "That day hasn't arrived yet" }, { status: 400 });
  }

  // The plan is the source of truth for total chapters per day. Reading
  // ahead ticks and today's ticks all measure against the same list.
  const reading = READING_PLAN[dayNumber - 1];
  const totalChapters = reading.ot.length + reading.nt.length;

  // If a tick exists, "toggle" removes it and "mark" leaves it alone;
  // otherwise both add one. The unique constraint on
  // (user, day, book, chapter) means either state is a single-row
  // operation.
  const { data: existingTick } = await supabase
    .from("chapter_reads")
    .select("id")
    .eq("user_id", user.id)
    .eq("day_number", dayNumber)
    .eq("book", book)
    .eq("chapter", chapter)
    .maybeSingle();

  if (existingTick && mode === "toggle") {
    const { error } = await supabase
      .from("chapter_reads")
      .delete()
      .eq("id", existingTick.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (!existingTick) {
    const { error } = await supabase
      .from("chapter_reads")
      .insert({ user_id: user.id, day_number: dayNumber, book, chapter });
    // A fast triple-tap can race two identical POSTs: both read
    // `existingTick=null`, both attempt insert, one wins the unique
    // constraint and the loser gets Postgres 23505. That's not a real
    // failure — the tick is present after the winner ran — so we treat
    // it as success and fall through to the recount.
    if (error && (error as any).code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Recompute after the tick so the count reflects the new state.
  const { count: ticks } = await supabase
    .from("chapter_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("day_number", dayNumber);
  const ticksCount = ticks ?? 0;

  const { data: existingCompletion } = await supabase
    .from("completions")
    .select("id, reflection, is_full")
    .eq("user_id", user.id)
    .eq("day_number", dayNumber)
    .maybeSingle();

  const hasReflection = !!existingCompletion?.reflection?.trim();
  // Only every chapter recorded, across both testaments, completes a day.
  // A reflection alone used to also flip the day to full, which meant a
  // reader who wrote about a New Testament chapter but hadn't touched the
  // Old Testament reading had the day marked "kept" — writing the Old
  // Testament off unread. Reflections are a separate act now.
  const shouldBeFull = ticksCount >= totalChapters;

  if (shouldBeFull) {
    // If there isn't a completions row yet, create one — same shape the
    // reflection form would have created, minus the reflection. If there
    // is, update is_full=true and leave the reflection alone.
    if (existingCompletion) {
      if (existingCompletion.is_full !== true) {
        await supabase
          .from("completions")
          .update({ is_full: true, completed_at: new Date().toISOString() })
          .eq("id", existingCompletion.id);
      }
    } else {
      await supabase.from("completions").insert({
        user_id: user.id,
        day_number: dayNumber,
        is_full: true
      });
    }
  } else if (existingCompletion) {
    // Falling below full and no reflection to preserve → the row is
    // empty scaffolding, so it can go. If there is a reflection, keep the
    // row and mark is_full=false so streak/badge views stop counting it.
    if (!hasReflection && !existingCompletion.reflection) {
      await supabase.from("completions").delete().eq("id", existingCompletion.id);
    } else if (existingCompletion.is_full !== false) {
      await supabase
        .from("completions")
        .update({ is_full: false })
        .eq("id", existingCompletion.id);
    }
  }

  return NextResponse.json({
    // The state AFTER the call. "mark" only ever leaves it ticked.
    ticked: mode === "mark" ? true : !existingTick,
    ticks: ticksCount,
    total: totalChapters,
    isFull: shouldBeFull
  });
}
