"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NoteEditor({
  day,
  initialTitle,
  initialBody
}: {
  day: number;
  initialTitle: string;
  initialBody: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("study_notes").upsert({
      day_number: day,
      title: title.trim() || null,
      body: body.trim() || null,
      author_id: user?.id ?? null,
      updated_at: new Date().toISOString()
    });
    setSaving(false);
    setMsg(error ? error.message : "Saved");
    if (!error) router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. In the beginning"
          className="w-full rounded-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Write the day's study note. Plain text, line breaks are kept."
          className="w-full border border-rog-line bg-white px-5 py-3 focus:border-rog-purple focus:outline-none font-sans leading-relaxed"
        />
        <p className="mt-1 text-xs text-rog-muted">{body.length} characters</p>
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
        {saving ? "Saving..." : "Save note"}
      </button>
      {msg && <p className="text-sm text-rog-purple text-center">{msg}</p>}
    </form>
  );
}
