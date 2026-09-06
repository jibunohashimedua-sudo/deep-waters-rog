import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { READING_PLAN, currentDayNumber, formatReading } from "@/lib/plan";
import Nav from "@/components/Nav";
import ReflectionForm from "@/components/ReflectionForm";
import NudgeBanner from "@/components/NudgeBanner";

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

  const { data: existing } = await supabase
    .from("completions")
    .select("verse_reference, verse_text, reflection")
    .eq("user_id", user.id)
    .eq("day_number", day)
    .maybeSingle();

  const otRef = formatReading(reading.ot);
  const ntRef = formatReading(reading.nt);

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-8">
        <NudgeBanner completed={!!existing} day={day} />
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between text-sm">
            <span className="kicker">Your progress</span>
            <span className="text-rog-muted">Day {day} of 90</span>
          </div>
          <div className="mt-2 h-2 bg-rog-line rounded-full overflow-hidden">
            <div
              className="h-full bg-rog-purple"
              style={{ width: `${(day / 90) * 100}%` }}
            />
          </div>
        </div>

        <p className="kicker">Today&rsquo;s Reading</p>
        <h1 className="mt-2 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">
          Day {day}
        </h1>

        {/* Reading tiles — Level 1 (soft plate). These are navigation, not objects. */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <Link href="/read?t=ot" className="surface-soft block hover:border-rog-purple group">
            <p className="kicker !text-rog-blue">Old Testament</p>
            <p className="mt-2 font-serif text-lg text-rog-ink">{otRef}</p>
            <p className="mt-3 text-xs text-rog-muted font-semibold uppercase tracking-[0.18em] group-hover:text-rog-purple transition-colors">
              Read &rarr;
            </p>
          </Link>
          <Link href="/read?t=nt" className="surface-soft block hover:border-rog-purple group">
            <p className="kicker !text-rog-blue">New Testament</p>
            <p className="mt-2 font-serif text-lg text-rog-ink">{ntRef}</p>
            <p className="mt-3 text-xs text-rog-muted font-semibold uppercase tracking-[0.18em] group-hover:text-rog-purple transition-colors">
              Read &rarr;
            </p>
          </Link>
        </div>

        {/* Reflection */}
        <div className="mt-10">
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
