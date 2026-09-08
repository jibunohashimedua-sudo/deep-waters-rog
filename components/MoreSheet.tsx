"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import { currentDayNumber } from "@/lib/plan";

type Choice = "light" | "dark" | "system";

function applyTheme(choice: Choice) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const actual = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = actual;
  if (choice === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", choice);
}

/**
 * The sheet's icons.
 *
 * Drawn, not set in emoji. An emoji is whatever the reader's phone decides
 * it is — a different drawing on an iPhone, an Android and a Mac, at a
 * different weight and in colours this system doesn't own — so a column of
 * them matches nothing else in the app. The same argument was already
 * written next to the notification bell in Nav; this is it applied to the
 * one screen that had eight of them.
 *
 * Same hand as the tab bar: a 24 box, no fill, 1.8 stroke, round joins, and
 * no detail that dies at 19px. Where the app has a choice it draws the
 * literal thing — the prayer wall is a wall, because that is what it is
 * called and because brickwork is the same geometry as the gauge.
 */
const ICONS = {
  edit: <path d="M4 20h4L18 10l-4-4L4 16v4ZM14 6l4 4" />,
  prayer: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" />
    </>
  ),
  cohorts: (
    <>
      <circle cx="6.5" cy="9" r="2" />
      <circle cx="17.5" cy="9" r="2" />
      <circle cx="12" cy="7.5" r="2.2" />
      <path d="M3 17.5c0-2 1.6-3.4 3.5-3.4M21 17.5c0-2-1.6-3.4-3.5-3.4M8 19.5c0-2.2 1.8-3.9 4-3.9s4 1.7 4 3.9" />
    </>
  ),
  finishers: <path d="M5 21V4M5 5h11l-2 3.6L16 12.2H5" />,
  testimony: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12.3h5" />
    </>
  ),
  announcements: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M18 9.6a4 4 0 0 1 0 4.8" />
    </>
  ),
  // Two sliders, not three. Three fitted the idea of a control panel
  // better and turned into a grey smudge at 19px, which is the size it
  // actually ships at — six strokes and three knobs is more marks than a
  // 19px box can hold apart.
  admin: (
    <>
      <path d="M4 9h7M15.2 9H20M4 15h3M11.2 15H20" />
      <circle cx="13" cy="9" r="2.2" />
      <circle cx="9" cy="15" r="2.2" />
    </>
  ),
  signout: <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M19 12H9M15.5 8.5 19 12l-3.5 3.5" />
};

/** One icon, at tab-bar weight, in the quiet ink so the label leads. */
function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      className="w-[19px] h-[19px] shrink-0 text-rog-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

type Me = { name: string; photoUrl: string | null; day: number; streak: number };

export default function MoreSheet({ open, onClose, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [theme, setTheme] = useState<Choice>("system");
  const [me, setMe] = useState<Me | null>(null);

  // Who you are, fetched the first time the sheet is opened and then kept.
  // Two plain queries, no nested join — this project has had HTTP 300s out
  // of ambiguous relationships, so the streak is counted here in code.
  useEffect(() => {
    if (!open || me) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [{ data: profile, error: pErr }, { data: done, error: cErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name, photo_url, start_date")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("completions").select("day_number").eq("user_id", user.id)
        ]);
      if (cancelled) return;
      if (pErr) console.error("[deep-waters] more sheet profile:", pErr.message);
      if (cErr) console.error("[deep-waters] more sheet completions:", cErr.message);
      if (!profile) return;

      const day = currentDayNumber(profile.start_date);
      const days = new Set((done ?? []).map((c) => c.day_number));
      // Count back from today, or from yesterday when today isn't saved
      // yet, so a run isn't reported broken while the day is in progress.
      let streak = 0;
      for (let d = days.has(day) ? day : day - 1; d >= 1 && days.has(d); d--) {
        streak++;
      }
      setMe({
        name: profile.name,
        photoUrl: profile.photo_url ?? null,
        day,
        streak
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, me, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("theme") as Choice) || "system";
    setTheme(stored);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function signOut() {
    onClose();
    await supabase.auth.signOut();
    router.push("/");
  }

  function pickTheme(c: Choice) {
    setTheme(c);
    applyTheme(c);
  }

  const link =
    "flex items-center gap-3 px-4 py-3  text-sm font-medium text-rog-ink hover:bg-black/5 dark:hover:bg-white/10 transition";
  const label = "px-4 pt-4 pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-rog-muted";

  return (
    <div
      className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop — dim + soft blur so the page behind softens */}
      <button
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* Grabber */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="px-2 pb-2">
          {/* You, first. Depth is the profile, and this is the row that
              says so — portrait, name, and one mono line of where you
              are. Hairline separated, no card. */}
          {me ? (
            <Link
              href="/depth"
              onClick={onClose}
              className="person-row px-4 !border-t-0"
            >
              <Avatar
                name={me.name}
                photoUrl={me.photoUrl}
                size="lg"
                decorative
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-rog-ink truncate">
                  {me.name}
                </span>
                <span className="kicker block mt-1">
                  {`Day ${me.day} \u00b7 Streak ${me.streak}`}
                </span>
              </span>
            </Link>
          ) : (
            /* The shape of the row, held while the query is in flight.
               This used to render the real row with empty strings in it,
               which put a "?" in the portrait — the Avatar's fallback for
               a person with no name — above two blank lines. A question
               mark where your own face goes is a strange thing to show
               someone, and it was answering a question nobody asked. */
            <div className="person-row px-4 !border-t-0" aria-hidden>
              <div className="skeleton w-12 h-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-2.5 w-24 mt-2" />
              </div>
            </div>
          )}

          <Link href="/me/edit" onClick={onClose} className={`${link} border-t border-rog-line`}>
            <Icon name="edit" /> Edit profile
          </Link>

          {/* Prayer lost its own tab when Bible took a slot. It lives inside
              the Community tab now, but it stays one tap from here so nobody
              has to learn a new route to reach it. */}
          <p className={label}>Together</p>
          <Link href="/prayer" onClick={onClose} className={link}>
            <Icon name="prayer" /> Prayer wall
          </Link>

          <p className={label}>Groups</p>
          <Link href="/cohorts" onClick={onClose} className={link}>
            <Icon name="cohorts" /> Cohorts
          </Link>

          <p className={label}>Celebrate</p>
          <Link href="/finishers" onClick={onClose} className={link}>
            <Icon name="finishers" /> Finishers
          </Link>
          <Link href="/testimonials" onClick={onClose} className={link}>
            <Icon name="testimony" /> Share testimony
          </Link>

          <p className={label}>Updates</p>
          <Link href="/announcements" onClick={onClose} className={link}>
            <Icon name="announcements" /> Announcements
          </Link>

          <p className={label}>Settings</p>

          <div className="px-4 py-3">
            <p className="text-sm font-medium text-rog-ink mb-2">Theme</p>
            <div className="flex gap-1 p-1 rounded-full glass-chip">
              {(["light", "dark", "system"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickTheme(c)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full transition capitalize ${
                    theme === c
                      ? "bg-rog-purple text-white"
                      : "text-rog-muted hover:text-rog-ink"
                  }`}
                >
                  {c === "dark" ? "🌙 " : c === "light" ? "☀️ " : "🌓 "}
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={signOut} className={`${link} w-full text-left`}>
            <Icon name="signout" /> Sign out
          </button>

          {isAdmin && (
            <>
              <p className={label}>Admin</p>
              <Link href="/admin" onClick={onClose} className={link}>
                <Icon name="admin" /> Admin dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
