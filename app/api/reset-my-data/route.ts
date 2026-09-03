import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lets a user wipe their own activity so they can start fresh.
// Only ever touches the signed-in user's own rows.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You are not signed in" }, { status: 401 });

  const { scope } = await request.json().catch(() => ({ scope: "all" }));
  const uid = user.id;

  // Order matters a little: comments/reactions reference completions, but they
  // are keyed by user_id too, so deleting the user's own rows in any order is fine.
  const results: Record<string, string> = {};

  async function del(table: string, column = "user_id") {
    const { error } = await supabase.from(table).delete().eq(column, uid);
    results[table] = error ? `error: ${error.message}` : "ok";
  }

  if (scope === "all" || scope === "activity") {
    await del("reactions");
    await del("comments");
    await del("completions");
    await del("prayer_prayed");
    await del("prayer_requests");
    await del("badges");
    await del("testimonials");
    await del("mentions", "mentioned_user_id");
    await del("notifications");
  }

  const anyError = Object.values(results).some((v) => v.startsWith("error"));
  return NextResponse.json({ ok: !anyError, results });
}
