import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { todayISOForUser } from "@/lib/dates";
import { tzForCurrentRequest } from "@/lib/serverToday";

/** How long the redirected signed URL stays good. Short by design — the
    URL is minted at click time, right before the browser follows it. */
const LINK_TTL_SECONDS = 5 * 60;

/**
 * Mint a signed URL for today's Rhapsody PDF and 302-redirect to it.
 *
 * The reader page used to mint this URL at server render, which meant
 * anyone who lingered on the page for longer than 30 minutes got a fresh
 * 403 in a new tab when they finally clicked. Now the signing happens
 * here, in response to the actual click, so the URL is always fresh.
 *
 * Requires auth: unauthenticated hits bounce off the middleware with a
 * JSON 401 (see middleware.ts).
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = todayISOForUser(tzForCurrentRequest());

  const { data: entry, error: entryError } = await supabase
    .from("rhapsody_days")
    .select("edition_id, page_number")
    .eq("date", date)
    .maybeSingle();
  if (entryError) {
    console.error("[deep-waters] rhapsody pdf entry lookup:", entryError.message);
  }
  if (!entry?.edition_id) {
    return NextResponse.json({ error: "no-article" }, { status: 404 });
  }

  const { data: edition, error: editionError } = await supabase
    .from("rhapsody_editions")
    .select("file_path")
    .eq("id", entry.edition_id)
    .maybeSingle();
  if (editionError) {
    console.error("[deep-waters] rhapsody pdf edition lookup:", editionError.message);
  }
  if (!edition?.file_path) {
    return NextResponse.json({ error: "no-file" }, { status: 404 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await service.storage
    .from("rhapsody")
    .createSignedUrl(edition.file_path, LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[deep-waters] rhapsody sign failed:", error?.message);
    return NextResponse.json({ error: "sign-failed" }, { status: 500 });
  }

  // Preserve the ?page=N fragment on the redirect so the reader lands on
  // the article page, not the front cover of the edition PDF.
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const page = Number(pageParam);
  const target =
    Number.isFinite(page) && page > 0
      ? `${data.signedUrl}#page=${page}`
      : `${data.signedUrl}#page=${entry.page_number ?? 1}`;

  return NextResponse.redirect(target, { status: 302 });
}
