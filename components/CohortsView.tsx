"use client";
import Link from "next/link";
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
      const { data, error: err } = await supabase.from("cohort_summary").select("*");
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
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton mt-2 h-3 w-32" />
              </div>
            ))}
          </>
        ) : cohorts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden>
              <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <circle cx="22" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <circle cx="34" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              </svg>
            </span>
            <p className="empty-body">No cohorts yet.</p>
            <p className="empty-hint">Anyone can start one.</p>
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
                      {status} · {c.member_count} member
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
