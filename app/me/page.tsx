import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/Nav";
import ProgressTabs from "@/components/ProgressTabs";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BADGES, BADGE_ORDER } from "@/lib/badges";
import { currentDayNumber } from "@/lib/plan";
import ResetMyData from "@/components/ResetMyData";

export default async function MePage() {
  const { userId, profile } = await requireProfile();
  const supabase = createClient();

  const [{ data: completions }, { data: badges }, { data: lb }, { data: cohorts }] =
    await Promise.all([
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
        .eq("user_id", userId)
    ]);

  const day = currentDayNumber(profile.start_date);
  const earned = new Set((badges ?? []).map((b) => b.badge));
  const doneDays = new Set((completions ?? []).map((c) => c.day_number));

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <ProgressTabs />
        {/* Header */}
        <div className="card flex items-center gap-5">
          {profile.photo_url ? (
            <Image
              src={profile.photo_url}
              alt={profile.name}
              width={80}
              height={80}
              className="rounded-full object-cover w-20 h-20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-rog-peach flex items-center justify-center font-bold text-2xl text-rog-purple">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-rog-purple">{profile.name}</h1>
            {profile.bio && <p className="text-sm text-rog-muted mt-1">{profile.bio}</p>}
            <p className="text-xs text-rog-muted mt-1">
              Day {day} of 90 &bull; {lb?.days_completed ?? 0} completed &bull;{" "}
              {lb?.current_streak ?? 0} day streak
            </p>
          </div>
          <Link href="/me/edit" className="btn-secondary text-sm">
            Edit
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
                  className={`card text-center p-3 ${has ? "" : "opacity-60"}`}
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
                    <p className="mt-1 italic text-rog-ink text-sm">&ldquo;{c.verse_text}&rdquo;</p>
                  )}
                  {c.reflection && (
                    <p className="mt-2 text-sm text-rog-ink whitespace-pre-wrap">{c.reflection}</p>
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
