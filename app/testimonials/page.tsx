"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

export default function TestimonialPage() {
  const router = useRouter();
  const supabase = createClient();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return router.push("/login");
    const { error } = await supabase.from("testimonials").insert({ user_id: user.id, body: body.trim() });
    setSaving(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-6 py-10">
        <p className="kicker">Your story</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Share a testimony</h1>
        <p className="mt-2 text-sm text-rog-muted">
          What did God do in you through Deep Waters? Your story will be reviewed before it goes public.
        </p>

        {done ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">Thank you.</p>
            <p className="mt-1 text-sm text-rog-muted">Your testimony has been sent for review.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={1500}
              placeholder="Write freely..."
              className="w-full rounded-2xl border border-rog-line bg-white px-6 py-4 focus:border-rog-purple focus:outline-none leading-relaxed"
            />
            <p className="text-xs text-rog-muted text-right">{body.length}/1500</p>
            <button type="submit" disabled={saving || !body.trim()} className="btn-primary w-full disabled:opacity-50">
              {saving ? "Sending..." : "Submit testimony"}
            </button>
            {error && <p className="text-sm text-danger text-center">{error}</p>}
          </form>
        )}
      </main>
    </>
  );
}
