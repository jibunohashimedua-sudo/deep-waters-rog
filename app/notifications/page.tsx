"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

type N = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

/**
 * What each kind of notice looks like.
 *
 * Drawn, not emoji — and drawn as the same marks the app already uses, so a
 * notice about an amen carries the mark on the amen button and a notice about
 * a comment carries the one under the reflection. A notification that looks
 * like the thing it is about needs less reading.
 *
 * Every kind is named in words now rather than drawn. The app has five icons
 * and they are the five tabs; a notification kind is not one of them, and a
 * one-word label in the metadata face says which it is more plainly than a
 * 19px picture of a bell ever did.
 *
 * "@" survives as the mark for a mention because it isn't a drawing: it is a
 * typographic character, set in the font we already ship, and nothing would
 * be clearer than the thing itself.
 */
const KIND_LABEL: Record<string, string> = {
  comment: "Reply",
  amen: "Amen",
  announcement: "Notice",
  badge: "Milestone",
  reminder: "Reminder"
};

export default function NotificationsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as N[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    load();
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="kicker">Inbox</p>
            <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Notifications</h1>
          </div>
          {items.some((n) => !n.read) && (
            <button onClick={markAllRead} className="text-xs text-rog-purple underline">
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading notifications</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="card">
                  <div className="skeleton h-2 w-16" />
                  <div className="skeleton mt-2 h-3 w-3/5" />
                  <div className="skeleton mt-2 h-3 w-2/5" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">Nothing yet.</p>
              <p className="empty-hint">Amens, comments and mentions will land here.</p>
            </div>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`card ${n.read ? "opacity-60" : "!border-rog-purple"}`}>
                  <div className="flex-1">
                    <p className="kicker">
                      {n.kind === "mention" ? "@ Mention" : KIND_LABEL[n.kind] ?? "Notice"}
                    </p>
                    <p className="font-semibold text-rog-ink text-sm mt-1">{n.title}</p>
                    {n.body && <p className="text-xs text-rog-muted mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-rog-muted mt-1">
                      {new Date(n.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => markRead(n.id)}>{inner}</Link>
              ) : (
                <div key={n.id} onClick={() => markRead(n.id)}>{inner}</div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
