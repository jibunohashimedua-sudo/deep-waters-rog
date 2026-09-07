"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "./ThemeToggle";
import BottomNav from "./BottomNav";

const links = [
  { href: "/today", label: "Today" },
  { href: "/community", label: "Community" },
  { href: "/prayer", label: "Prayer" },
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

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      setIsAdmin(p?.role === "admin");
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
  // like /me/edit, /admin/notes, /c/slug, /read) shows one.
  const mainRoutes = ["/today", "/community", "/prayer", "/leaderboard", "/cohorts", "/finishers", "/me", "/admin", "/notifications"];
  const showBack = !mainRoutes.includes(pathname);

  return (
    <>
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            {showBack && (
              <button
                onClick={() => router.back()}
                className="glass-chip inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-rog-purple hover:opacity-70 transition"
                aria-label="Go back"
              >
                <span aria-hidden>&larr;</span>
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <Link href="/today" className="flex items-center gap-2">
              <HeartLogo />
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
            <Link href="/notifications" className="relative p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Notifications">
              <span className="text-lg">🔔</span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* Desktop-only Me + Sign out */}
            <Link href="/me" className={`hidden md:inline-flex ${linkCls("/me")}`}>Me</Link>
            <button onClick={signOut} className="hidden md:inline text-xs text-rog-muted hover:text-rog-purple px-2">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <BottomNav />
    </>
  );
}

// The Deep Waters mark. Uses currentColor so a single component works in both
// themes: deep purple in light mode, warm cream in dark.
function HeartLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="dw-mark"
    >
      <rect x="18" y="24" width="64" height="11" rx="5.5" />
      <rect x="26" y="42" width="48" height="11" rx="5.5" />
      <rect x="34" y="60" width="32" height="11" rx="5.5" />
      <rect x="42" y="78" width="16" height="11" rx="5.5" />
    </svg>
  );
}
