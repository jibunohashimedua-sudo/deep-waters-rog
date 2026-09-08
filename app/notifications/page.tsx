"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import Icon, { type IconName } from "@/components/Icons";

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
 * `mention` is the exception and stays a character: "@" is a typographic mark
 * rather than a picture, it is set in the font we ship, and no drawing of it
 * would be clearer than the thing itself.
 */
const ICON: Record<string, IconName> = {
  comment: "testimony",
  amen: "amen",
  announcement: "announcements",
  badge: "badge",
  reminder: "reminder"
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
                <div key={i} className="card flex gap-3">
                  <div className="skeleton w-10 h-10 !rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="skeleton h-3 w-3/5" />
                    <div className="skeleton mt-2 h-3 w-2/5" />
                  </div>
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
                <div className={`card flex gap-3 ${n.read ? "opacity-60" : "!border-rog-purple"}`}>
                  <div className="w-8 shrink-0 flex justify-center text-rog-muted">
                    {n.kind === "mention" ? (
                      <span className="font-mono text-[15px] leading-none" aria-hidden>
                        @
                      </span>
                    ) : ICON[n.kind] ? (
                      <Icon name={ICON[n.kind]} />
                    ) : (
                      <span className="font-mono text-[15px] leading-none" aria-hidden>
                        &middot;
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-rog-ink text-sm">{n.title}</p>
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
