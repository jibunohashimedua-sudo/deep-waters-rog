"use client";
import { useEffect, useState, useCallback } from "react";
import ReflectionCard from "@/components/ReflectionCard";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

type Item = {
  id: string;
  user_id: string;
  day_number: number;
  verse_reference: string | null;
  verse_text: string | null;
  reflection: string | null;
  completed_at: string;
  name: string;
  photo_url: string | null;
  cohort_id: string | null;
  amen_count: number;
  comment_count: number;
};

type Cohort = { id: string; name: string };
type VOTD = { verse_reference: string; verse_text: string | null; picks: number } | null;

/**
 * The reflections feed. Lifted out of /community when Prayer joined it as a
 * second view — the page above owns the heading and the segmented control.
 */
export default function CommunityFeed() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [myCohortIds, setMyCohortIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [votd, setVotd] = useState<VOTD>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: fErr } = await supabase.from("community_feed").select("*").limit(100);
    if (fErr) setError(friendlyError(fErr.message));
    else setError(null);
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    // These three don't depend on one another, so they go out together
    // rather than in sequence.
    supabase.from("cohorts").select("id, name").then(({ data }) => setCohorts((data ?? []) as Cohort[]));
    supabase.from("verse_of_the_day").select("*").maybeSingle().then(({ data }) => setVotd(data as VOTD));
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setMe(data.user.id);
      const [{ data: p }, { data: cm }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle(),
        supabase.from("cohort_members").select("cohort_id").eq("user_id", data.user.id)
      ]);
      setIsAdmin(p?.role === "admin");
      setMyCohortIds((cm ?? []).map((c) => c.cohort_id));
    });
    const channel = supabase
      .channel(`feed-live-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  const filtered =
    filter === "all"
      ? items
      : filter === "mine"
      ? items.filter((r) => r.cohort_id && myCohortIds.includes(r.cohort_id))
      : items.filter((r) => r.cohort_id === filter);

  return (
    <>
      {votd && (
        <div className="votd mt-6 p-5">
          <p className="votd-kicker kicker">Verse of the day</p>
          {votd.verse_text && (
            <p className="selectable mt-3 votd-body text-[17px] leading-[1.6]">
              {votd.verse_text}
            </p>
          )}
          <p className="mt-3 kicker votd-meta">
            {votd.verse_reference} &middot; picked by {votd.picks}{" "}
            {votd.picks === 1 ? "person" : "people"} today
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter("all")} className="chip" data-on={filter === "all" ? "true" : undefined}>
          Everyone
        </button>
        {myCohortIds.length > 0 && (
          <button onClick={() => setFilter("mine")} className="chip" data-on={filter === "mine" ? "true" : undefined}>
            My cohorts
          </button>
        )}
        {cohorts.length > 0 && (
          <select
            value={filter === "all" || filter === "mine" ? "" : filter}
            onChange={(e) => setFilter(e.target.value || "all")}
            className="chip !bg-transparent"
          >
            <option value="">Pick a cohort...</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="card-list mt-6">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading the feed</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 !rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-28" />
                    <div className="skeleton mt-2 h-3 w-20" />
                  </div>
                </div>
                <div className="skeleton mt-4 h-3 w-40" />
                <div className="skeleton mt-2 h-3 w-full" />
                <div className="skeleton mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-body">Nothing shared yet.</p>
            <p className="empty-hint">Post the verse that stood out to you today and start the feed.</p>
          </div>
        ) : (
          filtered.map((it) => <ReflectionCard key={it.id} item={it} currentUserId={me} isAdmin={isAdmin} />)
        )}
      </div>
    </>
  );
}
