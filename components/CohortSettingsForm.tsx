"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    const { error } = await supabase
      .from("cohorts")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        welcome_message: welcome.trim() || null,
        start_date: startDate
      })
      .eq("id", cohortId);
    setSaving(false);
    setMsg(error ? error.message : "Saved");
    if (!error) router.refresh();
  }

  async function del() {
    const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
    if (error) setMsg(error.message);
    else router.push("/cohorts");
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          required
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
          placeholder="Shown on the join page"
          className="w-full rounded-2xl border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Welcome message</label>
        <textarea
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          rows={3}
          placeholder="Shown to members after they join"
          className="w-full rounded-2xl border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
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
            className="btn-secondary text-red-600 border-red-200"
          >
            Delete cohort
          </button>
        ) : (
          <button type="button" onClick={del} className="btn bg-red-600 text-white px-6 py-3">
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
