"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  bookSlug: string;
  bookName: string;
  chapters: number;
  /** Chapters this reader has already met through the 90-day plan. */
  read: number[];
};

/** How long a press has to last before it means "show me the verses". */
const LONG_PRESS_MS = 450;

/** Finger drift, in px, past which a press is a scroll and not a press. */
const DRIFT_CANCEL_PX = 10;

type SheetState =
  | { open: false }
  | { open: true; chapter: number; status: "loading" }
  | { open: true; chapter: number; status: "ready"; count: number }
  | { open: true; chapter: number; status: "unavailable" };

/**
 * The chapter grid, with a second way in underneath it.
 *
 * A tap opens the chapter at the top, which is what most people want most of
 * the time. A press and hold — or a right-click, or the keyboard menu key —
 * opens the verses in that chapter instead, so somebody who has just heard
 * "Psalm twenty-three, verse four" gets there in two taps rather than
 * arriving at the top of the psalm and scrolling.
 *
 * Verse counts come from the API on demand rather than from a table kept
 * here. They are fetched only when a grid is actually opened: Psalms alone
 * would be 150 chapter loads to know every count up front, for a panel
 * almost nobody opens.
 */
export default function ChapterGrid({ bookSlug, bookName, chapters, read }: Props) {
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const readSet = new Set(read);

  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  // Set when a long press fires, so the click that the browser sends
  // afterwards doesn't also navigate to the chapter.
  const swallowClick = useRef(false);
  // Counts we've already asked for, so reopening a grid is instant.
  const countCache = useRef<Map<number, number | null>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  const openVerses = useCallback(
    async (chapter: number) => {
      const cached = countCache.current.get(chapter);
      if (cached !== undefined) {
        setSheet(
          cached === null
            ? { open: true, chapter, status: "unavailable" }
            : { open: true, chapter, status: "ready", count: cached }
        );
        return;
      }

      setSheet({ open: true, chapter, status: "loading" });
      try {
        const res = await fetch(
          `/api/bible/verse-count?book=${encodeURIComponent(bookSlug)}&chapter=${chapter}`
        );
        const json = await res.json();
        const count: number | null =
          res.ok && typeof json.count === "number" ? json.count : null;
        countCache.current.set(chapter, count);
        setSheet((s) =>
          // Don't stomp on a panel the reader has since closed or changed.
          s.open && s.chapter === chapter
            ? count === null
              ? { open: true, chapter, status: "unavailable" }
              : { open: true, chapter, status: "ready", count }
            : s
        );
      } catch {
        setSheet((s) =>
          s.open && s.chapter === chapter
            ? { open: true, chapter, status: "unavailable" }
            : s
        );
      }
    },
    [bookSlug]
  );

  function cancelPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  }

  function onPointerDown(e: React.PointerEvent, chapter: number) {
    // Only a primary press starts the timer; a right-click is handled by
    // onContextMenu and shouldn't also run this.
    if (e.button !== 0) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    swallowClick.current = false;
    pressTimer.current = window.setTimeout(() => {
      swallowClick.current = true;
      pressTimer.current = null;
      void openVerses(chapter);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const origin = pressOrigin.current;
    if (!origin) return;
    const drifted =
      Math.abs(e.clientX - origin.x) > DRIFT_CANCEL_PX ||
      Math.abs(e.clientY - origin.y) > DRIFT_CANCEL_PX;
    // Somebody scrolling the grid with their thumb resting on a tile is not
    // asking for anything.
    if (drifted) cancelPress();
  }

  function onClick(e: React.MouseEvent) {
    if (swallowClick.current) {
      e.preventDefault();
      swallowClick.current = false;
    }
  }

  function close() {
    setSheet({ open: false });
  }

  // Escape closes, and focus moves into the panel when it opens so the verse
  // grid is reachable without a mouse.
  useEffect(() => {
    if (!sheet.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet.open]);

  return (
    <>
      <ul className="mt-10 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {Array.from({ length: chapters }, (_, i) => i + 1).map((c) => {
          const done = readSet.has(c);
          return (
            <li key={c}>
              <Link
                href={`/bible/${bookSlug}/${c}`}
                data-read={done ? "true" : undefined}
                aria-label={
                  done
                    ? `${bookName} chapter ${c}, already read in your plan`
                    : `${bookName} chapter ${c}`
                }
                className="chapter-tile"
                onPointerDown={(e) => onPointerDown(e, c)}
                onPointerMove={onPointerMove}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onPointerLeave={cancelPress}
                onClick={onClick}
                onContextMenu={(e) => {
                  e.preventDefault();
                  cancelPress();
                  void openVerses(c);
                }}
              >
                {c}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-rog-muted">
        Press and hold a chapter to jump straight to a verse.
      </p>

      {sheet.open && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="sheet-backdrop absolute inset-0 w-full"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Verses in ${bookName} ${sheet.chapter}`}
            tabIndex={-1}
            className="verse-sheet"
          >
            <div className="pt-2 pb-2 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
            </div>
            <div className="px-5 pb-6">
              <p className="kicker">Jump to a verse</p>
              <h2 className="mt-2 font-serif text-2xl font-medium text-rog-ink leading-tight">
                {bookName} {sheet.chapter}
              </h2>

              {sheet.status === "loading" && (
                <p className="mt-6 text-sm text-rog-muted">Counting the verses…</p>
              )}

              {sheet.status === "unavailable" && (
                <div className="mt-6">
                  <p className="text-sm text-rog-muted">
                    We couldn&rsquo;t load the verse list just now.
                  </p>
                  <Link
                    href={`/bible/${bookSlug}/${sheet.chapter}`}
                    className="btn-secondary mt-4 inline-block"
                  >
                    Open the chapter instead
                  </Link>
                </div>
              )}

              {sheet.status === "ready" && (
                <ul className="mt-5 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[50vh] overflow-y-auto">
                  {Array.from({ length: sheet.count }, (_, i) => i + 1).map((v) => (
                    <li key={v}>
                      <Link
                        href={`/bible/${bookSlug}/${sheet.chapter}/${v}`}
                        className="chapter-tile"
                        aria-label={`${bookName} ${sheet.chapter} verse ${v}`}
                        onClick={close}
                      >
                        {v}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
