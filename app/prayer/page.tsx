"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Nav from "@/components/Nav";
import MentionText from "@/components/MentionText";
import ReportButton from "@/components/ReportButton";
import { createClient } from "@/lib/supabase/client";

type Prayer = {
  id: string;
  user_id: string;
  cohort_id: string | null;
  body: string;
  is_answered: boolean;
  answered_note: string | null;
  created_at: string;
  name: string;
  photo_url: string | null;
  prayed_by: string[];
};

export default function PrayerPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "answered">("open");
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerNote, setAnswerNote] = useState("");

  // Load prayers with THREE simple queries instead of one nested join.
  // Nested joins were returning HTTP 300 because Supabase could not resolve
  // the relationship names. Plain queries always work.
  const load = useCallback(async () => {
    // 1. the prayers themselves
    const { data: prayers, error: pErr } = await supabase
      .from("prayer_requests")
      .select("id, user_id, cohort_id, body, is_answered, answered_note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (pErr) {
      console.error("prayer load error:", pErr);
      setError("Could not load prayers: " + pErr.message);
      setLoading(false);
      return;
    }

    const list = prayers ?? [];
    if (list.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    // 2. the names/photos of everyone who posted
    const userIds = Array.from(new Set(list.map((p) => p.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, photo_url")
      .in("id", userIds);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    // 3. who has prayed for each request
    const prayerIds = list.map((p) => p.id);
    const { data: prayed } = await supabase
      .from("prayer_prayed")
      .select("prayer_id, user_id")
      .in("prayer_id", prayerIds);
    const prayedMap = new Map<string, string[]>();
    for (const row of prayed ?? []) {
      const arr = prayedMap.get(row.prayer_id) ?? [];
      arr.push(row.user_id);
      prayedMap.set(row.prayer_id, arr);
    }

    const merged: Prayer[] = list.map((p) => ({
      ...p,
      name: profMap.get(p.user_id)?.name ?? "Someone",
      photo_url: profMap.get(p.user_id)?.photo_url ?? null,
      prayed_by: prayedMap.get(p.id) ?? []
    }));

    setItems(merged);
    setError(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || cancelled) return;
      setMe(data.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("role, name, photo_url")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!cancelled && p) {
        setIsAdmin(p.role === "admin");
        setMyName(p.name);
        setMyPhoto(p.photo_url);
      }
    });
    const channel = supabase
      .channel(`prayer-live-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "prayer_requests" }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !me) return;
    setPosting(true);
    setError(null);

    const text = draft.trim();
    const tempId = "temp-" + Date.now();
    const optimistic: Prayer = {
      id: tempId,
      user_id: me,
      cohort_id: null,
      body: text,
      is_answered: false,
      answered_note: null,
      created_at: new Date().toISOString(),
      name: myName,
      photo_url: myPhoto,
      prayed_by: []
    };
    setItems((prev) => [optimistic, ...prev]);
    setDraft("");

    try {
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text })
      });
      const j = await res.json();
      if (!res.ok) {
        setItems((prev) => prev.filter((p) => p.id !== tempId));
        setDraft(text);
        setError(j.error || "Could not post prayer request");
      } else {
        setItems((prev) => prev.map((p) => (p.id === tempId ? { ...p, id: j.id } : p)));
        await load();
      }
    } catch (err: any) {
      setItems((prev) => prev.filter((p) => p.id !== tempId));
      setDraft(text);
      setError(err?.message || "Network error");
    } finally {
      setPosting(false);
    }
  }

  async function pray(id: string) {
    if (id.startsWith("temp-")) return;
    await fetch("/api/prayer", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "pray" })
    });
    load();
  }

  async function markAnswered(id: string) {
    await fetch("/api/prayer", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "answered", note: answerNote })
    });
    setAnswering(null);
    setAnswerNote("");
    load();
  }

  async function del(id: string) {
    if (id.startsWith("temp-")) return;
    setItems((prev) => prev.filter((p) => p.id !== id));
    await fetch("/api/prayer", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    load();
  }

  const shown = items.filter((p) => (tab === "open" ? !p.is_answered : p.is_answered));

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="kicker">Bear one another&rsquo;s burdens</p>
        <h1 className="mt-1 text-4xl font-bold text-rog-purple">Prayer</h1>

        <form onSubmit={post} className="mt-6 card">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="What can we pray about with you? Use @name to mention someone."
            className="w-full rounded-2xl border border-rog-line bg-white px-5 py-3 focus:border-rog-purple focus:outline-none"
          />
          <button type="submit" disabled={posting || !draft.trim()} className="btn-primary w-full mt-3 disabled:opacity-50">
            {posting ? "Posting..." : "Post prayer request"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
        </form>

        <div className="mt-6 flex gap-2">
          <button onClick={() => setTab("open")} className={`px-4 py-2 rounded-full text-sm font-medium ${tab === "open" ? "bg-rog-purple text-white" : "bg-white border border-rog-line"}`}>
            Open
          </button>
          <button onClick={() => setTab("answered")} className={`px-4 py-2 rounded-full text-sm font-medium ${tab === "answered" ? "bg-rog-purple text-white" : "bg-white border border-rog-line"}`}>
            Answered &#10003;
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-rog-muted">Loading...</p>
          ) : shown.length === 0 ? (
            <p className="text-rog-muted">{tab === "open" ? "No open requests yet. Post the first one." : "No answered prayers yet."}</p>
          ) : (
            shown.map((p) => {
              const prayedByMe = !!me && p.prayed_by.includes(me);
              const count = p.prayed_by.length;
              return (
                <div key={p.id} className={`card ${p.is_answered ? "border-green-300" : ""}`}>
                  <div className="flex items-center gap-3">
                    {p.photo_url ? (
                      <Image src={p.photo_url} alt="" width={36} height={36} className="rounded-full object-cover w-9 h-9" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-rog-peach flex items-center justify-center font-bold text-rog-purple text-sm">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-rog-ink text-sm">{p.name}</p>
                      <p className="text-[11px] text-rog-muted">{new Date(p.created_at).toLocaleString("en-GB")}</p>
                    </div>
                    {p.is_answered && <span className="text-xs text-green-700 font-semibold">Answered &#10003;</span>}
                  </div>
                  <p className="mt-3 text-rog-ink"><MentionText text={p.body} /></p>
                  {p.is_answered && p.answered_note && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-green-200">
                      <p className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">Testimony</p>
                      <p className="text-sm mt-1">{p.answered_note}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-sm flex-wrap">
                    <button
                      onClick={() => pray(p.id)}
                      className={`px-3 py-1.5 rounded-full ${prayedByMe ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-purple hover:bg-rog-peach"}`}
                    >
                      &#128591; {prayedByMe ? "Praying" : "I'm praying"} {count > 0 && `\u00b7 ${count}`}
                    </button>
                    {p.user_id === me && !p.is_answered && (
                      answering === p.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            value={answerNote}
                            onChange={(e) => setAnswerNote(e.target.value)}
                            placeholder="How was it answered? (optional)"
                            className="flex-1 rounded-full border border-rog-line px-3 py-1.5 text-xs"
                          />
                          <button onClick={() => markAnswered(p.id)} className="text-xs text-green-700 font-semibold">Save</button>
                          <button onClick={() => setAnswering(null)} className="text-xs text-rog-muted">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setAnswering(p.id)} className="text-xs text-green-700 font-medium">Mark answered</button>
                      )
                    )}
                    <div className="ml-auto flex gap-3">
                      {(p.user_id === me || isAdmin) && (
                        <button onClick={() => del(p.id)} className="text-[11px] text-rog-muted hover:text-red-600">Delete</button>
                      )}
                      {p.user_id !== me && !p.id.startsWith("temp-") && <ReportButton targetType="prayer" targetId={p.id} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
