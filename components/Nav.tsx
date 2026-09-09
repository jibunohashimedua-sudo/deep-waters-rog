"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import BottomNav from "./BottomNav";
import MoreSheet from "./MoreSheet";
import Mark from "./Mark";
import EliteLockup from "./EliteLockup";
import { backHrefFor, isReadingRoute } from "@/lib/routes";
import { navTabsFor, MORE_ICON, moreMatches } from "@/lib/nav";
import PreferencesApply from "./PreferencesApply";
import PreferencesNudge from "./PreferencesNudge";
import { readPreferences, type Preferences } from "@/lib/preferences";

// The wide-screen bar and the phone's tab bar read the same list — see
// lib/nav.tsx for why. There used to be a second list here naming
// Leaderboard, Cohorts and Finishers as top-level sections; all three are
// views inside People, and had been for three refactors.

/**
 * Who you are, remembered for the length of the tab.
 *
 * Nav is rendered by each page rather than by the layout, so it mounts
 * again on every navigation and its profile query runs again with it.
 * That was invisible while the query only decided whether an Admin row
 * appeared inside a sheet. It stopped being invisible once it decides how
 * many tabs the bar has: a private member would have watched a People tab
 * appear and vanish on every screen he opened.
 *
 * Module scope, not localStorage: it is per tab, it dies with the tab, and
 * it is null during the server render and null again on the first client
 * render after a hard load — so there is nothing for hydration to
 * disagree about. The bar holds still for one query on a cold load and is
 * instant for every navigation after it.
 */
let cachedNav: { isAdmin: boolean; isPastoral: boolean; isPrivate: boolean } | null = null;

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(() => cachedNav?.isAdmin ?? false);
  // The Elite gate, read in the same breath as the role so there is one
  // place in the client that decides who is pastoral.
  const [isPastoral, setIsPastoral] = useState(() => cachedNav?.isPastoral ?? false);
  // The private member's shape of the app. The bar holds still until this
  // is known rather than drawing a People tab and taking it away a beat
  // later — see cachedNav above.
  const [isPrivate, setIsPrivate] = useState(() => cachedNav?.isPrivate ?? false);
  const [ready, setReady] = useState(() => cachedNav !== null);
  // Reported up by the pastoral rows in the More sheet, which are the only
  // place that knows those routes' names. False for everyone else, because
  // for everyone else the component that would set it never mounts.
  const [pastoralMore, setPastoralMore] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [me, setMe] = useState<{ name: string; photoUrl: string | null } | null>(null);
  // The reader's own settings, applied to the document wherever they are
  // signed in. Read off the profile query already going out below rather
  // than costing a second one.
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  // Members who were here before Preferences existed get one quiet
  // pointer at it. `null` means we don't know yet and show nothing.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

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
      // asking for more columns on a query already going out costs nothing,
      // where a second round trip would cost a round trip.
      //
      // `*` rather than a column list on purpose. is_pastoral arrives with a
      // migration, and a named select for a column that isn't there yet is a
      // 400 that would take the name and the portrait down with it. A row
      // without the column simply reads as false, which is the right answer
      // for every member and for the minutes between a deploy and a
      // migration.
      const { data: p, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error("[deep-waters] nav profile:", error.message);
      cachedNav = {
        isAdmin: p?.role === "admin",
        isPastoral: p?.is_pastoral === true,
        isPrivate: p?.is_private === true
      };
      setIsAdmin(cachedNav.isAdmin);
      setIsPastoral(cachedNav.isPastoral);
      setIsPrivate(cachedNav.isPrivate);
      setReady(true);
      if (p) setMe({ name: p.name, photoUrl: p.photo_url ?? null });
      if (p) {
        setPrefs(readPreferences(p as Record<string, unknown>));
        // Absent column reads as "not seen" and the prompt shows once;
        // dismissing it remembers in the browser too, so a deployment
        // that is ahead of its migration still can't nag anybody twice.
        setIntroSeen(p.prefs_intro_seen === true);
      }
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

  // Highlighted or not — nothing else. Which section you are in is the
  // section's own `match`, shared with the tab bar, rather than a prefix
  // test on the href: /community?view=leaderboard is People, and a path
  // test could only ever have told you it was /community.
  const linkCls = (active: boolean) =>
    `px-3 py-2 rounded-full text-sm font-medium transition ${
      active ? "bg-rog-purple text-white" : "text-rog-ink hover:bg-rog-cream"
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

  // One list for both bars, narrowed for a private member.
  const tabs = navTabsFor(isPrivate);

  return (
    <>
      {!reading && (
      <header className="glass-nav safe-top-bar sticky top-0 z-40">
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
            {/* The one always-on signal that Elite is active. Same size,
                same place, same tokens as the standard lockup — it is the
                same app with more in it. A member never sees it. */}
            <Link href="/today" className="flex items-center gap-2 text-rog-purple">
              {isPastoral ? (
                <EliteLockup size={22} />
              ) : (
                <>
                  <Mark size={22} />
                  <span className="font-bold text-rog-purple text-lg tracking-tight">Deep Waters</span>
                </>
              )}
            </Link>
          </div>

          {/* Wide screens. The same sections as the tab bar, in the same
              order, under the same names — including More, which opens the
              same sheet and carries the same rows. Admin lives in there,
              where the phone has always kept it. */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
            {(ready ? tabs : []).map((t) => {
              const active = t.match(pathname);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={linkCls(active)}
                >
                  {t.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`${linkCls(moreOpen || moreMatches(pathname) || pastoralMore)} inline-flex items-center gap-1.5`}
            >
              <span className="[&>svg]:w-4 [&>svg]:h-4">{MORE_ICON}</span>
              More
            </button>
          </nav>

          <div className="flex items-center gap-1">
            {/* Notifications bell — always visible */}
            {/* A word, not a bell. The app has five icons and a bell is
                not one of them — and "Alerts 3" tells you more than a
                drawing with a dot on it ever did. */}
            <Link
              href="/notifications"
              className="tap-target meta px-2 py-2 hover:text-rog-ink"
              aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
            >
              Alerts{unread > 0 ? ` ${unread > 9 ? "9+" : unread}` : ""}
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

            {/* Theme and Sign out used to sit here as well as in the More
                sheet — the same two controls twice on a wide screen, and a
                second place for them to drift. They are in More now, which
                is where they are on the phone. */}
          </div>
        </div>
      </header>
      )}

      {prefs && <PreferencesApply prefs={prefs} />}

      {hasUser && introSeen === false && (
        <PreferencesNudge onDone={() => setIntroSeen(true)} />
      )}

      <BottomNav
        isAdmin={isAdmin}
        tabs={tabs}
        ready={ready}
        pastoralMore={pastoralMore}
        hasUser={hasUser}
        moreOpen={moreOpen}
        onOpenMore={() => setMoreOpen(true)}
      />

      {/* One sheet for both bars. Same component, same rows, so the two
          can't offer different things behind the same word — and only one
          of it in the tree, so opening it doesn't run its query twice. */}
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        isAdmin={isAdmin}
        isPastoral={isPastoral}
        isPrivate={isPrivate}
        onPastoralMoreMatch={setPastoralMore}
      />
    </>
  );
}

