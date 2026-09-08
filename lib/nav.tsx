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

const iconClass = "w-[19px] h-[19px]";

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
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2V5Z" />
        <path d="M9 7h5M9 11h5" />
      </svg>
    )
  },
  {
    href: "/bible",
    label: "Bible",
    match: (p) => p === "/bible" || p.startsWith("/bible/"),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H5.5A1.5 1.5 0 0 0 4 20V4.5Z" />
        <path d="M11.5 7.5v6M9 10h5" />
      </svg>
    )
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
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.2" />
        <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
        <path d="M15 19c0-1.9 1.6-3.5 4-3.5s2 .8 2 2" />
      </svg>
    )
  },
  {
    href: "/depth",
    label: "Depth",
    match: (p) =>
      p === "/depth" ||
      p.startsWith("/depth/") ||
      p === "/me" ||
      p.startsWith("/me/"),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    )
  }
];

export const MORE_ICON = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18" cy="12" r="1.6" />
  </svg>
);

/**
 * The routes that live behind More rather than under a tab: the rows in
 * the sheet, and Admin. Kept beside the tabs so More lights up for its
 * own pages on both bars.
 */
export function moreMatches(pathname: string): boolean {
  return (
    pathname.startsWith("/announcements") ||
    pathname.startsWith("/testimonials") ||
    pathname.startsWith("/sermons") ||
    pathname.startsWith("/admin")
  );
}
