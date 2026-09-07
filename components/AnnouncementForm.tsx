"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AnnouncementForm({ cohortId }: { cohortId: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("announcements").insert({
      cohort_id: cohortId,
      author_id: user.id,
      title: title.trim() || null,
      body: body.trim()
    });
    setSaving(false);
    if (error) setMsg(error.message);
    else {
      setTitle("");
      setBody("");
      setMsg("Posted. Members have been notified.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={post} className="card space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full rounded-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
      />
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write your announcement..."
        className="w-full border border-rog-line bg-white px-5 py-2.5 focus:border-rog-purple focus:outline-none"
      />
      <button type="submit" disabled={saving || !body.trim()} className="btn-primary w-full disabled:opacity-50">
        {saving ? "Posting..." : "Post announcement"}
      </button>
      {msg && <p className="text-sm text-rog-purple">{msg}</p>}
    </form>
  );
}
