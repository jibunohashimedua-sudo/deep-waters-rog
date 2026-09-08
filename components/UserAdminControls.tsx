"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

export default function UserAdminControls({
  userId,
  role,
  approved
}: {
  userId: string;
  role: string;
  approved: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function update(patch: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    await supabase.from("profiles").update(patch).eq("id", userId);
    setBusy(false);
    router.refresh();
  }

  async function del() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(friendlyError(j.error));
      return;
    }
    // Success in both cases — user deleted, or already gone and profile
    // cleaned up. Refresh the list so the row drops.
    router.refresh();
  }

  return (
    <div className="flex gap-2 items-center text-xs">
      {!approved && (
        <button disabled={busy} onClick={() => update({ approved: true })} className="text-success font-semibold">
          Approve
        </button>
      )}
      {role === "admin" ? (
        <button disabled={busy} onClick={() => update({ role: "member" })} className="text-rog-muted">
          Demote
        </button>
      ) : (
        <button disabled={busy} onClick={() => update({ role: "admin" })} className="text-rog-purple font-semibold">
          Make admin
        </button>
      )}
      {!confirmDel ? (
        <button disabled={busy} onClick={() => setConfirmDel(true)} className="text-rog-muted hover:text-danger">
          Remove
        </button>
      ) : (
        <>
          <button disabled={busy} onClick={del} className="text-danger font-semibold">Confirm</button>
          <button onClick={() => setConfirmDel(false)} className="text-rog-muted">Cancel</button>
        </>
      )}
      {err && <span className="ml-1 text-[10px] text-danger">{err}</span>}
    </div>
  );
}
