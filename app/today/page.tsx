import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { READING_PLAN, currentDayNumber, formatReading } from "@/lib/plan";
import { todayISO } from "@/lib/rhapsody";
import Nav from "@/components/Nav";
import ReflectionForm from "@/components/ReflectionForm";
import NudgeBanner from "@/components/NudgeBanner";
import Greeting from "@/components/Greeting";

export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // These three only need the user id, not each other, so they go out
  // together. Awaited one at a time this was the single slowest thing about
  // opening the app: measured against the live database, the same three
  // queries took 981ms in sequence and 391ms in parallel.
  //
  // Widened from "just today's row" to every completed day number. Still one
  // query and at most 90 tiny rows, but it also gives the greeting a streak
  // and a sense of whether someone is returning after a gap, with no extra
  // round trip.
  const [profileResult, completionsResult, rhapsodyResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("completions")
      .select("day_number, verse_reference, verse_text, reflection")
      .eq("user_id", user.id)
      .order("day_number", { ascending: false }),
    // Today's Rhapsody article, if an admin has mapped one. Plain query, no
    // join — the edition isn't needed here, only the title. A missing row is
    // the normal case on an unmapped day, so the tile just doesn't render;
    // a real error is logged rather than swallowed.
    supabase.from("rhapsody_days").select("title").eq("date", todayISO()).maybeSingle()
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");

  const day = currentDayNumber(profile.start_date);
  const reading = READING_PLAN[day - 1];

  const { data: completions, error: completionsError } = completionsResult;
  if (completionsError) {
    console.error("[deep-waters] completions lookup:", completionsError.message);
  }
  const { data: rhapsody, error: rhapsodyError } = rhapsodyResult;
  if (rhapsodyError) {
    console.error("[deep-waters] rhapsody_days lookup:", rhapsodyError.message);
  }

  const doneDays = new Set((completions ?? []).map((c) => c.day_number));
  const existing = (completions ?? []).find((c) => c.day_number === day) ?? null;

  // Count back from today, or from yesterday when today isn't saved yet, so a
  // run isn't reported as broken just because the day is still in progress.
  let streak = 0;
  for (let d = doneDays.has(day) ? day : day - 1; d >= 1 && doneDays.has(d); d--) {
    streak++;
  }

  // Has history, but nothing recent. Used only to say hello more warmly —
  // the size of the gap is never surfaced.
  const returning = doneDays.size > 0 && !doneDays.has(day) && !doneDays.has(day - 1);

  const otRef = formatReading(reading.ot);
  const ntRef = formatReading(reading.nt);

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
        <Greeting
          name={profile.name}
          day={day}
          completedToday={!!existing}
          streak={streak}
          returning={returning}
        />
        <NudgeBanner completed={!!existing} day={day} />
        {/* The gauge. The mark is a sounding line, so the ninety days are
            drawn as a scale with ticks and an upright on today, read the
            way a depth is read — not as a capsule filling up. The upright
            turns sonar green once the day is kept. */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="kicker kicker-strong">Day {day}</h1>
            <span className="kicker">
              of 90 &middot; {90 - day} to go
            </span>
          </div>
          <div className="gauge mt-2" role="img" aria-label={`Day ${day} of 90`}>
            <div className="gauge-fill" style={{ width: `${(day / 90) * 100}%` }} />
            <div
              className="gauge-today"
              data-kept={existing ? "true" : undefined}
              style={{ left: `calc(${(day / 90) * 100}% - 1px)` }}
              aria-hidden
            />
          </div>
          {existing && (
            <div className="mt-3">
              <span className="kept-chip" aria-label="Reflection saved for today">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Kept
              </span>
            </div>
          )}
        </div>

        {/* The three readings. They were three plates in a grid, each with a
            kicker over it; they are one list now — mono index, the reference
            in the reading serif, the testament underneath rather than above.
            No article mapped for today means no third row at all. */}
        <div className="read-list">
          <Link href="/read?t=ot" className="read-row select-none">
            <span className="kicker">OT</span>
            <span>
              <span className="read-ref block">{otRef}</span>
              <span className="kicker block mt-1">Old Testament</span>
            </span>
            <span className="read-arrow" aria-hidden>&rarr;</span>
          </Link>
          <Link href="/read?t=nt" className="read-row select-none">
            <span className="kicker">NT</span>
            <span>
              <span className="read-ref block">{ntRef}</span>
              <span className="kicker block mt-1">New Testament</span>
            </span>
            <span className="read-arrow" aria-hidden>&rarr;</span>
          </Link>
          {rhapsody && (
            <Link href="/rhapsody" className="read-row select-none">
              <span className="kicker">RoR</span>
              <span>
                <span className="read-ref block">
                  {rhapsody.title?.trim() || "Today\u2019s article"}
                </span>
                <span className="kicker block mt-1">Rhapsody of Realities</span>
              </span>
              <span className="read-arrow" aria-hidden>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Reflection */}
        <div className="mt-16">
          <ReflectionForm
            dayNumber={day}
            existing={existing ?? null}
            userName={profile.name}
            userPhoto={profile.photo_url}
          />
        </div>
      </main>
    </>
  );
}
