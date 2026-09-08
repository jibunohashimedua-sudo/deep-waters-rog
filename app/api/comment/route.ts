import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/mentions";
import { COMMENT_MAX, capText } from "@/lib/limits";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { completion_id, body } = await request.json();
  if (!completion_id || !body?.trim()) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body.trim().length > COMMENT_MAX) {
    return NextResponse.json({ error: "too_long", field: "body", max: COMMENT_MAX }, { status: 400 });
  }
  const capped = capText(body, COMMENT_MAX);
  if (!capped) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: row, error } = await supabase
    .from("comments")
    .insert({ completion_id, user_id: user.id, body: capped })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await recordMentions(supabase, "comment", row.id, capped, user.id);
  } catch (e) {
    console.error("mention recording failed (non-fatal):", e);
  }
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await request.json();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
