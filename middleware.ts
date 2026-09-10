import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isBlockedForPrivateMember } from "@/lib/privacy";
import { PROFILE_HEADER, NO_PROFILE, encodeProfile } from "@/lib/requestProfile";

/** Cap for the Supabase auth roundtrip inside middleware. A stalled Supabase
    used to drag every in-flight navigation; now we give up, send them to the
    login page (for pages) or a JSON 401 (for /api/*), and let them retry. */
const AUTH_TIMEOUT_MS = 4000;
const AUTH_TIMEOUT = Symbol("auth-timeout");

const PUBLIC_PATHS = [
  "/",
  // The landing page's main call to action points here, and it's the intro
  // carousel that hands off to /signup on its last slide — so it has to be
  // reachable signed out. It wasn't, which bounced every new arrival to the
  // login page instead of letting them join.
  "/welcome",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api/og",
  "/c",
  // Attribution for the CC BY datasets behind the Bench. A licence
  // condition met behind a login is not met.
  "/sources"
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Whatever the client sent under our own header name is thrown away here,
  // before anything reads it, on every path including the public ones. The
  // only value a render can ever see is one this function put there.
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete(PROFILE_HEADER);

  // Public routes don't need a refreshed session to be served, and paying a
  // Supabase round-trip on every hit to /api/og, /auth/callback, /c/<slug>,
  // /welcome, /login, /signup, etc. was the biggest lever on perceived
  // navigation latency across the app. Serve them straight through.
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  // Cookies the Supabase client wants written. Collected rather than applied
  // as they arrive, because the response is built once at the end — it has to
  // carry the forwarded profile header as well, and a response created inside
  // the callback would not have it.
  let pending: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
            forwardHeaders.set("cookie", request.cookies.toString());
          });
          pending = pending.concat(cookiesToSet);
        }
      }
    }
  );

  /** Every reply out of this function goes through here.
   *
   *  Refreshing rotates the refresh token: the old one stops working the
   *  moment getUser() succeeds. The new pair has to ride on whatever we
   *  actually return, or the browser keeps a refresh token that is already
   *  dead and the next visit signs them out. That is what this is for;
   *  never a plain NextResponse. */
  const withCookies = <T extends NextResponse>(res: T): T => {
    pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };
  const forward = () =>
    withCookies(NextResponse.next({ request: { headers: forwardHeaders } }));
  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    return withCookies(NextResponse.redirect(url));
  };

  // An API call is expected to receive JSON, so an unauthenticated hit gets
  // a JSON 401 rather than a 307 HTML redirect that the client's `.json()`
  // then chokes on. Page routes still redirect so the browser lands
  // somewhere useful.
  const isApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/og");

  // Wrapped in Promise.race against a 4s deadline: a slow Supabase used to
  // drag every navigation to its knees. On timeout we don't stall; page
  // routes redirect to /login, API routes get a JSON 401.
  const raced = await Promise.race([
    supabase.auth.getUser().then((r) => r.data.user ?? null),
    new Promise<typeof AUTH_TIMEOUT>((resolve) =>
      setTimeout(() => resolve(AUTH_TIMEOUT), AUTH_TIMEOUT_MS)
    )
  ]);
  if (raced === AUTH_TIMEOUT) {
    console.error(`[deep-waters] middleware auth timeout after ${AUTH_TIMEOUT_MS}ms on ${pathname}`);
    if (isApi) {
      return withCookies(NextResponse.json({ error: "auth-timeout" }, { status: 401 }));
    }
    return redirectTo("/login");
  }
  const user = raced;

  if (!user) {
    if (isApi) {
      return withCookies(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    return redirectTo("/login");
  }

  // Check for profile completion
  if (pathname !== "/onboarding") {
    // `*` rather than a column list: is_private arrives with a migration,
    // and a named select for a column that isn't there yet is a 400 —
    // which this code would read as "no profile" and send the whole church
    // back through onboarding. A row without the column reads as false,
    // which is the right answer for every member but one.
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // The private member's routes. He is not shown a locked door and he is
    // not shown a message: for him these paths are 404, the same answer the
    // app gives for a path that was never built. The navigation never draws
    // them either (lib/nav.tsx) — this is the half that catches a typed URL,
    // an old bookmark and a link in a notification.
    if (profile && (profile as { is_private?: boolean }).is_private === true) {
      if (isBlockedForPrivateMember(pathname)) {
        if (isApi) {
          return withCookies(NextResponse.json({ error: "not-found" }, { status: 404 }));
        }
        return redirectTo("/today");
      }
    }

    if (!profile) {
      if (isApi) {
        // Signed in with no profile row is only reachable if onboarding was
        // interrupted or an admin removed the profile mid-session. Say so
        // in JSON so the client can surface the friendly message rather than
        // crashing on `.json()` of a 307 HTML body.
        return withCookies(NextResponse.json({ error: "profile-missing" }, { status: 401 }));
      }
      return redirectTo("/onboarding");
    }

    // The row we just paid for, handed to the render rather than fetched
    // again. See lib/requestProfile.ts — this is the whole point of it.
    forwardHeaders.set(PROFILE_HEADER, encodeProfile(profile));
  }
  // /onboarding is deliberately left with no forwarded profile: it is the one
  // route reachable both with a row and without one, and it is a client page
  // that asks for itself. No header means "ask Supabase", which is right.

  return forward();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.webmanifest$).*)"
  ]
};
