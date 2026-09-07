"use client";
import { useEffect, useState, useCallback } from "react";
import Nav from "@/components/Nav";
import ReflectionCard from "@/components/ReflectionCard";
import { createClient } from "@/lib/supabase/client";

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

export default function CommunityPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [myCohortIds, setMyCohortIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [votd, setVotd] = useState<VOTD>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("community_feed").select("*").limit(100);
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
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
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="kicker">Deep Waters</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Community</h1>

        {votd && (
          <div className="votd mt-6 rounded-3xl p-6">
            <p className="votd-kicker text-xs font-medium tracking-[0.2em] uppercase">
              Verse of the day
            </p>
            <p className="mt-1 text-xl font-bold">{votd.verse_reference}</p>
            {votd.verse_text && (
              <p className="selectable mt-2 italic votd-body">
                &ldquo;{votd.verse_text}&rdquo;
              </p>
            )}
            <p className="mt-2 text-xs votd-meta">
              Picked by {votd.picks} {votd.picks === 1 ? "person" : "people"} today
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === "all" ? "bg-rog-purple text-white" : "bg-white border border-rog-line"}`}>
            Everyone
          </button>
          {myCohortIds.length > 0 && (
            <button onClick={() => setFilter("mine")} className={`px-4 py-2 rounded-full text-sm font-medium ${filter === "mine" ? "bg-rog-purple text-white" : "bg-white border border-rog-line"}`}>
              My cohorts
            </button>
          )}
          {cohorts.length > 0 && (
            <select
              value={filter === "all" || filter === "mine" ? "" : filter}
              onChange={(e) => setFilter(e.target.value || "all")}
              className="px-4 py-2 rounded-full text-sm bg-white border border-rog-line"
            >
              <option value="">Pick a cohort...</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div className="mt-6 space-y-4">
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
      </main>
    </>
  );
}
