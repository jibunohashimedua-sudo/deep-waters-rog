import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { READING_PLAN, currentDayNumber, formatReading } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";
import Nav from "@/components/Nav";
import ReflectionForm from "@/components/ReflectionForm";
import NudgeBanner from "@/components/NudgeBanner";
import Greeting from "@/components/Greeting";
import DayHeader from "@/components/DayHeader";
import ChapterTicker from "@/components/ChapterTicker";
import TimezoneNotice from "@/components/TimezoneNotice";

/**
 * Any day, 1–90.
 *
 * The single canonical route for the day view. /today is a redirect to
 * /day/{currentDay}, so both URLs work and every day has its own link.
 * A day past 90 or below 1 (or non-numeric) is silently corrected to the
 * reader's own current day rather than 404ing — a shared link is worth
 * more than a strict error.
 *
 * Past days are fully editable (mark complete, save reflection); future
 * days are readable but the reflection form's Save button is disabled and
 * a small note tells you when it opens. The /api/complete endpoint enforces
 * the same rule server-side.
 */
export default async function DayPage({
  params
}: {
  params: { n: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + every completion + today's Rhapsody in parallel. Same
  // pattern the old /today used, since nothing else has changed there.
  const [profileResult, completionsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("completions")
      .select("day_number, verse_reference, verse_text, reflection, is_full")
      .eq("user_id", user.id)
      .order("day_number", { ascending: false })
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");

  const currentDay = currentDayNumber(profile.start_date, todayForCurrentRequest());

  // Validate the URL day. Anything wrong sends the reader to their own
  // current day rather than to an error page — a stale bookmark from before
  // the plan reset is not the reader's problem.
  const asked = Number.parseInt(params.n, 10);
  if (!Number.isFinite(asked) || asked < 1 || asked > 90) {
    redirect(`/day/${currentDay}`);
  }
  const day = asked;
  const reading = READING_PLAN[day - 1];

  const isCurrent = day === currentDay;
  const isFuture = day > currentDay;
  const isPast = day < currentDay;

  const { data: completions, error: completionsError } = completionsResult;
  if (completionsError) {
    console.error("[deep-waters] completions lookup:", completionsError.message);
  }

  // doneDays only counts fully-read days now (is_full=true). A day with
  // some ticks and no reflection isn't in this set — it's a partial, and
  // the Depth grid draws it differently, but it doesn't count as kept.
  const doneDays = new Set(
    (completions ?? [])
      .filter((c) => c.is_full !== false)
      .map((c) => c.day_number)
  );
  const existing = (completions ?? []).find((c) => c.day_number === day) ?? null;
  const existingIsFull = existing?.is_full !== false;

  // Streak still counts back from today, or yesterday when today isn't in
  // yet — the streak is a fact about the reader, not about the day being
  // read. Kept the same behaviour so the greeting on the current day still
  // makes sense.
  let streak = 0;
  for (let d = doneDays.has(currentDay) ? currentDay : currentDay - 1; d >= 1 && doneDays.has(d); d--) {
    streak++;
  }
  const returning = doneDays.size > 0 && !doneDays.has(currentDay) && !doneDays.has(currentDay - 1);

  // The date this day maps to for the reader — for the "you can save this
  // on …" line on a future day, and for looking up the Rhapsody article
  // that was set on a past day.
  const dayDate = new Date(profile.start_date);
  dayDate.setUTCHours(0, 0, 0, 0);
  dayDate.setUTCDate(dayDate.getUTCDate() + (day - 1));
  const dayDateIso = dayDate.toISOString().slice(0, 10);
  const dayDateHuman = dayDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long"
  });

  // Rhapsody for this day's actual date. Missing rows are the normal case
  // (unmapped day, or a future day the admin hasn't scheduled yet) — the
  // tile just doesn't render.
  const { data: rhapsody } = await supabase
    .from("rhapsody_days")
    .select("title")
    .eq("date", dayDateIso)
    .maybeSingle();

  // Chapter ticks for this day — the ChapterTicker seeds itself with
  // whatever the reader has already marked so a page reload isn't a
  // fresh slate.
  const { data: ticksRows } = await supabase
    .from("chapter_reads")
    .select("book, chapter")
    .eq("user_id", user.id)
    .eq("day_number", day);
  const initialTicks = new Set(
    (ticksRows ?? []).map((r) => `${r.book}|${r.chapter}`)
  );
  const otChapters = reading.ot.map((c) => ({
    book: c.book,
    chapter: c.chapter,
    testament: "ot" as const
  }));
  const ntChapters = reading.nt.map((c) => ({
    book: c.book,
    chapter: c.chapter,
    testament: "nt" as const
  }));
  const allDayChapters = [...otChapters, ...ntChapters];

  // A small "N/M" chip on each testament's tile — a partly-read day
  // looks different from an untouched one from the day view too, not
  // just on the Depth grid.
  const otTicksCount = otChapters.filter((c) =>
    initialTicks.has(`${c.book}|${c.chapter}`)
  ).length;
  const ntTicksCount = ntChapters.filter((c) =>
    initialTicks.has(`${c.book}|${c.chapter}`)
  ).length;

  const otRef = formatReading(reading.ot);
  const ntRef = formatReading(reading.nt);

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
        {/* One-time notice about the timezone-drift fix. Self-retires two
            weeks after deploy — see components/TimezoneNotice.tsx. */}
        <TimezoneNotice />

        {/* Chrome: previous day, this day (opens the picker), next day,
            and a quiet "back to today" pill when off-day. */}
        <DayHeader day={day} currentDay={currentDay} doneDays={doneDays} />

        {/* Greeting only on your current day. On other days a quieter mono
            line names the date without pretending it's today. */}
        {isCurrent ? (
          <Greeting
            name={profile.name}
            day={day}
            completedToday={existingIsFull && !!existing}
            streak={streak}
            returning={returning}
          />
        ) : (
          <p className="kicker">
            {isFuture ? "Reading ahead" : "Catching up"} · {dayDateHuman}
          </p>
        )}

        {isCurrent && <NudgeBanner completed={existingIsFull && !!existing} day={day} />}

        {/* The gauge always marks the reader's current day, whichever day
            they happen to be reading — it is a report about them, not
            about the day on screen. A viewed day that isn't today gets a
            hairline outline on its own cell so the eye can find it too. */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="kicker kicker-strong">Day {day}</h1>
            <span className="kicker">
              of 90 · {Math.max(0, 90 - currentDay)} to go
            </span>
          </div>
          <div className="gauge mt-2" role="img" aria-label={`Day ${day} of 90`}>
            <div className="gauge-fill" style={{ width: `${(currentDay / 90) * 100}%` }} />
            <div
              className="gauge-today"
              data-kept={doneDays.has(currentDay) ? "true" : undefined}
              style={{ left: `calc(${(currentDay / 90) * 100}% - 1px)` }}
              aria-hidden
            />
            {!isCurrent && (
              <div
                className="gauge-today"
                style={{
                  left: `calc(${(day / 90) * 100}% - 1px)`,
                  background: "transparent",
                  boxShadow: "inset 0 0 0 1px var(--accent)"
                }}
                aria-hidden
              />
            )}
          </div>
          {existingIsFull && existing && isCurrent && (
            <div className="mt-3">
              <span className="kept-chip" aria-label="Reflection saved for today">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Kept
              </span>
            </div>
          )}
          {existingIsFull && existing && !isCurrent && (
            <div className="mt-3">
              <span className="kept-chip">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Kept
              </span>
            </div>
          )}
        </div>

        {/* Readings. The /read page carries the day through as ?d= so any
            day's chapters land here. Each row now shows how much of that
            testament's chapters have been ticked. */}
        <div className="read-list">
          <Link href={`/read?t=ot&d=${day}`} className="read-row select-none">
            <span className="kicker">OT</span>
            <span>
              <span className="read-ref block">{otRef}</span>
              <span className="kicker block mt-1">
                Old Testament
                {otChapters.length > 0 && ` · ${otTicksCount}/${otChapters.length}`}
              </span>
            </span>
            <span className="read-arrow" aria-hidden>&rarr;</span>
          </Link>
          <Link href={`/read?t=nt&d=${day}`} className="read-row select-none">
            <span className="kicker">NT</span>
            <span>
              <span className="read-ref block">{ntRef}</span>
              <span className="kicker block mt-1">
                New Testament
                {ntChapters.length > 0 && ` · ${ntTicksCount}/${ntChapters.length}`}
              </span>
            </span>
            <span className="read-arrow" aria-hidden>&rarr;</span>
          </Link>
          {rhapsody && isCurrent && (
            <Link href="/rhapsody" className="read-row select-none">
              <span className="kicker">RoR</span>
              <span>
                <span className="read-ref block">
                  {rhapsody.title?.trim() || "Today’s article"}
                </span>
                <span className="kicker block mt-1">Rhapsody of Realities</span>
              </span>
              <span className="read-arrow" aria-hidden>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Chapter progress — ticks auto-complete the day when they hit
            the total. On a future day the ticker is disabled with a note
            (the API refuses too, so nobody can sneak ahead). */}
        <div className="mt-16">
          <ChapterTicker
            dayNumber={day}
            chapters={allDayChapters}
            initialTicks={initialTicks}
            disabled={isFuture}
            disabledReason={
              isFuture ? `You can tick these on ${dayDateHuman}.` : undefined
            }
          />
        </div>

        {/* Reflection. Future days show it disabled with a note; past and
            current days save through the same endpoint, which upserts by
            (user, day) so re-saving is fine. */}
        <div className="mt-16">
          <ReflectionForm
            dayNumber={day}
            existing={existing ?? null}
            userName={profile.name}
            userPhoto={profile.photo_url}
            future={isFuture}
            futureDate={isFuture ? dayDateHuman : null}
          />
        </div>
      </main>
    </>
  );
}
