"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/errors";

export default function ResetMyData() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<{ msg: string; tables: string[] } | null>(null);

  async function reset() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/reset-my-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "activity" })
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || j?.ok === false) {
        // Name the tables that refused so the person and an admin can see
        // where the reset stopped short.
        const results: Record<string, string> = j?.results ?? {};
        const failedTables = Object.entries(results)
          .filter(([, v]) => typeof v === "string" && v.startsWith("error"))
          .map(([k]) => k);
        setFailure({
          msg: friendlyError(j?.error),
          tables: failedTables
        });
        setBusy(false);
        return;
      }
      setBusy(false);
      setDone(true);
      setStep(0);
      router.refresh();
    } catch (err: any) {
      setBusy(false);
      setFailure({ msg: friendlyError(err?.message), tables: [] });
    }
  }

  if (done) {
    return (
      <div className="card border-success">
        <p className="text-sm text-success font-semibold">Your activity has been cleared.</p>
        <p className="text-xs text-rog-muted mt-1">
          Days, reflections, comments, amens, prayers, and badges are reset. Refresh to see it.
        </p>
      </div>
    );
  }

  return (
    <div className="card !border-dashed">
      <p className="font-bold text-rog-purple">Reset my activity</p>
      <p className="text-xs text-rog-muted mt-1">
        Clears your completed days, reflections, comments, amens, prayer posts, and badges.
        Your account and profile stay. This cannot be undone.
      </p>
      {failure && (
        <div className="mt-3 text-xs text-danger" role="alert">
          <p>{failure.msg}</p>
          {failure.tables.length > 0 && (
            <p className="mt-1 text-rog-muted">
              Didn&rsquo;t clear: <span className="font-mono">{failure.tables.join(", ")}</span>. Tell an admin.
            </p>
          )}
        </div>
      )}
      {step === 0 ? (
        <button
          onClick={() => setStep(1)}
          className="btn-danger text-sm mt-3"
        >
          Reset my activity
        </button>
      ) : (
        <div className="mt-3 flex gap-2 items-center">
          <span className="text-sm text-rog-ink">Are you sure?</span>
          <button
            onClick={reset}
            disabled={busy}
            className="btn-danger text-sm disabled:opacity-50"
          >
            {busy ? "Clearing..." : "Yes, clear everything"}
          </button>
          <button onClick={() => setStep(0)} className="text-sm text-rog-muted">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
