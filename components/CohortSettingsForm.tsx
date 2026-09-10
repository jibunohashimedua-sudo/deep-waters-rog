"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { noteBack } from "@/lib/navHistory";
import {
  COHORT_NAME_MAX,
  COHORT_DESCRIPTION_MAX,
  COHORT_WELCOME_MAX,
  capText
} from "@/lib/limits";

export default function CohortSettingsForm({
  cohortId,
  slug,
  initialName,
  initialDescription,
  initialWelcome,
  initialStartDate
}: {
  cohortId: string;
  slug: string;
  initialName: string;
  initialDescription: string;
  initialWelcome: string;
  initialStartDate: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [welcome, setWelcome] = useState(initialWelcome);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const cappedName = capText(name, COHORT_NAME_MAX);
    if (!cappedName) {
      setSaving(false);
      setMsg("Cohort name can't be empty.");
      return;
    }
    // Read the row back after the update. Supabase returns no error for a
    // zero-row update — same shape as success — so a cohort that was
    // deleted from another tab used to save silently to nowhere and the
    // leader was told "Saved". Now it says what really happened.
    const { data, error } = await supabase
      .from("cohorts")
      .update({
        name: cappedName,
        description: capText(description, COHORT_DESCRIPTION_MAX),
        welcome_message: capText(welcome, COHORT_WELCOME_MAX),
        start_date: startDate
      })
      .eq("id", cohortId)
      .select("id");
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setMsg("This cohort no longer exists.");
      return;
    }
    setMsg("Saved");
    router.refresh();
  }

  async function del() {
    const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
    if (error) {
      setMsg(error.message);
      return;
    }
    // replace, not push: this page is about a cohort that no longer
    // exists, so the back gesture must not be able to walk into it.
    // Straight to People rather than through /cohorts, which is itself
    // only a redirect.
    noteBack();
    router.replace("/community?view=cohorts");
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          required
          type="text"
          enterKeyHint="next"
          maxLength={COHORT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={COHORT_DESCRIPTION_MAX}
          enterKeyHint="next"
          placeholder="Shown on the join page"
          className="w-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Welcome message</label>
        <textarea
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          rows={3}
          maxLength={COHORT_WELCOME_MAX}
          enterKeyHint="done"
          placeholder="Shown to members after they join"
          className="w-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Start date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
        <p className="mt-1 text-xs text-rog-muted">
          Changing this does not change existing members&rsquo; start dates.
        </p>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-danger"
          >
            Delete cohort
          </button>
        ) : (
          <button type="button" onClick={del} className="btn-danger">
            Confirm delete
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-rog-purple">{msg}</p>}
      <p className="text-xs text-rog-muted">
        Invite link: <span className="font-mono">/c/{slug}</span>
      </p>
    </form>
  );
}
