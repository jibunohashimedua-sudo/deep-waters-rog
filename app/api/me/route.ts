import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_NAME_MAX, PROFILE_BIO_MAX, capText } from "@/lib/limits";
import { checkNickname } from "@/lib/nickname";

/**
 * Update the current user's own profile.
 *
 * `/me/edit` used to call `supabase.from("profiles").upsert(...)` directly,
 * which trusted the client to trim and cap. Postgres text columns have no
 * length ceiling, so a curl call could write a 10 000-char bio and break
 * every card that renders it. This route holds the cap.
 *
 * Photo upload stays on the client — `/me/edit` writes to the `avatars`
 * bucket with its own storage RLS and hands the resulting public URL here
 * as `photo_url`.
 */
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  if (typeof body.name === "string" && body.name.trim().length > PROFILE_NAME_MAX) {
    return NextResponse.json({ error: "too_long", field: "name", max: PROFILE_NAME_MAX }, { status: 400 });
  }
  if (typeof body.bio === "string" && body.bio.trim().length > PROFILE_BIO_MAX) {
    return NextResponse.json({ error: "too_long", field: "bio", max: PROFILE_BIO_MAX }, { status: 400 });
  }

  const name = capText(body.name, PROFILE_NAME_MAX);
  if (!name) {
    return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
  }
  const bio = capText(body.bio, PROFILE_BIO_MAX);

  // Only the fields /me/edit knows about. Anything else in the request body
  // is ignored — no accidental role escalation via curl.
  const update: Record<string, unknown> = { name, bio };

  // The nickname goes through the same rules as the Preferences screen —
  // one place decides what a name may be, and it refuses rather than
  // quietly rewriting. `undefined` means the caller didn't mention it.
  if (body.nickname !== undefined) {
    const checked = checkNickname(body.nickname);
    if (!checked.ok) {
      return NextResponse.json(
        { error: checked.error, field: "nickname" },
        { status: 400 }
      );
    }
    update.nickname = checked.value;
  }

  if (typeof body.photo_url === "string" || body.photo_url === null) {
    update.photo_url = body.photo_url;
  }
  if (typeof body.email_reminders === "boolean") {
    update.email_reminders = body.email_reminders;
  }
  if (typeof body.push_reminders === "boolean") {
    update.push_reminders = body.push_reminders;
  }
  if (typeof body.reminder_hour === "number" && body.reminder_hour >= 0 && body.reminder_hour <= 23) {
    update.reminder_hour = body.reminder_hour;
  }
  if (typeof body.preferred_bible_id === "string") {
    update.preferred_bible_id = body.preferred_bible_id;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);
  if (error) {
    // The nickname column arrives with 2026_09_18. Until it is applied,
    // say so plainly rather than showing a Postgres message.
    if (/column .*nickname|schema cache/i.test(error.message)) {
      console.error("[deep-waters] nickname column missing:", error.message);
      return NextResponse.json(
        { error: "Names aren't available on this deployment yet.", field: "nickname" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
