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

  const { data: existing } = await supabase
    .from("reactions")
    .select("completion_id")
    .eq("completion_id", completion_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("completion_id", completion_id).eq("user_id", user.id);
    return NextResponse.json({ ok: true, reacted: false });
  } else {
    await supabase.from("reactions").insert({ completion_id, user_id: user.id });
    return NextResponse.json({ ok: true, reacted: true });
  }
}
