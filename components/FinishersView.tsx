"use client";
import { useEffect, useMemo, useState } from "react";
import LoadingRule from "@/components/LoadingRule";
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
      // Bounded in practice — the finishers view is people who kept all 90
      // days — but every other list surface caps its query, and one that
      // grew unbounded would drag the whole page down. Match the pattern.
      const { data, error: err } = await supabase
        .from("finishers")
        .select("*")
        .limit(500);
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
        <div className="mt-10"><LoadingRule label="Loading the finishers" /></div>
      ) : finishers.length === 0 ? (
        <div className="mt-10 empty">
          <p>Nobody has crossed day 90 yet.</p>
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
