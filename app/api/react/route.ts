import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { completion_id } = await request.json();
  if (!completion_id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: existing, error: readError } = await supabase
    .from("reactions")
    .select("completion_id")
    .eq("completion_id", completion_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  // Report what actually happened. Returning ok:true regardless meant the UI
  // could show an Amen that was never written.
  if (existing) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("completion_id", completion_id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reacted: false });
  }

  const { error } = await supabase
    .from("reactions")
    .insert({ completion_id, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reacted: true });
}
