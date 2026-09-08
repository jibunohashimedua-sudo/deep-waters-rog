import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { user_id } = await request.json();
  if (!user_id || user_id === user.id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Service role client to delete from auth.users (cascades to profiles, completions, etc.)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.auth.admin.deleteUser(user_id);

  // Idempotent: if the auth user is already gone (deleted from the console
  // out of band, or two admins tapping Remove at once) we treat that as
  // success. The profile row might still be there in that case — the
  // cascade only fires when the auth-user delete actually runs — so we
  // also do a belt-and-braces cleanup here. RLS on `profiles` allows
  // service-role deletes.
  const isNotFound =
    error &&
    ((error as any).status === 404 ||
      /not\s*found|no\s*user\s*found/i.test(error.message ?? ""));

  if (error && !isNotFound) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isNotFound) {
    const { error: cleanupError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user_id);
    if (cleanupError) {
      // Log but still return success — the auth user is gone, which is
      // the state the admin was going for. A dangling profiles row is
      // recoverable by re-running the delete or clearing it by hand.
      // eslint-disable-next-line no-console
      console.error("[deep-waters] profile cleanup after gone auth user:", cleanupError.message);
    }
  }

  return NextResponse.json({ ok: true });
}
