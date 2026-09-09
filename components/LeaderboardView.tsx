"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

type Row = {
  user_id: string;
  name: string;
  photo_url: string | null;
  cohort_id: string | null;
  days_completed: number;
  highest_day: number;
  current_streak: number;
};

type Cohort = { id: string; name: string };

/**
 * Leaderboard as a view under People.
 *
 * Two accuracy rules that were wrong before:
 *   1. Anyone with zero completions drops off the board. The board is for
 *      people on the journey — someone who has never opened it isn't
 *      "ranked last", they aren't ranked at all.
 *   2. Ties share a rank (standard competition ranking). Two people at 5
 *      days are both #1; the next person at 4 days is #3, not #2. The
 *      slot number a row lands in and the rank a person has aren't the
 *      same thing, and the old code was showing the slot number.
 */
export default function LeaderboardView() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [myCohortId, setMyCohortId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Filter the zero-day rows out at the query, not later. Nobody with
    // zero days should ever pass through the view at all.
    const { data, error: err } = await supabase
      .from("leaderboard")
      .select("*")
      .gt("days_completed", 0)
      .limit(200);
    if (err) setError(friendlyError(err.message));
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from("cohorts").select("id, name").then(({ data }) => {
      setCohorts((data ?? []) as Cohort[]);
    });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("profiles")
          .select("cohort_id")
          .eq("id", data.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            if (p?.cohort_id) setMyCohortId(p.cohort_id);
          });
      }
    });
    // Unique channel per mount so a strict-mode remount can't tear down
    // the subscription the new mount just opened (same pattern the app
    // uses elsewhere).
    const channel = supabase
      .channel(`leaderboard-live-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "completions" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  const filtered =
    filter === "all"
      ? rows
      : filter === "mine" && myCohortId
      ? rows.filter((r) => r.cohort_id === myCohortId)
      : rows.filter((r) => r.cohort_id === filter);

  // Standard competition ranking: rank is 1 + the number of rows with
  // strictly more days than you. Two people tied at 5 days are both #1;
  // the next person at 4 days is #3. Streak breaks a tie visually below
  // but doesn't change the shared rank.
  const ranked = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      if (b.days_completed !== a.days_completed) {
        return b.days_completed - a.days_completed;
      }
      return b.current_streak - a.current_streak;
    });
    return sorted.map((r) => ({
      row: r,
      rank:
        1 + sorted.filter((o) => o.days_completed > r.days_completed).length
    }));
  }, [filtered]);

  return (
    <div className="mt-6">
      <p className="text-sm text-rog-muted">
        Ranked by days kept, then current streak. Ties share a rank.
      </p>

      {/* Cohort filter */}
      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className="chip !min-h-[44px]"
          data-on={filter === "all" ? "true" : undefined}
        >
          Everyone
        </button>
        {myCohortId && (
          <button
            onClick={() => setFilter("mine")}
            className="chip !min-h-[44px]"
            data-on={filter === "mine" ? "true" : undefined}
          >
            My cohort
          </button>
        )}
        {cohorts.length > 0 && (
          <select
            value={filter === "all" || filter === "mine" ? "" : filter}
            onChange={(e) => setFilter(e.target.value || "all")}
            className="chip !min-h-[44px] appearance-none px-4 max-w-[220px] truncate"
          >
            <option value="">All cohorts…</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-danger">{error}</p>
      )}

      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading the leaderboard</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="card flex items-center gap-4">
                <div className="skeleton w-10 h-10" />
                <div className="skeleton w-12 h-12" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton mt-2 h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="empty-state">
            <p className="empty-body">The board is still empty.</p>
            <p className="empty-hint">
              It will fill as people save their first day.
            </p>
          </div>
        ) : (
          ranked.map(({ row, rank }) => (
            <div key={row.user_id} className="card flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold tabular-nums ${
                  rank === 1
                    ? "bg-rog-purple text-white outline outline-2 outline-offset-2 outline-rog-purple/30"
                    : rank <= 3
                    ? "bg-rog-purple text-white"
                    : "bg-rog-cream text-rog-purple"
                }`}
                aria-label={`Rank ${rank}`}
              >
                {rank}
              </div>
              <Avatar name={row.name} photoUrl={row.photo_url} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-rog-ink truncate">{row.name}</p>
                <p className="kicker mt-1">Day {row.highest_day ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-rog-purple tabular-nums">
                  {row.days_completed}
                </p>
                <p className="text-xs text-rog-muted">days</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
