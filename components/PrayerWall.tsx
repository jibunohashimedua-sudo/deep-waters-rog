"use client";
import { useEffect, useState, useCallback } from "react";
import Avatar from "@/components/Avatar";
import MentionText from "@/components/MentionText";
import ReportButton from "@/components/ReportButton";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { readCache, writeCache } from "@/lib/viewCache";

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

/**
 * The prayer wall. Lifted out of /prayer unchanged when Prayer became the
 * second view inside the Community tab — same queries, same optimistic
 * posting, same empty states. The page around it owns the heading now.
 */
const CACHE_KEY = "prayer-wall";

export default function PrayerWall() {
  const supabase = createClient();
  // Same reason as the feed: mounting empty collapses the page, so a back
  // navigation has no height to restore into and lands at the top.
  const cached = readCache<Prayer[]>(CACHE_KEY);
  const [items, setItems] = useState<Prayer[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
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
      setError(friendlyError(pErr.message));
      setLoading(false);
      return;
    }

    const list = prayers ?? [];
    if (list.length === 0) {
      setItems([]);
      setLoading(false);
      writeCache<Prayer[]>(CACHE_KEY, []);
      return;
    }

    // 2 and 3 don't depend on each other, so they go together rather than
    // one waiting on the other.
    const userIds = Array.from(new Set(list.map((p) => p.user_id)));
    const prayerIds = list.map((p) => p.id);
    const [{ data: profs }, { data: prayed }] = await Promise.all([
      supabase.from("profiles").select("id, name, photo_url").in("id", userIds),
      supabase.from("prayer_prayed").select("prayer_id, user_id").in("prayer_id", prayerIds)
    ]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
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
    writeCache<Prayer[]>(CACHE_KEY, merged);
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
        setError(friendlyError(j.error));
      } else {
        setItems((prev) => prev.map((p) => (p.id === tempId ? { ...p, id: j.id } : p)));
        await load();
      }
    } catch (err: any) {
      setItems((prev) => prev.filter((p) => p.id !== tempId));
      setDraft(text);
      setError(friendlyError(err?.message));
    } finally {
      setPosting(false);
    }
  }

  async function pray(id: string) {
    if (id.startsWith("temp-")) return;
    setError(null);
    try {
      const res = await fetch("/api/prayer", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "pray" })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(friendlyError(j.error));
        return;
      }
      load();
    } catch (err: any) {
      setError(friendlyError(err?.message));
    }
  }

  async function markAnswered(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/prayer", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "answered", note: answerNote })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(friendlyError(j.error));
        return;
      }
      setAnswering(null);
      setAnswerNote("");
      load();
    } catch (err: any) {
      setError(friendlyError(err?.message));
    }
  }

  async function del(id: string) {
    if (id.startsWith("temp-")) return;
    const previous = items;
    // Optimistic remove — put it back if the server refuses so the user
    // isn't misled about what has and hasn't been deleted.
    setItems((prev) => prev.filter((p) => p.id !== id));
    setError(null);
    try {
      const res = await fetch("/api/prayer", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        setItems(previous);
        const j = await res.json().catch(() => ({}));
        setError(friendlyError(j.error));
        return;
      }
      load();
    } catch (err: any) {
      setItems(previous);
      setError(friendlyError(err?.message));
    }
  }

  const shown = items.filter((p) => (tab === "open" ? !p.is_answered : p.is_answered));

  return (
    <>
      <form onSubmit={post} className="mt-6 card">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          enterKeyHint="send"
          placeholder="What can we pray about with you? Use @name to mention someone."
          className="w-full border border-rog-line bg-white px-5 py-3 focus:border-rog-purple focus:outline-none"
        />
        <button type="submit" disabled={posting || !draft.trim()} className="btn-primary w-full mt-3 disabled:opacity-50">
          {posting ? "Posting..." : "Post prayer request"}
        </button>
        {error && <p className="mt-2 text-sm text-danger text-center">{error}</p>}
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
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading the prayer wall</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-9 h-9 !rounded-full" />
                  <div className="skeleton h-3 w-32" />
                </div>
                <div className="skeleton mt-4 h-3 w-full" />
                <div className="skeleton mt-2 h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M12 26c0-4.5 3.5-8 8-8s8 3.5 8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="20" y1="12" x2="20" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="20" y1="30" x2="20" y2="34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <p className="empty-body">
              {tab === "open" ? "The wall is quiet." : "No answered prayers here yet."}
            </p>
            <p className="empty-hint">
              {tab === "open"
                ? "When someone shares a request, it will show here."
                : "When someone marks a prayer answered, it moves here."}
            </p>
          </div>
        ) : (
          shown.map((p) => {
            const prayedByMe = !!me && p.prayed_by.includes(me);
            const count = p.prayed_by.length;
            return (
              <div key={p.id} className={`card ${p.is_answered ? "border-success" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} photoUrl={p.photo_url} size="sm" decorative />
                  <div className="flex-1">
                    <p className="font-semibold text-rog-ink text-sm">{p.name}</p>
                    <p className="text-[11px] text-rog-muted">{new Date(p.created_at).toLocaleString("en-GB")}</p>
                  </div>
                  {p.is_answered && <span className="text-xs text-success font-semibold">Answered &#10003;</span>}
                </div>
                <p className="selectable mt-3 text-rog-ink"><MentionText text={p.body} /></p>
                {p.is_answered && p.answered_note && (
                  <div className="mt-3 p-3 bg-white border border-green-200">
                    <p className="text-[10px] uppercase tracking-wider text-success font-semibold">Testimony</p>
                    <p className="text-sm mt-1">{p.answered_note}</p>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-sm flex-wrap">
                  <button
                    onClick={() => pray(p.id)}
                    className={`px-3 py-1.5 rounded-full ${prayedByMe ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-purple hover:bg-rog-peach"}`}
                  >
                    &#128591; {prayedByMe ? "Praying" : "I'm praying"} {count > 0 && `· ${count}`}
                  </button>
                  {p.user_id === me && !p.is_answered && (
                    answering === p.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          enterKeyHint="done"
                          value={answerNote}
                          onChange={(e) => setAnswerNote(e.target.value)}
                          placeholder="How was it answered? (optional)"
                          className="flex-1 rounded-full border border-rog-line px-3 py-1.5 text-xs"
                        />
                        <button onClick={() => markAnswered(p.id)} className="text-xs text-success font-semibold">Save</button>
                        <button onClick={() => setAnswering(null)} className="text-xs text-rog-muted">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAnswering(p.id)} className="text-xs text-success font-medium">Mark answered</button>
                    )
                  )}
                  <div className="ml-auto flex gap-3">
                    {(p.user_id === me || isAdmin) && (
                      <button onClick={() => del(p.id)} className="text-[11px] text-rog-muted hover:text-danger">Delete</button>
                    )}
                    {p.user_id !== me && !p.id.startsWith("temp-") && <ReportButton targetType="prayer" targetId={p.id} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
