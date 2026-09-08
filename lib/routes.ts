/**
 * Which routes are reading screens.
 *
 * A reading screen has one job, and Fathom gives it one piece of chrome to
 * match: the sticky reading header. The app bar and the bottom tab bar both
 * stand down there — five ways to leave a page of scripture is four too
 * many, and two stacked bars at the top is one too many.
 *
 * Shared by Nav and BottomNav so the two can never disagree about which
 * screens those are, which is exactly how the tab bar came to be hidden on
 * the daily reading but not on the same chapter reached from /bible.
 */
export function isReadingRoute(pathname: string): boolean {
  if (pathname === "/read" || pathname.startsWith("/read/")) return true;
  // /bible and /bible/[book] are pickers, not reading. Reading starts at
  // /bible/[book]/[chapter], which is four segments once the leading
  // empty one is counted.
  if (pathname.startsWith("/bible/")) {
    return pathname.split("/").filter(Boolean).length >= 3;
  }
  return false;
}

/**
 * Where the one back control on a page should go.
 *
 * The app bar used to call router.back(), which is not "back" so much as
 * "wherever you happened to come from" — arriving at the devotional from a
 * notification and pressing back sent you to the notification list, and
 * arriving from a cold link sent you out of the app entirely. Every screen
 * below a tab has exactly one parent, so it is named here instead.
 *
 * null means we genuinely don't know, and the caller falls back to history.
 */
export function backHrefFor(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return null;

  switch (seg[0]) {
    // The devotional and the daily reading both hang off the day.
    case "rhapsody":
    case "read":
      return "/today";

    case "me":
      return seg.length > 1 ? "/me" : "/today";

    // /bible/[book] climbs to the book list; a chapter climbs to its book.
    // (Chapters are reading routes, where the reading header carries this
    // instead — but the answer is the same either way, and agreeing costs
    // nothing.)
    case "bible":
      if (seg.length === 2) return "/bible";
      if (seg.length >= 3) return `/bible/${seg[1]}`;
      return null;

    // /admin/notes/12 -> /admin/notes -> /admin. One segment at a time.
    case "admin":
      if (seg.length === 1) return null;
      return `/${seg.slice(0, -1).join("/")}`;

    case "cohorts":
      if (seg.length === 1) return null;
      // Managing a cohort climbs to that cohort's own page, not the list.
      if (seg.length >= 3 && seg[2] === "manage") return `/c/${seg[1]}`;
      return "/cohorts";

    case "announcements":
    case "testimonials":
    case "prayer":
      return "/today";

    default:
      return null;
  }
}
