"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";
import Avatar from "./Avatar";
import BottomNav from "./BottomNav";
import Mark from "./Mark";
import { backHrefFor, isReadingRoute } from "@/lib/routes";

// Mirrors the mobile tab bar: Prayer is a view inside Community now, so it
// isn't a separate destination here either.
const links = [
  { href: "/today", label: "Today" },
  { href: "/bible", label: "Bible" },
  { href: "/community", label: "Community" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/cohorts", label: "Cohorts" },
  { href: "/finishers", label: "Finishers" }
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [me, setMe] = useState<{ name: string; photoUrl: string | null } | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setHasUser(!!user);
      if (!user) return;
      // Widened from just the role: the bar carries the portrait now, and
      // asking for two more columns on a query already going out costs
      // nothing, where a second round trip would cost a round trip.
      const { data: p, error } = await supabase
        .from("profiles")
        .select("role, name, photo_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("[deep-waters] nav profile:", error.message);
      setIsAdmin(p?.role === "admin");
      if (p) setMe({ name: p.name, photoUrl: p.photo_url ?? null });
      const refresh = async () => {
        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);
        if (!cancelled) setUnread(count ?? 0);
      };
      refresh();
      channel = supabase.channel(`nav-notif-${user.id}-${Math.random().toString(36).slice(2, 8)}`);
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => refresh()
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const linkCls = (href: string) =>
    `px-3 py-2 rounded-full text-sm font-medium transition ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-rog-purple text-white"
        : "text-rog-ink hover:bg-rog-cream"
    }`;

  // Main tab routes never show a back button. Everything else (sub-pages
  // like /me/edit, /admin/notes, /c/slug, /read) shows one — and exactly
  // one: any page that also drew its own "back to X" link in the body has
  // had it removed, because two controls for one job is a question.
  //
  // /day/N is a main destination too, not a sub-page: /today is a
  // shortcut that redirects into it, and its own header carries the
  // prev/next arrows and the day picker, so the app-bar back would be
  // a second answer to the same question.
  const mainRoutes = ["/today", "/bible", "/community", "/leaderboard", "/cohorts", "/finishers", "/depth", "/admin", "/notifications"];
  const isDayRoute = pathname === "/day" || pathname.startsWith("/day/");
  const showBack = !mainRoutes.includes(pathname) && !isDayRoute;

  // A named destination wherever we have one, so back always means the
  // page above this one rather than whatever the history stack happens to
  // hold. History stays as the fallback for anything unmapped.
  const backHref = backHrefFor(pathname);

  // On a reading screen the sticky reading header is the only chrome, so
  // the app bar stands down rather than stacking a second bar above it.
  // BottomNav still renders — it hides itself on the same routes, and it
  // is what carries the admin flag and the sheet.
  const reading = isReadingRoute(pathname);

  return (
    <>
      {!reading && (
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {showBack &&
              (backHref ? (
                <Link
                  href={backHref}
                  className="glass-chip inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-rog-purple hover:opacity-70 transition"
                  aria-label="Go back"
                >
                  <span aria-hidden>&larr;</span>
                  <span className="hidden sm:inline">Back</span>
                </Link>
              ) : (
                <button
                  onClick={() => router.back()}
                  className="glass-chip inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-rog-purple hover:opacity-70 transition"
                  aria-label="Go back"
                >
                  <span aria-hidden>&larr;</span>
                  <span className="hidden sm:inline">Back</span>
                </button>
              ))}
            <Link href="/today" className="flex items-center gap-2">
              <Mark size={22} />
              <span className="font-bold text-rog-purple text-lg tracking-tight">Deep Waters</span>
            </Link>
          </div>

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkCls(l.href)}>{l.label}</Link>
            ))}
            {isAdmin && <Link href="/admin" className={linkCls("/admin")}>Admin</Link>}
          </nav>

          <div className="flex items-center gap-1">
            {/* Desktop-only controls */}
            <div className="hidden md:flex items-center gap-1">
              <ThemeToggle />
            </div>

            {/* Notifications bell — always visible */}
            <Link href="/notifications" className="tap-target relative p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Notifications">
              {/* Drawn, not set in emoji — an emoji is whatever the phone
                  decides it is, and it never matches the rest of the icons. */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
                <path d="M10.4 19a1.9 1.9 0 0 0 3.2 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* You. The one way into Depth from the top of any screen.
                It sits beside the bell rather than under it on Today —
                two tappable things stacked in the same corner made the
                corner ask a question it didn't need to ask.

                It replaces the desktop "Depth" text link rather than
                joining it: two ways to the same page, side by side, is
                not two ways, it is clutter. Square, per Fathom — a
                person is not a button. */}
            {me && (
              <Link
                href="/depth"
                aria-label="Your depth"
                className="tap-target ml-1 shrink-0 inline-flex"
              >
                <Avatar
                  name={me.name}
                  photoUrl={me.photoUrl}
                  size="nav"
                  decorative
                />
              </Link>
            )}

            <button onClick={signOut} className="hidden md:inline text-xs text-rog-muted hover:text-rog-purple px-2">
              Sign out
            </button>
          </div>
        </div>
      </header>
      )}

      <BottomNav isAdmin={isAdmin} hasUser={hasUser} />
    </>
  );
}

