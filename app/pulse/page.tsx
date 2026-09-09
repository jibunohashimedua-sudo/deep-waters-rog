import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import PulseCheckOn from "@/components/PulseCheckOn";
import PulseCurve from "@/components/PulseCurve";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { todayForCurrentRequest } from "@/lib/serverToday";
import {
  QUIET_DAYS,
  CHECK_ON_LIMIT,
  COHORTS_LIMIT,
  COHORT_HEALTHY_RATIO,
  PRAYERS_LIMIT,
  days,
  shortDate,
  type CheckOnRow,
  type PulseCohortRow,
  type PulseCurvePoint,
  type PulseNumbers,
  type PulsePrayerRow
} from "@/lib/pulse";

export const metadata = { title: "Church pulse · Deep Waters" };

/**
 * Church Pulse — who is being carried, and who has gone quiet.
 *
 * Not analytics. A short list of names and a reason to call them.
 *
 * Gated the same way Sermons is: requirePastoral sends anyone without
 * the flag to /today without telling them there was a door here. Every
 * query below is a security definer RPC that asks the database the same
 * question again, so the gate holds even if someone finds the route.
 *
 * Three rules this page is built to, not decorated with:
 *
 *  · Activity only, never content. The page can say someone has been
 *    quiet nine days. It cannot say what they wrote — not one of these
 *    queries selects a reflection or a verse note. The only member-written
 *    words anywhere here are prayers posted publicly to the prayer wall.
 *  · No scoreboard. Cohorts sort by silence, never by performance, and
 *    no percentage sits next to a leader's name.
 *  · No reason is ever guessed. Nine days quiet, and stop.
 */
export default async function PulsePage() {
  await requirePastoral();
  const supabase = createClient();
  const today = todayForCurrentRequest();

  // Five aggregates, one round trip each, all at once. The client
  // assembles nothing: each of these is a single question answered in
  // SQL, which is cheaper than five list queries stitched together here.
  const [numbersRes, checkOnRes, cohortsRes, curveRes, prayersRes] = await Promise.all([
    supabase.rpc("pulse_numbers", { p_today: today, p_quiet_days: QUIET_DAYS }),
    supabase
      .rpc("pulse_check_on", {
        p_today: today,
        p_quiet_days: QUIET_DAYS,
        p_limit: CHECK_ON_LIMIT
      })
      .limit(CHECK_ON_LIMIT),
    supabase
      .rpc("pulse_cohorts", { p_today: today, p_limit: COHORTS_LIMIT })
      .limit(COHORTS_LIMIT),
    supabase.rpc("pulse_curve", { p_today: today }).limit(90),
    supabase.rpc("pulse_prayers", { p_limit: PRAYERS_LIMIT }).limit(PRAYERS_LIMIT)
  ]);

  for (const [what, res] of [
    ["numbers", numbersRes],
    ["check_on", checkOnRes],
    ["cohorts", cohortsRes],
    ["curve", curveRes],
    ["prayers", prayersRes]
  ] as const) {
    if (res.error) console.error(`[deep-waters] pulse ${what}:`, res.error.message);
  }

  const numbers: PulseNumbers = ((numbersRes.data ?? []) as PulseNumbers[])[0] ?? {
    reading_today: 0,
    on_track: 0,
    quiet: 0,
    new_testimonies: 0
  };
  const checkOn = (checkOnRes.data ?? []) as CheckOnRow[];
  const cohorts = (cohortsRes.data ?? []) as PulseCohortRow[];
  const curve = (curveRes.data ?? []) as PulseCurvePoint[];
  const prayers = (prayersRes.data ?? []) as PulsePrayerRow[];

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Church pulse
        </h1>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          Who is being carried, and who has gone quiet. Activity only —
          nothing anyone wrote in private is on this page.
        </p>

        {/* ---- four numbers ---- */}
        <section className="mt-8">
          <div className="pulse-stats">
            <div className="pulse-stat">
              <span className="pulse-stat-num">{numbers.reading_today}</span>
              <span className="pulse-stat-label">Reading today</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat-num">{numbers.on_track}</span>
              <span className="pulse-stat-label">On track this week</span>
            </div>
            {/* The only call to action here, so the only amber. */}
            <div className="pulse-stat" data-care="true">
              <span className="pulse-stat-num">{numbers.quiet}</span>
              <span className="pulse-stat-label">{`Quiet ${QUIET_DAYS} days or more`}</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat-num">{numbers.new_testimonies}</span>
              <span className="pulse-stat-label">New testimonies</span>
            </div>
          </div>
        </section>

        {/* ---- check on these ---- */}
        <section className="mt-10">
          <h2 className="text-[19px] font-medium tracking-[-0.01em] text-rog-ink">
            Check on these
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-rog-muted">
            A name and one reason. Tap for the rest, and to log what you did.
          </p>
          <PulseCheckOn rows={checkOn} />
        </section>

        {/* ---- cohorts ---- */}
        <section className="mt-10">
          <h2 className="text-[19px] font-medium tracking-[-0.01em] text-rog-ink">
            Cohorts
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-rog-muted">
            Quietest first. Not a ranking — the one at the top is the one to
            ask after.
          </p>

          {cohorts.length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">No cohorts yet.</p>
              <p className="empty-hint">
                When a cohort is created it will appear here with its leader.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {cohorts.map((c) => {
                const ratio = c.member_count > 0 ? c.read_this_week / c.member_count : 0;
                const state = ratio >= COHORT_HEALTHY_RATIO ? "reading" : "quiet";
                return (
                  <div key={c.cohort_id} className="pulse-cohort">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-[15px] font-medium text-rog-ink truncate">
                        {c.name}
                      </p>
                      <p className="meta shrink-0">
                        {`${c.read_this_week} of ${c.member_count} reading`}
                      </p>
                    </div>
                    <p className="meta mt-1.5">
                      {c.last_activity_at
                        ? `Last activity ${shortDate(c.last_activity_at)}`
                        : "No activity yet"}
                    </p>
                    <div
                      className="pulse-bar"
                      data-state={state}
                      role="img"
                      aria-label={`${c.read_this_week} of ${c.member_count} reading this week`}
                    >
                      <span
                        className="pulse-bar-fill"
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- where people fall away ---- */}
        <section className="mt-10">
          <h2 className="text-[19px] font-medium tracking-[-0.01em] text-rog-ink">
            Where people fall away
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-rog-muted">
            Of the people who reached each day, how many kept it.
          </p>
          <PulseCurve points={curve} />
        </section>

        {/* ---- prayers waiting ---- */}
        <section className="mt-10 mb-4">
          <h2 className="text-[19px] font-medium tracking-[-0.01em] text-rog-ink">
            Prayers waiting
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-rog-muted">
            Posted to the prayer wall, still without a response.
          </p>

          {prayers.length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">Nothing is waiting.</p>
              <p className="empty-hint">
                Every open prayer on the wall has had someone pray it.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {prayers.map((p) => (
                <div
                  key={p.id}
                  className="pulse-prayer"
                  data-care={p.needs_pastor ? "true" : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} photoUrl={p.photo_url} size="sm" decorative className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-rog-ink truncate">{p.name}</p>
                      <p className="meta mt-1">
                        {p.needs_pastor
                          ? `Asked for a pastor, ${shortDate(p.created_at)}`
                          : `Waiting ${days(
                              Math.max(
                                0,
                                Math.round(
                                  (Date.now() - new Date(p.created_at).getTime()) / 86400000
                                )
                              )
                            )}`}
                      </p>
                    </div>
                  </div>
                  <p className="pulse-prayer-body selectable">{p.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
