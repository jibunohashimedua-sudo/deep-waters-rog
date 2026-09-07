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
