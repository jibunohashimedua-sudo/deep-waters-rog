"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isReadingRoute } from "@/lib/routes";
import { NAV_TABS, MORE_ICON, moreMatches } from "@/lib/nav";

type Props = {
  /** Both come from Nav, which has already looked them up. Fetching them again
      here cost a second getUser + profiles round trip on every page load. */
  isAdmin: boolean;
  /** The Elite gate, read once in Nav and handed down. */
  isPastoral: boolean;
  hasUser: boolean;
  /** The More sheet is owned by Nav, because the wide-screen bar opens the
      same one. Two copies of it meant two queries and two z-50 layers. */
  moreOpen: boolean;
  onOpenMore: () => void;
};

export default function BottomNav({
  isAdmin,
  isPastoral,
  hasUser,
  moreOpen,
  onOpenMore
}: Props) {
  const pathname = usePathname();

  // Don't render on public/auth pages — or while someone is reading.
  // The reading screen is the one place in the app with a single job, and
  // a permanent bar across the foot of a page of scripture is five ways
  // to leave it. Getting out is the back chevron, which is where you came
  // in — and the foot of the screen belongs to the verse toolbar now.
  //
  // This used to name /read only, so a chapter opened from the Bible tab
  // kept its tab bar and the verse toolbar landed on top of it.
  const hidden =
    !hasUser ||
    isReadingRoute(pathname) ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/welcome");
  if (hidden) return null;

  // Cohorts used to be listed here as well as under People, so it lit
  // both. It is a view inside People and nothing else now — see lib/nav.
  const moreActive = moreOpen || moreMatches(pathname);

  // No pill, no floating capsule, no frosted glass. The bar is ground: it
  // sits on the bottom edge with one hairline along its top, and the tab
  // you're on is marked by a 2px sonar rule on that edge (.tab-item in
  // globals.css) — the only place that colour appears in the shell.
  const itemBase =
    "tab-item flex w-full flex-col items-center justify-center gap-[5px] pt-[9px] pb-[13px]";

  return (
    <nav
      id="bottom-nav"
      aria-label="Primary"
      className="md:hidden bottom-glass fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {NAV_TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
                className={itemBase}
              >
                <span>{t.icon}</span>
                <span className="tab-label">{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            data-active={moreActive ? "true" : undefined}
            className={itemBase}
          >
            <span>{MORE_ICON}</span>
            <span className="tab-label">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
