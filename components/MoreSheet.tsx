"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import Icon from "./Icons";
import { currentDayNumber } from "@/lib/plan";
import { todayISOForUser } from "@/lib/dates";

/**
 * The two pastoral rows, fetched only when the flag is on.
 *
 * This sheet ships on every signed-in page, so anything inline here is in
 * every member's bundle whether it renders or not. Behind next/dynamic the
 * rows are their own chunk and the chunk is requested only when isPastoral
 * is true — the same rule the render already followed, now followed by the
 * network too. ssr:false because the sheet is opened by a tap; there is no
 * server render of it to take part in.
 */
const PastoralRows = dynamic(() => import("./MoreSheetPastoralRows"), {
  ssr: false
});

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

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** The Elite gate. False means the Sermons row does not exist — no
      locked row, no greyed row, nothing to notice. */
  isPastoral: boolean;
};

type Me = { name: string; photoUrl: string | null; day: number; streak: number };

export default function MoreSheet({ open, onClose, isAdmin, isPastoral }: Props) {
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

      // Client-side: browser's own timezone answers "today" directly.
      const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const day = currentDayNumber(profile.start_date, todayISOForUser(localTZ));
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

  // Counted, so a sheet opened on top of another one doesn't leave the
  // body locked when the first of them closes. See lib/useLockBodyScroll.
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
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
  /* A group of rows, set off from the one above it by a single hairline.
     This is what replaced the six uppercase section labels. */
  const group = "mt-2 pt-2 border-t border-rog-line";

  return (
    <div
      /* Not md:hidden any more. The wide-screen bar opens this same sheet
         — same rows, same theme control, same sign out — so there is one
         More in the app rather than one per bar. */
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
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
        /* On a wide screen it stops at a readable measure and centres,
           rather than running a list of six rows across a whole iPad. */
        className={`bottom-glass absolute left-0 right-0 bottom-0 md:mx-auto md:max-w-md rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
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

          {/* Four groups, separated by a hairline each.
              
              There were six labels here — Together, Groups, Celebrate,
              Updates, Settings, Admin — and four of them announced a
              single row underneath. A label that names the one thing
              below it is the heading saying what the heading says, which
              is the one thing this system asks a label never to be. The
              rows carry an icon and a name now; a rule between them does
              all the grouping that was ever needed.

              Prayer lost its own tab when Bible took a slot. It lives
              inside the Community tab now, but it stays one tap from here
              so nobody has to learn a new route to reach it. */}
          <div className={group}>
            {/* The pastoral rows. Above the prayer wall because they are
                the pastor's own work rather than the church's, and they
                only exist at all when the flag is on — in the bundle as
                well as on the screen. See MoreSheetPastoralRows. */}
            {isPastoral && <PastoralRows className={link} onClose={onClose} />}
            <Link href="/prayer" onClick={onClose} className={link}>
              <Icon name="prayer" /> Prayer wall
            </Link>
            <Link href="/cohorts" onClick={onClose} className={link}>
              <Icon name="cohorts" /> Cohorts
            </Link>
            <Link href="/finishers" onClick={onClose} className={link}>
              <Icon name="finishers" /> Finishers
            </Link>
            <Link href="/testimonials" onClick={onClose} className={link}>
              <Icon name="testimony" /> Share testimony
            </Link>
            <Link href="/announcements" onClick={onClose} className={link}>
              <Icon name="announcements" /> Announcements
            </Link>
          </div>

          <div className={group}>
            <div className="px-4 py-3">
              <p className="text-sm font-medium text-rog-ink mb-2">Theme</p>
              <div className="flex gap-1 p-1 rounded-full glass-chip">
                {(["light", "dark", "system"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickTheme(c)}
                    /* The sun, moon and half-moon that used to sit in
                       these three went the same way as the rest of the
                       sheet's emoji. The words are the label; a picture
                       of the sun in front of the word "light" was saying
                       it twice, in a typeface we don't control. */
                    className={`flex-1 py-1.5 text-xs font-medium rounded-full transition capitalize ${
                      theme === c
                        ? "bg-rog-purple text-white"
                        : "text-rog-muted hover:text-rog-ink"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={signOut} className={`${link} w-full text-left`}>
              <Icon name="signout" /> Sign out
            </button>
          </div>

          {isAdmin && (
            <div className={group}>
              <Link href="/admin" onClick={onClose} className={link}>
                <Icon name="admin" /> Admin dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
