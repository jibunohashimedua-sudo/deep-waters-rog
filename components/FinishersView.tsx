"use client";
import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

type Finisher = {
  id: string;
  name: string;
  photo_url: string | null;
  finished_at: string;
};

export default function FinishersView() {
  const supabase = useMemo(() => createClient(), []);
  const [finishers, setFinishers] = useState<Finisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.from("finishers").select("*");
      if (cancelled) return;
      if (err) setError(friendlyError(err.message));
      else setFinishers((data ?? []) as Finisher[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="mt-6">
      <p className="text-sm text-rog-muted">
        Every name here read the whole Bible in 90 days.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card text-center">
              <div className="skeleton w-20 h-20 mx-auto" />
              <div className="skeleton h-3 w-24 mt-3 mx-auto" />
            </div>
          ))}
        </div>
      ) : finishers.length === 0 ? (
        <div className="mt-10 empty-state">
          <span className="empty-mark" aria-hidden>
            <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
              <line x1="4" y1="10" x2="56" y2="10" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" />
              <circle cx="4" cy="10" r="1.6" fill="currentColor" />
              <circle cx="56" cy="10" r="1.6" fill="currentColor" />
            </svg>
          </span>
          <p className="empty-body">Nobody has crossed day 90 yet.</p>
          <p className="empty-hint">The wall is here for when they do.</p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {finishers.map((f) => (
            <div key={f.id} className="card text-center">
              <Avatar name={f.name} photoUrl={f.photo_url} size="xl" className="mx-auto" />
              <p className="mt-3 font-semibold text-rog-purple">{f.name}</p>
              <p className="text-xs text-rog-muted">
                {new Date(f.finished_at).toLocaleDateString("en-GB")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
