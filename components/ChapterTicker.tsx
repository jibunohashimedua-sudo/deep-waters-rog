"use client";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ChapterRow = {
  book: string;
  chapter: number;
  testament: "ot" | "nt";
};

type Props = {
  dayNumber: number;
  chapters: ChapterRow[];
  /** Chapters already ticked, as `${book}|${chapter}` keys. */
  initialTicks: Set<string>;
  /** Reading-ahead ticks are refused server-side; the UI locks in step. */
  disabled?: boolean;
  disabledReason?: string;
};

/**
 * The reader's own chapter tick list for a day.
 *
 * A row per chapter with a check-box; a progress bar above with a plain
 * mono line under it. Ticks are optimistic — the box responds under the
 * thumb, the API call goes out in the background, and the row rolls back
 * on a real failure with a small mono note beside the count.
 *
 * When every box is ticked, the day auto-completes (server-side); the
 * router refresh brings the reflection card and the whole-plan gauge
 * back in sync without a page load.
 */
export default function ChapterTicker({
  dayNumber,
  chapters,
  initialTicks,
  disabled = false,
  disabledReason
}: Props) {
  const router = useRouter();
  const [ticks, setTicks] = useState<Set<string>>(initialTicks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = chapters.length;
  const done = ticks.size;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = done === total && total > 0;

  const key = useCallback((c: ChapterRow) => `${c.book}|${c.chapter}`, []);

  const toggle = useCallback(
    async (c: ChapterRow) => {
      if (disabled) return;
      const k = key(c);
      const isOn = ticks.has(k);
      // Optimistic first — the box moves under the thumb.
      const next = new Set(ticks);
      if (isOn) next.delete(k);
      else next.add(k);
      setTicks(next);
      setError(null);

      try {
        const res = await fetch("/api/chapter-read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            day_number: dayNumber,
            book: c.book,
            chapter: c.chapter
          })
        });
        if (!res.ok) {
          throw new Error(
            (await res.json().catch(() => ({}))).error ?? "Couldn't save that."
          );
        }
        // Refresh the server tree so the reflection card, the gauge, and
        // the Depth grid all reflect the new is_full state without a
        // full page load.
        startTransition(() => router.refresh());
      } catch (err: any) {
        // Roll back on failure so what's on screen matches what's in the
        // database — nothing worse than a tick that looks saved but isn't.
        setTicks(ticks);
        setError(err?.message ?? "Couldn't save that.");
      }
    },
    [dayNumber, disabled, key, router, ticks]
  );

  // Ordered: OT first, then NT. Same list order as the reading page and
  // the reading tiles on the day view, so a reader ticking as they go
  // reads down the same list they arrived from.
  const ordered = useMemo(() => {
    const ot = chapters.filter((c) => c.testament === "ot");
    const nt = chapters.filter((c) => c.testament === "nt");
    return [...ot, ...nt];
  }, [chapters]);

  return (
    <section className="surface-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-rog-ink leading-tight">
          Chapters
        </h2>
        <span className="kicker" aria-live="polite">
          {done} of {total} read
        </span>
      </div>

      {/* Progress bar. Same gauge grammar as the whole-plan bar at the
          top of the day, one step down in size and set inside the plate. */}
      <div className="mt-4 gauge" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="gauge-fill" style={{ width: `${pct}%` }} />
      </div>

      {allDone && (
        <p className="mt-3 kicker" style={{ color: "var(--sonar)" }}>
          Day kept
        </p>
      )}

      {disabled && disabledReason && (
        <p className="mt-3 text-[13px] leading-5 text-rog-muted">{disabledReason}</p>
      )}

      {error && (
        <p className="mt-3 text-[13px] text-danger">{error}</p>
      )}

      <ul className="mt-5">
        {ordered.map((c) => {
          const k = key(c);
          const on = ticks.has(k);
          const inputId = `ch-${dayNumber}-${c.book.replace(/\s+/g, "-")}-${c.chapter}`;
          return (
            <li key={k} className="chapter-tick-row">
              <input
                id={inputId}
                type="checkbox"
                className="chapter-tick-box"
                checked={on}
                onChange={() => toggle(c)}
                disabled={disabled || pending}
                aria-label={`${c.book} ${c.chapter}${on ? ", read" : ""}`}
              />
              <label htmlFor={inputId} className="chapter-tick-label">
                <span className="chapter-tick-ref">
                  {c.book} {c.chapter}
                </span>
                <span className="kicker chapter-tick-testament">
                  {c.testament === "ot" ? "Old" : "New"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
