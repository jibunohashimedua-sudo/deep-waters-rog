"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReportButton({
  targetType,
  targetId
}: {
  targetType: "completion" | "comment" | "prayer" | "testimonial";
  targetId: string;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim() || null
    });
    setDone(true);
    setOpen(false);
  }

  if (done) return <span className="text-[11px] text-rog-muted">Reported</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[11px] text-rog-muted hover:text-danger">
        Report
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2 items-center">
      <input
        type="text"
        enterKeyHint="send"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="flex-1 rounded-full border border-rog-line px-3 py-1 text-xs"
      />
      <button onClick={submit} className="text-xs text-danger font-semibold">Send</button>
      <button onClick={() => setOpen(false)} className="text-xs text-rog-muted">Cancel</button>
    </div>
  );
}
