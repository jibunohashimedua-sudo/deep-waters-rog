import Link from "next/link";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import ProgressTabs from "@/components/ProgressTabs";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BADGES, BADGE_ORDER } from "@/lib/badges";
import { currentDayNumber } from "@/lib/plan";
import ResetMyData from "@/components/ResetMyData";

export default async function MePage() {
  const { userId, profile } = await requireProfile();
  const supabase = createClient();

  const [
    { data: completions },
    { data: badges },
    { data: lb },
    { data: cohorts },
    { data: verseNotes }
  ] = await Promise.all([
    supabase
      .from("completions")
      .select("id, day_number, verse_reference, verse_text, reflection, completed_at")
      .eq("user_id", userId)
      .order("day_number", { ascending: false }),
    supabase.from("badges").select("badge, earned_at").eq("user_id", userId),
    supabase.from("leaderboard").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cohort_members")
      .select("role, cohorts(id, slug, name, start_date)")
      .eq("user_id", userId),
    supabase
      .from("verse_notes")
      .select(
        "id, day_number, testament, book, chapter, verse_start, verse_end, body, updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50)
  ]);

  const day = currentDayNumber(profile.start_date);
  const earned = new Set((badges ?? []).map((b) => b.badge));
  const doneDays = new Set((completions ?? []).map((c) => c.day_number));

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <ProgressTabs />
        {/* Header */}
        <div className="card">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} photoUrl={profile.photo_url} size="xl" />
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-2xl md:text-3xl font-medium text-rog-ink leading-tight break-words">
                {profile.name}
              </h1>
              {profile.bio && <p className="text-sm text-rog-muted mt-1 break-words">{profile.bio}</p>}
            </div>
            <Link href="/me/edit" className="btn-secondary text-sm hidden sm:inline-flex shrink-0">
              Edit
            </Link>
          </div>
          <p className="text-xs text-rog-muted mt-3">
            Day {day} of 90 &bull; {lb?.days_completed ?? 0} completed &bull;{" "}
            {lb?.current_streak ?? 0} day streak
          </p>
          <Link href="/me/edit" className="btn-secondary text-sm mt-4 w-full sm:hidden">
            Edit profile
          </Link>
        </div>

        {/* Progress grid */}
        <section className="mt-8">
          <p className="kicker">Progress</p>
          <h2 className="mt-1 text-xl font-bold text-rog-purple">90 days</h2>
          <div className="mt-4 grid grid-cols-10 gap-1.5">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((d) => {
              const done = doneDays.has(d);
              const isToday = d === day;
              const future = d > day;
              return (
                <div
                  key={d}
                  title={`Day ${d}`}
                  className={`aspect-square rounded-md text-[10px] flex items-center justify-center font-semibold ${
                    done
                      ? "bg-rog-purple text-white"
                      : isToday
                      ? "bg-white border-2 border-rog-purple text-rog-purple ring-2 ring-rog-purple/20"
                      : future
                      ? "bg-white border border-rog-line text-rog-muted/50"
                      : "bg-rog-peach/60 text-rog-purple/70 border border-dashed border-rog-purple/20"
                  }`}
                >
                  {d}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-rog-muted flex-wrap">
            <span><span className="inline-block w-3 h-3 rounded bg-rog-purple align-middle mr-1" /> Kept</span>
            <span><span className="inline-block w-3 h-3 rounded bg-rog-peach/60 border border-dashed border-rog-purple/40 align-middle mr-1" /> Not yet</span>
            <span><span className="inline-block w-3 h-3 rounded bg-white border-2 border-rog-purple align-middle mr-1" /> Today</span>
          </div>
        </section>

        {/* Badges */}
        <section className="mt-8">
          <p className="kicker">Badges</p>
          <h2 className="mt-1 text-xl font-bold text-rog-purple">Milestones</h2>
          <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-3">
            {BADGE_ORDER.map((key) => {
              const b = BADGES[key];
              const has = earned.has(key);
              return (
                <div
                  key={key}
                  className={`card text-center !p-3 ${has ? "" : "opacity-60"}`}
                >
                  <div className="text-3xl">{b.emoji}</div>
                  <p className="mt-1 text-xs font-bold text-rog-purple">{b.label}</p>
                  <p className="text-[10px] text-rog-muted">{b.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cohorts */}
        {cohorts && cohorts.length > 0 && (
          <section className="mt-8">
            <p className="kicker">Your cohorts</p>
            <div className="mt-3 space-y-2">
              {cohorts.map((cm: any) => (
                <Link
                  key={cm.cohorts.id}
                  href={`/c/${cm.cohorts.slug}`}
                  className="card block hover:border-rog-purple transition flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-rog-purple">{cm.cohorts.name}</p>
                    <p className="text-xs text-rog-muted">
                      {cm.role === "leader" ? "Leader" : "Member"}
                    </p>
                  </div>
                  <span className="text-rog-purple text-xs font-semibold">&rarr;</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Verse notes */}
        <section className="mt-8">
          <p className="kicker">Notes</p>
          <h2 className="mt-1 text-xl font-bold text-rog-purple">Verse notes</h2>
          <div className="mt-4 space-y-3">
            {!verseNotes || verseNotes.length === 0 ? (
              <div className="empty-state">
                <p className="empty-body">No verse notes yet.</p>
                <p className="empty-hint">
                  Select a verse on the reading page to write one.
                </p>
              </div>
            ) : (
              verseNotes.map((n) => {
                const ref =
                  n.verse_end > n.verse_start
                    ? `${n.book} ${n.chapter}:${n.verse_start}–${n.verse_end}`
                    : `${n.book} ${n.chapter}:${n.verse_start}`;
                const excerpt =
                  n.body.length > 160 ? n.body.slice(0, 160).trimEnd() + "…" : n.body;
                return (
                  <Link
                    key={n.id}
                    href={`/read?t=${n.testament}&d=${n.day_number}`}
                    className="card block hover:border-rog-purple transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-serif font-medium text-rog-purple">{ref}</p>
                      <p className="text-xs text-rog-muted shrink-0">
                        {new Date(n.updated_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-rog-ink whitespace-pre-wrap">
                      {excerpt}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* History */}
        <section className="mt-8">
          <p className="kicker">History</p>
          <h2 className="mt-1 text-xl font-bold text-rog-purple">Your reflections</h2>
          <div className="mt-4 space-y-3">
            {!completions || completions.length === 0 ? (
              <div className="empty-state">
                <p className="empty-body">Your reflections will collect here.</p>
                <p className="empty-hint">Save your first day to begin.</p>
              </div>
            ) : (
              completions.map((c) => (
                <div key={c.id} className="card">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-rog-purple">Day {c.day_number}</p>
                    <p className="text-xs text-rog-muted">
                      {new Date(c.completed_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  {c.verse_reference && (
                    <p className="mt-2 font-semibold text-rog-ink">{c.verse_reference}</p>
                  )}
                  {c.verse_text && (
                    <p className="selectable mt-1 italic text-rog-ink text-sm">&ldquo;{c.verse_text}&rdquo;</p>
                  )}
                  {c.reflection && (
                    <p className="selectable mt-2 text-sm text-rog-ink whitespace-pre-wrap">{c.reflection}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Danger zone */}
        <section className="mt-10">
          <p className="kicker">Danger zone</p>
          <div className="mt-3">
            <ResetMyData />
          </div>
        </section>
      </main>
    </>
  );
}
