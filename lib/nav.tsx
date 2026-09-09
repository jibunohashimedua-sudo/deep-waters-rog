/**
 * The app's top-level sections. One list, used by both bars.
 *
 * There were two lists. The phone's tab bar said Today, Bible, People,
 * Depth, More; the wide-screen bar said Today, Bible, Community,
 * Leaderboard, Cohorts, Finishers, Admin. The second one had been left
 * behind by three refactors: Leaderboard, Cohorts and Finishers stopped
 * being pages of their own some time ago — all three are now views inside
 * People, and /leaderboard, /cohorts and /finishers are redirect stubs
 * pointing at `/community?view=…`.
 *
 * So on an iPad you got seven top-level items for four sections, three of
 * them leading to a page that then highlighted a different item. Tapping
 * Leaderboard landed you on People with Leaderboard sitting there
 * unhighlighted beside it, because by then the path really was /community.
 *
 * Both bars read this file now. A section can't exist in one and not the
 * other, and `match` — which decides what is highlighted — is written once
 * per section rather than once per bar, so the two can't disagree about
 * where you are either.
 *
 * Admin isn't here. It has never been a section; it is a row in the More
 * sheet, which is where the phone has always kept it.
 */

import Icon from "@/components/icons";

export type NavTab = {
  href: string;
  label: string;
  /** Every path that counts as being in this section. */
  match: (pathname: string) => boolean;
  icon: JSX.Element;
};

export const NAV_TABS: NavTab[] = [
  {
    href: "/today",
    label: "Today",
    match: (p) =>
      p === "/today" ||
      p.startsWith("/today/") ||
      p === "/read" ||
      p.startsWith("/read/") ||
      // Every plan day lives at /day/N now — /today is a shortcut into it.
      p === "/day" ||
      p.startsWith("/day/"),
    icon: <Icon name="today" />
  },
  {
    href: "/bible",
    label: "Bible",
    match: (p) => p === "/bible" || p.startsWith("/bible/"),
    icon: <Icon name="bible" />
  },
  {
    href: "/community",
    label: "People",
    match: (p) =>
      p === "/community" ||
      p.startsWith("/community/") ||
      p.startsWith("/c/") ||
      // Everything that redirects into People — prayer wall, leaderboard,
      // finisher wall, cohorts list, and the cohort management flow — lights
      // up here now.
      p === "/prayer" ||
      p.startsWith("/prayer/") ||
      p === "/leaderboard" ||
      p.startsWith("/leaderboard/") ||
      p === "/finishers" ||
      p.startsWith("/finishers/") ||
      p === "/cohorts" ||
      p.startsWith("/cohorts/"),
    icon: <Icon name="people" />
  },
  {
    href: "/depth",
    label: "Depth",
    match: (p) =>
      p === "/depth" ||
      p.startsWith("/depth/") ||
      p === "/me" ||
      p.startsWith("/me/"),
    icon: <Icon name="depth" />
  }
];

export const MORE_ICON = <Icon name="more" />;

/**
 * The sections this reader gets.
 *
 * A private member has no People tab. Not a greyed one and not one that
 * leads to an empty page — the tab simply is not in the list, so the bar
 * draws four items instead of five and nothing about the shape of the app
 * says a fifth was removed. The routes behind it are turned away in the
 * middleware; this is the half that means he never reaches for them.
 *
 * Everything else is untouched: Today, Bible and Depth are his, and the
 * Bench sits inside Bible where it always has.
 */
export function navTabsFor(isPrivate: boolean): NavTab[] {
  if (!isPrivate) return NAV_TABS;
  return NAV_TABS.filter((t) => t.href !== "/community");
}

/**
 * The routes that live behind More rather than under a tab: the rows in
 * the sheet, and Admin. Kept beside the tabs so More lights up for its
 * own pages on both bars.
 *
 * This function names no pastoral route, deliberately. It is imported by
 * Nav and BottomNav, which ship on every signed-in page, so a route named
 * here is a route every member can read out of their own bundle —
 * "/sermons" used to be, and was the second of the two leaks the
 * excellence pass closed. ELITE_EXCELLENCE_AUDIT P2-J.
 *
 * The pastoral half of this answer comes from MoreSheetPastoralRows, which
 * reports its own matches and only exists behind the flag. See
 * components/PastoralNavHelpers.tsx.
 */
export function moreMatches(pathname: string): boolean {
  return (
    pathname.startsWith("/announcements") ||
    pathname.startsWith("/testimonials") ||
    pathname.startsWith("/admin")
  );
}
