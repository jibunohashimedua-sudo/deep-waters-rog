"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export default function NewCohortPage() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      setLoading(false);
      return;
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    // Ensure uniqueness by appending a suffix if taken
    let attempt = 0;
    while (attempt < 5) {
      const { data: existing } = await supabase
        .from("cohorts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${Math.floor(Math.random() * 9999)}`;
    }

    const { error: insErr } = await supabase.from("cohorts").insert({
      slug,
      name: name.trim(),
      start_date: startDate,
      created_by: user.id
    });

    setLoading(false);
    if (insErr) setError(insErr.message);
    else router.push(`/c/${slug}`);
  }

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-6 py-10">
        <p className="kicker">Cohorts</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Create a new cohort
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          A group starting Deep Waters together. Share the link with your people.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Cohort name</label>
            <input
              required
              type="text"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. August 2026, Youth Church, Christ Embassy Luton"
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
            <p className="mt-1 text-xs text-rog-muted">
              Anyone joining via the invite link will start on this date.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create cohort"}
          </button>
          {error && (
            <p className="text-sm text-danger text-center">{error}</p>
          )}
        </form>
      </main>
    </>
  );
}
