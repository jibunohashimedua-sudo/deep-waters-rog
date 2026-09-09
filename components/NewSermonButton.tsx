"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/errors";

/**
 * Starts an empty draft and opens it. One button, one job.
 *
 * Through /api/sermon rather than straight at the table, so the caps in
 * lib/limits.ts are the only thing that decides how big a sermon may be.
 * ELITE_EXCELLENCE_AUDIT P2-G.
 */
export default function NewSermonButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sermon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.id) {
        setErr(friendlyError(j.error));
        return;
      }
      router.push(`/sermons/${j.id}`);
    } catch (e: any) {
      setErr(friendlyError(e?.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="btn-primary disabled:opacity-50"
      >
        {busy ? "Starting…" : "New sermon"}
      </button>
      {err && <p className="mt-3 text-xs text-danger">{err}</p>}
    </div>
  );
}
