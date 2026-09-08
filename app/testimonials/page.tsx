"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { friendlyError } from "@/lib/errors";
import { TESTIMONY_MAX } from "@/lib/limits";

export default function TestimonialPage() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Server-side length cap lives in /api/testimonial. Client maxLength
    // still bites first for the common case; the API is the boundary.
    const res = await fetch("/api/testimonial", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body })
    });
    setSaving(false);
    if (!res.ok) {
      if (res.status === 401) return router.push("/login");
      const j = await res.json().catch(() => ({}));
      setError(friendlyError(j.error));
      return;
    }
    setDone(true);
  }

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-6 py-10">
        <p className="kicker">Your story</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Share a testimony</h1>
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
              maxLength={TESTIMONY_MAX}
              enterKeyHint="enter"
              placeholder="Write freely..."
              className="w-full border border-rog-line bg-white px-6 py-4 focus:border-rog-purple focus:outline-none leading-relaxed"
            />
            <p className="text-xs text-rog-muted text-right">{body.length}/{TESTIMONY_MAX}</p>
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
