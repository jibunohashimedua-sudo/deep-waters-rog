"use client";
import Link from "next/link";
import LoadingRule from "@/components/LoadingRule";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
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

/**
 * The private members row, loaded only once the database has said this
 * account owns somebody. Same chunking argument as the pastoral rows.
 */
const PrivateRow = dynamic(() => import("./MoreSheetPrivateRow"), {
  ssr: false
});


type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** The Elite gate. False means the Sermons row does not exist — no
      locked row, no greyed row, nothing to notice. */
  isPastoral: boolean;
  /** A private member. The rows that lead into the church — the prayer
      wall, cohorts, the finisher wall, the testimony form and Church
      pulse — are not in the sheet for him. Not greyed, not locked: not
      there. See lib/privacy.ts. */
  isPrivate: boolean;
  /** Passed straight down to the pastoral rows, which report whether the
      current path is one of theirs. See PastoralNavHelpers. */
  onPastoralMoreMatch?: (matches: boolean) => void;
};

type Me = { name: string; photoUrl: string | null; day: number; streak: number };

export default function MoreSheet({
  open,
  onClose,
  isAdmin,
  isPastoral,
  isPrivate,
  onPastoralMoreMatch
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [me, setMe] = useState<Me | null>(null);
  // Does this account own a private member? Asked of the database, which
  // answers for the caller and nobody else — my_private_members() returns
  // rows only to the owner, so an empty array is the whole answer and the
  // other admin's copy of this sheet never learns the section exists.
  const [ownsPrivate, setOwnsPrivate] = useState(false);

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
      const [{ data: profile, error: pErr }, { data: done, error: cErr }, mine] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name, photo_url, start_date")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("completions").select("day_number").eq("user_id", user.id),
          supabase.rpc("my_private_members")
        ]);
      if (cancelled) return;
      // A missing function is a migration that hasn't run yet, which is
      // "you own nobody" — the right answer for every account but one.
      setOwnsPrivate(((mine?.data as unknown[] | null) ?? []).length > 0);
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
    // replace: signing out and pressing back should not put a signed-in
    // screen in front of somebody who has just left.
    router.replace("/");
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
        className={`sheet md:mx-auto md:max-w-md ${
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
                <span className="meta block mt-1">
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
            <div className="px-4">
              <LoadingRule label="Loading your profile" />
            </div>
          )}

          <Link href="/me/edit" onClick={onClose} className={`${link} border-t border-rog-line`}>
            Edit profile
          </Link>

          {/* Four groups, separated by a hairline each.
              
              There were six labels here — Together, Groups, Celebrate,
              Updates, Settings, Admin — and four of them announced a
              single row underneath. A label that names the one thing
              below it is the heading saying what the heading says, which
              is the one thing this system asks a label never to be. The
              rows are names, and a rule between them does all the
              grouping that was ever needed. They carried an icon each
              until the set came down to five; a row in a sheet you opened
              on purpose does not need a picture to be found.

              Prayer lost its own tab when Bible took a slot. It lives
              inside the Community tab now, but it stays one tap from here
              so nobody has to learn a new route to reach it. */}
          <div className={group}>
            {/* The pastoral rows. Above the prayer wall because they are
                the pastor's own work rather than the church's, and they
                only exist at all when the flag is on — in the bundle as
                well as on the screen. See MoreSheetPastoralRows. */}
            {isPastoral && (
              <PastoralRows
                className={link}
                onClose={onClose}
                showPulse={!isPrivate}
                onMoreMatch={onPastoralMoreMatch}
              />
            )}
            {!isPrivate && (
              <>
                <Link href="/prayer" onClick={onClose} className={link}>
                  Prayer wall
                </Link>
                <Link href="/cohorts" onClick={onClose} className={link}>
                  Cohorts
                </Link>
                <Link href="/finishers" onClick={onClose} className={link}>
                  Finishers
                </Link>
                <Link href="/testimonials" onClick={onClose} className={link}>
                  Share testimony
                </Link>
              </>
            )}
            <Link href="/announcements" onClick={onClose} className={link}>
              Announcements
            </Link>
            {ownsPrivate && <PrivateRow className={link} onClose={onClose} />}
          </div>

          <div className={group}>
            {/* Theme used to sit here as a row of three chips, and the
                translation and the reminders sat on the profile screen.
                All of them are settings about how the app behaves for one
                person, and they now live in one place — two places to
                change one setting is how the two drift apart. */}
            <Link href="/preferences" onClick={onClose} className={link}>
              Preferences
            </Link>

            {/* Public, and not gated on the Elite flag: the study data is
                credited whether or not this reader can see the lenses that
                use it. That is what the CC BY licences ask for. */}
            <Link href="/sources" onClick={onClose} className={link}>
              Sources
            </Link>

            <button type="button" onClick={signOut} className={`${link} w-full text-left`}>
              Sign out
            </button>
          </div>

          {isAdmin && (
            <div className={group}>
              <Link href="/admin" onClick={onClose} className={link}>
                Admin dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
