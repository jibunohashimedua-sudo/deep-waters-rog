import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/mentions";

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

  const { data: row, error } = await supabase
    .from("completions")
    .upsert(
      {
        user_id: user.id,
        day_number,
        verse_reference,
        verse_text,
        reflection,
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
