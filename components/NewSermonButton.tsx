"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

/** Starts an empty draft and opens it. One button, one job. */
export default function NewSermonButton({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("sermons")
      .insert({ user_id: userId, title: "", blocks: [], status: "draft" })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setErr(friendlyError(error?.message));
      return;
    }
    router.push(`/sermons/${data.id}`);
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
