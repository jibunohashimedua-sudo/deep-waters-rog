"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  async function update(patch: Record<string, unknown>) {
    setBusy(true);
    await supabase.from("profiles").update(patch).eq("id", userId);
    setBusy(false);
    router.refresh();
  }

  async function del() {
    setBusy(true);
    await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId })
    });
    setBusy(false);
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
    </div>
  );
}
