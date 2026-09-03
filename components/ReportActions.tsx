"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLE: Record<string, string> = {
  completion: "completions",
  comment: "comments",
  prayer: "prayer_requests",
  testimonial: "testimonials"
};

export default function ReportActions({
  reportId,
  targetType,
  targetId
}: {
  reportId: string;
  targetType: string;
  targetId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    setBusy(true);
    await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
    setBusy(false);
    router.refresh();
  }

  async function removeContent() {
    setBusy(true);
    await supabase.from(TABLE[targetType]).delete().eq("id", targetId);
    await supabase.from("reports").update({ resolved: true }).eq("id", reportId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={dismiss} className="btn-secondary text-xs px-4 py-2">
        Dismiss
      </button>
      <button disabled={busy} onClick={removeContent} className="btn bg-red-600 text-white text-xs px-4 py-2">
        Remove content
      </button>
    </div>
  );
}
