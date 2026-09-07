import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/mentions";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You are not signed in" }, { status: 401 });

  const { body, cohort_id } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: "Please write something first" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("prayer_requests")
    .insert({ user_id: user.id, cohort_id: cohort_id ?? null, body: body.trim() })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mentions are a nice-to-have. If they fail, the prayer still posts.
  try {
    await recordMentions(supabase, "prayer", row.id, body, user.id);
  } catch (e) {
    console.error("mention recording failed (non-fatal):", e);
  }

  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, action, note } = await request.json();
  if (action === "pray") {
    const { data: ex, error: readError } = await supabase
      .from("prayer_prayed")
      .select("prayer_id")
      .eq("prayer_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

    if (ex) {
      const { error } = await supabase
        .from("prayer_prayed")
        .delete()
        .eq("prayer_id", id)
        .eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, prayed: false });
    }

    const { error } = await supabase
      .from("prayer_prayed")
      .insert({ prayer_id: id, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, prayed: true });
  }
  if (action === "answered") {
    const { error } = await supabase
      .from("prayer_requests")
      .update({ is_answered: true, answered_note: note ?? null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await request.json();
  const { error } = await supabase.from("prayer_requests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
