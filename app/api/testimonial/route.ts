import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TESTIMONY_MAX, capText } from "@/lib/limits";

/**
 * Submit a testimony. `approved` and `featured` default to false at the DB;
 * an admin has to flip them on `/admin/testimonials` before it appears.
 * Length cap lives here so the client `maxLength` is no longer the only
 * defence.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { body } = await request.json();
  if (typeof body === "string" && body.trim().length > TESTIMONY_MAX) {
    return NextResponse.json({ error: "too_long", field: "body", max: TESTIMONY_MAX }, { status: 400 });
  }
  const capped = capText(body, TESTIMONY_MAX);
  if (!capped) {
    return NextResponse.json({ error: "Please write something first" }, { status: 400 });
  }

  const { error } = await supabase
    .from("testimonials")
    .insert({ user_id: user.id, body: capped });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
