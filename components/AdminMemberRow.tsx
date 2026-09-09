"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { humanDate } from "@/lib/dates";
import AdminPersonRow, { type AdminAction } from "./AdminPersonRow";

type Props = {
  cohortId: string;
  userId: string;
  name: string;
  nickname?: string | null;
  photoUrl?: string | null;
  isLeader: boolean;
  joinedAt?: string | null;
  startDate?: string | null;
  daysKept: number;
  streak: number;
  isSelf: boolean;
};

/** A member in a cohort's manage list. Same row as the admin user list;
    only the actions differ, and here there is one. */
export default function AdminMemberRow(p: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    if (!window.confirm(`Remove ${p.name} from this cohort?`)) return;
    const { error } = await supabase
      .from("cohort_members")
      .delete()
      .eq("cohort_id", p.cohortId)
      .eq("user_id", p.userId);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    router.refresh();
  }

  const actions: AdminAction[] = p.isSelf
    ? []
    : [
        {
          label: "Remove from cohort",
          hint: "They keep their account and their reading",
          destructive: true,
          onSelect: remove
        }
      ];

  return (
    <>
      <AdminPersonRow
        name={p.name}
        nickname={p.nickname}
        photoUrl={p.photoUrl}
        badges={p.isLeader ? [{ label: "Leader" }] : []}
        meta={[
          p.joinedAt && `Joined ${humanDate(p.joinedAt)}`,
          p.startDate && `Started ${humanDate(p.startDate)}`,
          `${p.daysKept} kept`,
          `${p.streak} streak`
        ]}
        actions={actions}
      />
      {error && <p className="admin-row-error">{error}</p>}
    </>
  );
}
