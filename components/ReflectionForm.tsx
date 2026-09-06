"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReflectionForm({
  dayNumber,
  existing,
  userName,
  userPhoto
}: {
  dayNumber: number;
  existing: { verse_reference: string | null; verse_text: string | null; reflection: string | null } | null;
  userName: string;
  userPhoto: string | null;
}) {
  const router = useRouter();
  const [verseRef, setVerseRef] = useState(existing?.verse_reference ?? "");
  const [verseText, setVerseText] = useState(existing?.verse_text ?? "");
  const [reflection, setReflection] = useState(existing?.reflection ?? "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!existing);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        day_number: dayNumber,
        verse_reference: verseRef.trim() || null,
        verse_text: verseText.trim() || null,
        reflection: reflection.trim() || null
      })
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      const params = new URLSearchParams({
        day: String(dayNumber),
        name: userName,
        verse: verseRef.trim(),
        text: verseText.trim(),
        photo: userPhoto ?? ""
      });
      setCardUrl(`/api/og?${params.toString()}`);
      router.refresh();
    }
  }

  return (
    <>
      {/* Level 1 — a soft plate. Writing your reflection should feel like writing on a page. */}
      <section className="surface-soft">
        <p className="chapter-mark">Reflection</p>
        <h2 className="mt-3 font-serif text-2xl md:text-3xl font-medium text-rog-ink leading-tight">
          {done ? "You've completed today" : "Mark today complete"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              The verse that stood out
            </label>
            <input
              value={verseRef}
              onChange={(e) => setVerseRef(e.target.value)}
              placeholder="e.g. Genesis 1:3"
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              The verse text (optional)
            </label>
            <textarea
              value={verseText}
              onChange={(e) => setVerseText(e.target.value)}
              placeholder="Type or paste the verse..."
              rows={2}
              className="w-full rounded-2xl border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Reflection (optional, shared with the community)
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What did this stir in you?"
              rows={3}
              className="w-full rounded-2xl border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Saving..." : done ? "Update today" : "Complete Day " + dayNumber}
          </button>
        </form>
      </section>

      {/* Level 2 — the celebration reveal. Distinct from the form. */}
      {done && cardUrl && (
        <section className="card mt-6">
          <p className="chapter-mark">Your share card</p>
          <div className="mt-4 rounded-2xl overflow-hidden border border-rog-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt="Day completion card" className="w-full" />
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(cardUrl);
                const blob = await res.blob();
                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objUrl;
                a.download = `deep-waters-day-${dayNumber}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(objUrl);
              } catch {
                window.open(cardUrl, "_blank");
              }
            }}
            className="btn-pink w-full mt-4"
          >
            Download to share
          </button>
        </section>
      )}
    </>
  );
}
