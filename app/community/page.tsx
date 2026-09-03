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
      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="kicker">Deep Waters</p>
        <h1 className="mt-1 text-4xl font-bold text-rog-purple">Community</h1>

        {votd && (
          <div
            className="mt-6 rounded-3xl p-6 text-white shadow-lg"
            style={{
              background: "linear-gradient(135deg, #3B1E6E 0%, #4A2A85 55%, #2E4FD1 100%)",
              boxShadow: "0 10px 32px -12px rgba(59,30,110,0.55)"
            }}
          >
            <p className="text-xs font-medium tracking-[0.2em] uppercase" style={{ color: "#FF7EB6" }}>
              Verse of the day
            </p>
            <p className="mt-1 text-xl font-bold text-white">{votd.verse_reference}</p>
            {votd.verse_text && (
              <p className="mt-2 italic" style={{ color: "rgba(255,255,255,0.9)" }}>
                &ldquo;{votd.verse_text}&rdquo;
              </p>
            )}
            <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
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
            <p className="text-rog-muted">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-rog-muted">Nothing shared yet. Post your first reflection.</p>
          ) : (
            filtered.map((it) => <ReflectionCard key={it.id} item={it} currentUserId={me} isAdmin={isAdmin} />)
          )}
        </div>
      </main>
    </>
  );
}
