import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VERSE_NOTE_MAX, VERSE_TEXT_MAX, capText } from "@/lib/limits";

/**
 * Save a note against a verse span.
 *
 * The client used to `supabase.from("verse_notes").insert(...)` directly, so
 * a note body had no server-side length ceiling and Postgres would accept
 * whatever it was handed. This route holds the cap. RLS still scopes writes
 * to the reader's own uid.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    day_number,
    testament,
    book,
    chapter,
    verse_start,
    verse_end
  } = body;

  if (
    !Number.isFinite(day_number) ||
    day_number < 1 ||
    day_number > 90 ||
    (testament !== "ot" && testament !== "nt") ||
    typeof book !== "string" ||
    !Number.isFinite(chapter) ||
    !Number.isFinite(verse_start) ||
    !Number.isFinite(verse_end) ||
    verse_end < verse_start
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  if (typeof body.body === "string" && body.body.trim().length > VERSE_NOTE_MAX) {
    return NextResponse.json({ error: "too_long", field: "body", max: VERSE_NOTE_MAX }, { status: 400 });
  }
  if (typeof body.verse_text === "string" && body.verse_text.trim().length > VERSE_TEXT_MAX) {
    return NextResponse.json({ error: "too_long", field: "verse_text", max: VERSE_TEXT_MAX }, { status: 400 });
  }

  const noteBody = capText(body.body, VERSE_NOTE_MAX);
  const verseText = capText(body.verse_text, VERSE_TEXT_MAX);
  if (!noteBody) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  // An optional client-chosen id, which is what makes this safe to send
  // twice. A note written with no signal is held in a queue on the phone
  // and replayed when signal returns; if the reply to that replay is lost
  // on the way back — a tunnel, a lift, a dropped connection at exactly the
  // wrong moment — the queue tries again, and without this the reader would
  // find the same note saved twice. With their own id on it, the second
  // attempt collides with the primary key, and a collision here means the
  // note is already saved, which is success. Same reasoning as the 23505
  // handling in /api/chapter-read.
  //
  // Nothing else changes: a caller that sends no id gets a database-assigned
  // one exactly as before.
  const givenId =
    typeof body.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      ? body.id
      : null;

  const { data, error } = await supabase
    .from("verse_notes")
    .insert({
      ...(givenId ? { id: givenId } : {}),
      user_id: user.id,
      day_number,
      testament,
      book,
      chapter,
      verse_start,
      verse_end,
      verse_text: verseText,
      body: noteBody
    })
    .select()
    .single();
  if (error) {
    if (givenId && (error as { code?: string }).code === "23505") {
      // Already there. Hand back the row that is, so the caller ends up in
      // the same state as if this attempt had been the one that landed.
      const { data: existing } = await supabase
        .from("verse_notes")
        .select("*")
        .eq("id", givenId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) return NextResponse.json({ ok: true, note: existing });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, note: data });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, body } = await request.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (typeof body === "string" && body.trim().length > VERSE_NOTE_MAX) {
    return NextResponse.json({ error: "too_long", field: "body", max: VERSE_NOTE_MAX }, { status: 400 });
  }
  const capped = capText(body, VERSE_NOTE_MAX);
  if (!capped) return NextResponse.json({ error: "empty body" }, { status: 400 });

  const { error } = await supabase
    .from("verse_notes")
    .update({ body: capped })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
