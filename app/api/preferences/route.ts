import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePreference } from "@/lib/preferences";
import { checkNickname } from "@/lib/nickname";
import { TRANSLATIONS } from "@/lib/translations";

/**
 * One setting at a time.
 *
 * The preferences screen has no save button, so every control writes on
 * change and this endpoint takes one key and one value. That keeps the
 * write small enough to be instant, keeps two controls changed quickly
 * from overwriting each other with a whole-object PATCH, and means a
 * refusal names the setting it is refusing.
 *
 * Only the keys in lib/preferences and `nickname` may be written. A
 * request naming `role`, `approved` or `is_pastoral` is refused here, and
 * refused again by the guard trigger on the table if it ever got past.
 */
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "We couldn't read that." }, { status: 400 });
  }

  const key = typeof body?.key === "string" ? body.key : "";
  const value = body?.value;

  let patch: Record<string, unknown>;

  if (key === "nickname") {
    // The one field with real rules, and the one where a refusal has to
    // say what to change — see lib/nickname.ts.
    const checked = checkNickname(value);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    patch = { nickname: checked.value };
  } else if (key === "preferred_bible_id") {
    // Only editions we actually offer. An arbitrary id here would point
    // every one of this reader's chapter fetches at something we have not
    // licensed and cannot render.
    if (!TRANSLATIONS.some((t) => t.id === value)) {
      return NextResponse.json({ error: "No such translation." }, { status: 400 });
    }
    patch = { preferred_bible_id: value };
  } else {
    const checked = validatePreference(key, value);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    patch = { [key]: checked.value };
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

  if (error) {
    // The columns arrive with a migration. Between a deploy and that
    // migration this is the honest answer rather than a red error with a
    // Postgres code in it — everything else on the screen still works,
    // and the defaults are what the app was already doing.
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      console.error("[deep-waters] preferences column missing:", error.message);
      return NextResponse.json(
        { error: "That setting isn't available on this deployment yet." },
        { status: 503 }
      );
    }
    console.error("[deep-waters] preferences update:", error.message);
    return NextResponse.json({ error: "That didn't save. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...patch });
}
