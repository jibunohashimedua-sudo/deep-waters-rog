"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { enqueue } from "@/lib/offline/queue";
import { reportOffline, reportOnline } from "@/lib/offline/useOnline";

export default function ReflectionForm({
  dayNumber,
  existing,
  userName,
  userPhoto,
  future = false,
  futureDate = null,
  isPrivate = false
}: {
  dayNumber: number;
  existing: { verse_reference: string | null; verse_text: string | null; reflection: string | null } | null;
  userName: string;
  userPhoto: string | null;
  /** True when this day hasn't arrived yet — read ahead, save later. */
  future?: boolean;
  /** The date this day maps to, for the "save on …" line. Not shown when null. */
  futureDate?: string | null;
  /** A private member's reflection is not shared anywhere, because there is
      no feed in his app. The line under the label has to say what is
      actually true for him rather than promising an audience he has not
      got. */
  isPrivate?: boolean;
}) {
  const router = useRouter();
  const [verseRef, setVerseRef] = useState(existing?.verse_reference ?? "");
  const [verseText, setVerseText] = useState(existing?.verse_text ?? "");
  const [reflection, setReflection] = useState(existing?.reflection ?? "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!!existing);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  /** Written with no signal and waiting in the queue. Said plainly, once,
      where the share card would otherwise be. */
  const [queued, setQueued] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      day_number: dayNumber,
      verse_reference: verseRef.trim() || null,
      verse_text: verseText.trim() || null,
      reflection: reflection.trim() || null
    };

    let res: Response;
    try {
      res = await fetch("/api/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      // A reflection is the one thing on this screen the reader wrote
      // themselves, and it is never thrown away for want of a signal. It
      // goes in the queue and the day is marked kept — because it is: they
      // did the reading and they wrote the words, and the only thing still
      // outstanding is a round trip they did not ask for.
      //
      // Not offered as a share card, though. The card is rendered by the
      // server at /api/og, so there would be nothing to show.
      reportOffline();
      await enqueue("reflection", payload);
      setLoading(false);
      setDone(true);
      setQueued(true);
      return;
    }

    reportOnline();
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
      {/* The writing surface. The old "Reflection" mark above the heading
          was a label announcing the heading underneath it, which is the
          one thing a meta must never be — the heading says it already. */}
      <section className="surface-soft">
        <h2 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-rog-ink leading-tight">
          {future
            ? `Reflection for Day ${dayNumber}`
            : done
              ? "Today's reflection is kept"
              : "Today's reflection"}
        </h2>

        {/* A future day can be read, but can't be saved yet — a completion
            is a record that the day was done, and it isn't. The form is
            visible so people can see what the shape is; the button is off
            until that date lands. */}
        {future && (
          <p className="mt-3 text-[13px] leading-5 text-rog-muted">
            You&rsquo;re reading ahead. You&rsquo;ll be able to save this reflection{" "}
            {futureDate ? `on ${futureDate}` : "when this day arrives"}.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-10">
          {/* Verse info zone — a quieter grouping */}
          <div className="pb-10 border-b border-rog-line space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-rog-ink">
                The verse that stood out
              </label>
              <input
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                value={verseRef}
                onChange={(e) => setVerseRef(e.target.value)}
                placeholder="e.g. Genesis 1:3"
                className="w-full border border-rog-line px-4 py-3 font-serif text-[15px] focus:border-rog-purple focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-rog-ink">
                The words themselves
              </label>
              <p className="mt-1 mb-2 text-xs text-rog-muted">
                So they travel with your reflection.
              </p>
              <textarea
                value={verseText}
                onChange={(e) => setVerseText(e.target.value)}
                placeholder="From today's reading, or type it in."
                rows={2}
                enterKeyHint="next"
                className="w-full border border-rog-line px-4 py-3 font-serif text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none"
              />
            </div>
          </div>

          {/* Reflection zone — the writing surface, generous */}
          <div className="pt-10">
            <label className="block text-sm font-medium text-rog-ink">
              What it stirred
            </label>
            <p className="mt-1 mb-2 text-xs text-rog-muted">
              {isPrivate
                ? "Kept with your day. Yours to read back, nobody else's."
                : "Shared to the community feed when you save. Leave empty to keep it private."}
            </p>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="In a sentence, or a paragraph."
              rows={5}
              enterKeyHint="done"
              className="w-full border border-rog-line px-4 py-3 font-serif text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || future}
            className="btn-primary w-full mt-10 disabled:opacity-50"
          >
            {future
              ? "Not yet"
              : loading
                ? "Saving..."
                : done
                  ? "Save changes"
                  : "Save today"}
          </button>
        </form>
      </section>

      {/* Written with no signal. Said once, plainly, and nothing is asked of
          the reader — the queue is already carrying it. */}
      {queued && (
        <p className="offline-stamp mt-4">
          Kept on this device. It&rsquo;ll be saved to your account, and shared with
          the church if you&rsquo;ve chosen to, as soon as you have a connection.
        </p>
      )}

      {/* Level 2 — the completion reveal, mounted like a Polaroid on card stock */}
      {done && cardUrl && (
        <section className="card mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Today, as a card</h2>
          <div className="reveal-mat mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl}
              alt="Day completion card"
              className="w-full block"
            />
          </div>
          <p className="mt-6 text-sm text-rog-muted">
            Save it to your camera roll, or share it in your feed.
          </p>
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
            className="btn-primary w-full mt-3"
          >
            Download the card
          </button>
        </section>
      )}
    </>
  );
}
