"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Nav from "@/components/Nav";
import ProgressTabs from "@/components/ProgressTabs";
import { createClient } from "@/lib/supabase/client";

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

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [myCohortId, setMyCohortId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase.from("leaderboard").select("*").limit(200);
    setRows((data ?? []) as Row[]);
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
    const channel = supabase
      .channel("leaderboard-live")
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

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <ProgressTabs />
        <p className="kicker">Live</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Leaderboard</h1>
        <p className="mt-2 text-sm text-rog-muted">
          Ranked by days completed, then current streak. Updates in real time.
        </p>

        {/* Cohort filter */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              filter === "all"
                ? "bg-rog-purple text-white"
                : "bg-white border border-rog-line text-rog-ink"
            }`}
          >
            Everyone
          </button>
          {myCohortId && (
            <button
              onClick={() => setFilter("mine")}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                filter === "mine"
                  ? "bg-rog-purple text-white"
                  : "bg-white border border-rog-line text-rog-ink"
              }`}
            >
              My cohort
            </button>
          )}
          {cohorts.length > 0 && (
            <select
              value={filter === "all" || filter === "mine" ? "" : filter}
              onChange={(e) => setFilter(e.target.value || "all")}
              className="px-4 py-2 rounded-full text-sm bg-white border border-rog-line text-rog-ink"
            >
              <option value="">All cohorts...</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <p className="text-rog-muted text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-mark" aria-hidden>
                <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
                  <rect x="2" y="8" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <rect x="14" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <rect x="26" y="4" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                </svg>
              </span>
              <p className="empty-body">The board is still empty.</p>
              <p className="empty-hint">It will fill as people save their first day.</p>
            </div>
          ) : (
            filtered.map((row, i) => (
              <div key={row.user_id} className="card flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    i === 0
                      ? "bg-rog-purple text-white ring-2 ring-rog-purple/30 ring-offset-2 ring-offset-transparent"
                      : i < 3
                      ? "bg-rog-purple text-white"
                      : "bg-rog-cream text-rog-purple"
                  }`}
                >
                  {i + 1}
                </div>
                {row.photo_url ? (
                  <Image
                    src={row.photo_url}
                    alt={row.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-rog-peach flex items-center justify-center font-bold text-rog-purple">
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-rog-ink">{row.name}</p>
                  <p className="text-xs text-rog-muted">
                    Day {row.highest_day ?? 0} &bull; {row.current_streak} day streak
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-rog-purple">
                    {row.days_completed}
                  </p>
                  <p className="text-xs text-rog-muted">days</p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
