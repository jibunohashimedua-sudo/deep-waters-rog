import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Refreshing here rotates the refresh token: the old one stops working the
  // moment this call succeeds. The new pair is written onto `response`, so any
  // reply that isn't `response` has to carry those cookies over or the browser
  // keeps a refresh token that's already dead — and the next visit signs them
  // out. That's what this helper is for; never plain `NextResponse.redirect`.
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) {
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
