"use client";
import { useEffect, useState, useCallback } from "react";
import LoadingRule from "@/components/LoadingRule";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { rememberView } from "@/lib/offline/views";

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
    const next = (data ?? []) as N[];
    setItems(next);
    setLoading(false);

    // Readable with no signal. Titles and bodies only — the link is left
    // behind on purpose, because every one of them goes to a screen that
    // needs the network, and an offline list of taps that all dead-end is
    // worse than a list that doesn't offer them.
    void rememberView(
      "notifications",
      next.map((n) => ({
        who: KIND_LABEL[n.kind] ?? n.kind,
        text: n.body ? `${n.title}\n\n${n.body}` : n.title
      }))
    );
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
            <LoadingRule label="Loading notifications" />
          ) : items.length === 0 ? (
            <div className="empty">
              <p>Nothing yet.</p>
            </div>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`card ${n.read ? "opacity-60" : "!border-rog-purple"}`}>
                  <div className="flex-1">
                    <p className="meta">
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
