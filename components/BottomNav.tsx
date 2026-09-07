"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MoreSheet from "./MoreSheet";

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: JSX.Element;
};

const iconClass = "w-6 h-6";

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
    href: "/community",
    label: "Community",
    match: (p) => p === "/community" || p.startsWith("/community/") || p.startsWith("/c/"),
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
    href: "/prayer",
    label: "Prayer",
    match: (p) => p === "/prayer" || p.startsWith("/prayer/"),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z" />
      </svg>
    )
  },
  {
    href: "/me",
    label: "Progress",
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

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setHasUser(!!user);
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (!cancelled) setIsAdmin(p?.role === "admin");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render on public/auth pages
  const hidden =
    !hasUser ||
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

  const itemBase =
    "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-[22px] transition-colors duration-[250ms] ease-out";
  const activePill = "text-rog-purple";
  const inactivePill = "text-rog-muted";
  const activeBg = { backgroundColor: "rgba(106, 69, 199, 0.28)" };

  return (
    <>
      <nav
        id="bottom-nav"
        aria-label="Primary"
        className="md:hidden bottom-glass fixed left-3 right-3 z-40 rounded-[28px]"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        <ul className="flex items-stretch justify-around px-1.5 py-1.5">
          {tabs.map((t) => {
            const active = t.match(pathname);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${active ? activePill : inactivePill}`}
                  style={active ? activeBg : undefined}
                >
                  <span>{t.icon}</span>
                  <span className="text-[10px] font-medium">{t.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className={`w-full ${itemBase} ${moreActive ? activePill : inactivePill}`}
              style={moreActive ? activeBg : undefined}
            >
              <span>{moreIcon}</span>
              <span className="text-[10px] font-medium">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={sheetOpen} onClose={() => setSheetOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
