"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import MoreSheet from "./MoreSheet";

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: JSX.Element;
};

const iconClass = "w-[19px] h-[19px]";

const tabs: Tab[] = [
  {
    href: "/today",
    label: "Today",
    match: (p) => p === "/today" || p.startsWith("/today/") || p === "/read" || p.startsWith("/read/"),
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
      // /prayer redirects into the Community tab, so it lights up here.
      p === "/prayer" ||
      p.startsWith("/prayer/"),
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
    href: "/me",
    label: "Depth",
    match: (p) =>
      p === "/me" ||
      p.startsWith("/me/") ||
      p === "/leaderboard" ||
      p.startsWith("/leaderboard/") ||
      p === "/finishers" ||
      p.startsWith("/finishers/"),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    )
  }
];

const moreIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18" cy="12" r="1.6" />
  </svg>
);

type Props = {
  /** Both come from Nav, which has already looked them up. Fetching them again
      here cost a second getUser + profiles round trip on every page load. */
  isAdmin: boolean;
  hasUser: boolean;
};

export default function BottomNav({ isAdmin, hasUser }: Props) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Don't render on public/auth pages — or while someone is reading.
  // The reading screen is the one place in the app with a single job, and
  // a permanent bar across the foot of a page of scripture is five ways
  // to leave it. Getting out is the back arrow, which is where you came in.
  const hidden =
    !hasUser ||
    pathname === "/read" ||
    pathname.startsWith("/read/") ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/welcome");
  if (hidden) return null;

  const moreActive =
    sheetOpen ||
    pathname.startsWith("/announcements") ||
    pathname.startsWith("/testimonials") ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/admin");

  // No pill, no floating capsule, no frosted glass. The bar is ground: it
  // sits on the bottom edge with one hairline along its top, and the tab
  // you're on is marked by a 2px sonar rule on that edge (.tab-item in
  // globals.css) — the only place that colour appears in the shell.
  const itemBase =
    "tab-item flex w-full flex-col items-center justify-center gap-[5px] pt-[9px] pb-[13px]";

  return (
    <>
      <nav
        id="bottom-nav"
        aria-label="Primary"
        className="md:hidden bottom-glass fixed inset-x-0 bottom-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map((t) => {
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
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              data-active={moreActive ? "true" : undefined}
              className={itemBase}
            >
              <span>{moreIcon}</span>
              <span className="tab-label">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={sheetOpen} onClose={() => setSheetOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
