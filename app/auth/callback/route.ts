import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only ever redirect to a path on this site, never an absolute URL. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/today";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // No code, or the exchange failed. Don't strand them on the sign-in page:
  // the link may be carrying its session in the URL hash, which never reaches
  // the server but does survive this redirect for the client page to pick up.
  // Pages like /reset-password know how to finish the job from there.
  return NextResponse.redirect(`${origin}${next}`);
}
