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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const day = currentDayNumber(profile.start_date);
  const reading = READING_PLAN[day - 1];

  // Widened from "just today's row" to every completed day number. Still one
  // query and at most 90 tiny rows, but it also gives the greeting a streak
  // and a sense of whether someone is returning after a gap, with no extra
  // round trip.
  const { data: completions, error: completionsError } = await supabase
    .from("completions")
    .select("day_number, verse_reference, verse_text, reflection")
    .eq("user_id", user.id)
    .order("day_number", { ascending: false });
  if (completionsError) {
    console.error("[deep-waters] completions lookup:", completionsError.message);
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

  // Today's Rhapsody article, if an admin has mapped one. Plain query, no
  // join — the edition isn't needed here, only the title. A missing row is
  // the normal case on an unmapped day, so the tile just doesn't render;
  // a real error is logged rather than swallowed.
  const { data: rhapsody, error: rhapsodyError } = await supabase
    .from("rhapsody_days")
    .select("title")
    .eq("date", todayISO())
    .maybeSingle();
  if (rhapsodyError) {
    console.error("[deep-waters] rhapsody_days lookup:", rhapsodyError.message);
  }

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
        {/* Progress. The dot marks today; only shows when the day is saved. */}
        <div className="mb-10">
          <div className="flex items-center justify-between text-sm">
            <span className="kicker">Your progress</span>
            <span className="text-rog-muted">Day {day} of 90</span>
          </div>
          <div className="mt-2 relative h-2">
            <div className="absolute inset-0 bg-rog-line rounded-full overflow-hidden">
              <div
                className="h-full bg-rog-purple"
                style={{ width: `${(day / 90) * 100}%` }}
              />
            </div>
            {existing && (
              <div
                className="absolute w-3 h-3 rounded-full bg-rog-purple -top-0.5"
                style={{
                  left: `calc(${(day / 90) * 100}% - 6px)`,
                  border: "2px solid var(--bg)"
                }}
                aria-hidden
              />
            )}
          </div>
        </div>

        <p className="kicker">Today&rsquo;s Reading</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">
          Day {day}
        </h1>
        {existing && (
          <div className="mt-3">
            <span className="kept-chip" aria-label="Reflection saved for today">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Kept for today
            </span>
          </div>
        )}

        {/* Reading tiles — Level 1 (soft plate). These are navigation, not objects. */}
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Link href="/read?t=ot" className="surface-soft block hover:border-rog-purple group select-none">
            <p className="kicker">Old Testament</p>
            <p className="mt-3 font-serif text-lg text-rog-ink">{otRef}</p>
            <p className="mt-6 text-xs text-rog-muted font-semibold uppercase tracking-[0.18em] group-hover:text-rog-purple transition-colors">
              Read &rarr;
            </p>
          </Link>
          <Link href="/read?t=nt" className="surface-soft block hover:border-rog-purple group select-none">
            <p className="kicker">New Testament</p>
            <p className="mt-3 font-serif text-lg text-rog-ink">{ntRef}</p>
            <p className="mt-6 text-xs text-rog-muted font-semibold uppercase tracking-[0.18em] group-hover:text-rog-purple transition-colors">
              Read &rarr;
            </p>
          </Link>
          {/* Rhapsody sits with the two readings, not apart from them: same
              plate, same padding, same behaviour, one row lower and full
              width. No article mapped for today means no tile at all. */}
          {rhapsody && (
            <Link
              href="/rhapsody"
              className="surface-soft block tile-pink group select-none md:col-span-2"
            >
              <p className="kicker accent-pink">Rhapsody of Realities</p>
              <p className="mt-3 font-serif text-lg text-rog-ink">
                {rhapsody.title?.trim() || "Today\u2019s article"}
              </p>
              <p className="mt-6 text-xs text-rog-muted font-semibold uppercase tracking-[0.18em] group-accent-pink transition-colors">
                Read &rarr;
              </p>
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
