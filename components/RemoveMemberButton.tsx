"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RemoveMemberButton({
  cohortId,
  userId
}: {
  cohortId: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirm, setConfirm] = useState(false);

  async function remove() {
    await supabase
      .from("cohort_members")
      .delete()
      .eq("cohort_id", cohortId)
      .eq("user_id", userId);
    router.refresh();
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-xs text-rog-muted hover:text-red-600">
        Remove
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button onClick={remove} className="text-xs text-red-600 font-semibold">Confirm</button>
      <button onClick={() => setConfirm(false)} className="text-xs text-rog-muted">Cancel</button>
    </div>
  );
}
