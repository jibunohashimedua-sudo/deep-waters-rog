import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  "/c"
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public routes don't need a refreshed session to be served, and paying a
  // Supabase round-trip on every hit to /api/og, /auth/callback, /c/<slug>,
  // /welcome, /login, /signup, etc. was the biggest lever on perceived
  // navigation latency across the app. Serve them straight through.
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // An API call is expected to receive JSON, so an unauthenticated hit gets
  // a JSON 401 rather than a 307 HTML redirect that the client's `.json()`
  // then chokes on. Page routes still redirect so the browser lands
  // somewhere useful.
  const isApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/og");

  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Refreshing here rotates the refresh token: the old one stops working the
  // moment this call succeeds. The new pair is written onto `response`, so any
  // reply that isn't `response` has to carry those cookies over or the browser
  // keeps a refresh token that's already dead — and the next visit signs them
  // out. That's what this helper is for; never plain `NextResponse.redirect`.
  //
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
      return NextResponse.json({ error: "auth-timeout" }, { status: 401 });
    }
    return redirectTo("/login");
  }
  const user = raced;

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return redirectTo("/login");
  }

  // Check for profile completion
  if (pathname !== "/onboarding") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) {
      if (isApi) {
        // Signed in with no profile row is only reachable if onboarding was
        // interrupted or an admin removed the profile mid-session. Say so
        // in JSON so the client can surface the friendly message rather than
        // crashing on `.json()` of a 307 HTML body.
        return NextResponse.json({ error: "profile-missing" }, { status: 401 });
      }
      return redirectTo("/onboarding");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.webmanifest$).*)"
  ]
};
