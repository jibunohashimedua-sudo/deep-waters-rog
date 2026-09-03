"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetMyData() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch("/api/reset-my-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: "activity" })
    });
    setBusy(false);
    setDone(true);
    setStep(0);
    router.refresh();
  }

  if (done) {
    return (
      <div className="card border-green-300">
        <p className="text-sm text-green-700 font-semibold">Your activity has been cleared.</p>
        <p className="text-xs text-rog-muted mt-1">
          Days, reflections, comments, amens, prayers, and badges are reset. Refresh to see it.
        </p>
      </div>
    );
  }

  return (
    <div className="card border-dashed">
      <p className="font-bold text-rog-purple">Reset my activity</p>
      <p className="text-xs text-rog-muted mt-1">
        Clears your completed days, reflections, comments, amens, prayer posts, and badges.
        Your account and profile stay. This cannot be undone.
      </p>
      {step === 0 ? (
        <button
          onClick={() => setStep(1)}
          className="btn-secondary text-sm mt-3 text-red-600 border-red-200"
        >
          Reset my activity
        </button>
      ) : (
        <div className="mt-3 flex gap-2 items-center">
          <span className="text-sm text-rog-ink">Are you sure?</span>
          <button
            onClick={reset}
            disabled={busy}
            className="btn text-sm px-4 py-2 bg-red-600 text-white disabled:opacity-50"
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
