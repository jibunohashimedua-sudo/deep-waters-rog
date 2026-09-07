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

const ICON: Record<string, string> = {
  mention: "@",
  comment: "💬",
  amen: "🙏",
  announcement: "📣",
  badge: "🏅",
  reminder: "⏰"
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
            <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Notifications</h1>
          </div>
          {items.some((n) => !n.read) && (
            <button onClick={markAllRead} className="text-xs text-rog-purple underline">
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {loading ? (
            <p className="text-rog-muted">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-rog-muted">Nothing yet.</p>
          ) : (
            items.map((n) => {
              const inner = (
                <div className={`card flex gap-3 ${n.read ? "opacity-60" : "border-rog-purple"}`}>
                  <div className="text-xl w-8 text-center">{ICON[n.kind] ?? "•"}</div>
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
