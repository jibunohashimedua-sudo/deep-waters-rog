"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { humanDate } from "@/lib/dates";
import AdminPersonRow, { type AdminAction } from "./AdminPersonRow";

type Props = {
  id: string;
  name: string;
  nickname?: string | null;
  photoUrl?: string | null;
  role: string;
  approved: boolean;
  isPastoral: boolean;
  startDate: string;
  joinedAt?: string | null;
  /** The admin looking at the list. Nobody gets actions on themselves. */
  isSelf: boolean;
};

/**
 * A member in the admin user list.
 *
 * All this holds is what each action does; the shape of the row is
 * AdminPersonRow's, shared with every other admin list. Replaces
 * UserAdminControls, which was four text buttons wedged onto the end of
 * the row and a confirm/cancel pair that appeared in the middle of them.
 */
export default function AdminUserRow(p: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  async function update(patch: Record<string, unknown>) {
    setError(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    router.refresh();
  }

  async function remove() {
    setError(null);
    // Deliberately still a confirm. It deletes an account and everything
    // hanging off it, and a sheet item is easier to hit by accident than
    // the two-step link it replaced.
    if (!window.confirm(`Remove ${p.name}? This deletes their account and everything in it.`)) {
      return;
    }
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: p.id })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(friendlyError(j.error));
      return;
    }
    router.refresh();
  }

  const actions: AdminAction[] = [];
  if (!p.isSelf) {
    if (!p.approved) {
      actions.push({ label: "Approve", onSelect: () => update({ approved: true }) });
    }
    actions.push(
      p.isPastoral
        ? { label: "Remove Elite", onSelect: () => update({ is_pastoral: false }) }
        : {
            label: "Grant Elite",
            hint: "The pastoral study layer",
            onSelect: () => update({ is_pastoral: true })
          }
    );
    actions.push(
      p.role === "admin"
        ? { label: "Demote to member", onSelect: () => update({ role: "member" }) }
        : { label: "Make admin", onSelect: () => update({ role: "admin" }) }
    );
    actions.push({
      label: "Remove from Deep Waters",
      hint: "Deletes the account and everything in it",
      destructive: true,
      onSelect: remove
    });
  }

  const badges: { label: string; tone?: "accent" | "warning" }[] = [];
  if (p.role === "admin") badges.push({ label: "Admin" });
  if (p.isPastoral) badges.push({ label: "Elite" });
  if (!p.approved) badges.push({ label: "Pending", tone: "warning" });

  return (
    <>
      <AdminPersonRow
        name={p.name}
        nickname={p.nickname}
        photoUrl={p.photoUrl}
        badges={badges}
        meta={[
          p.joinedAt && `Joined ${humanDate(p.joinedAt)}`,
          `Started ${humanDate(p.startDate)}`
        ]}
        actions={actions}
      />
      {error && <p className="admin-row-error">{error}</p>}
    </>
  );
}
