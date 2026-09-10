"use client";
import Link from "next/link";
import LoadingRule from "@/components/LoadingRule";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

type CohortSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  start_date: string;
  member_count: number;
};

export default function CohortsView() {
  const supabase = useMemo(() => createClient(), []);
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The last list surface without a cap. Every other one carries a
      // safety limit — CommunityFeed 100, LeaderboardView 200, PrayerWall,
      // FinishersView 500 — and this one was the odd one out. Invisible at
      // two cohorts; it stops being invisible at two hundred.
      const { data, error: err } = await supabase
        .from("cohort_summary")
        .select("*")
        .limit(200);
      if (cancelled) return;
      if (err) setError(friendlyError(err.message));
      else setCohorts((data ?? []) as CohortSummary[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-rog-muted">
          Groups starting Deep Waters together. Share a link to invite.
        </p>
        <Link href="/cohorts/new" className="btn-primary !py-2 !px-5 text-sm">
          + New cohort
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          <LoadingRule label="Loading your cohorts" />
        ) : cohorts.length === 0 ? (
          <div className="empty">
            <p>No cohorts yet.</p>
            <Link href="/cohorts/new" className="btn-primary">
              Start one
            </Link>
          </div>
        ) : (
          cohorts.map((c) => {
            const startDate = new Date(c.start_date);
            const today = new Date();
            const daysUntil = Math.ceil(
              (startDate.getTime() - today.getTime()) / 86400000
            );
            const status =
              daysUntil > 0
                ? `Starts in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
                : daysUntil === 0
                ? "Starts today"
                : `Day ${Math.min(90, Math.abs(daysUntil) + 1)} in progress`;
            return (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="card block hover:border-rog-purple transition"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-rog-purple text-lg truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-rog-muted mt-1">
                      {c.member_count} member
                      {c.member_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-xs text-rog-muted font-medium uppercase tracking-[0.2em] shrink-0">
                    View →
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
