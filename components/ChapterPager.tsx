"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE_AFTER_MS, requiredDwellMs } from "@/lib/readingPace";
import { enqueue } from "@/lib/offline/queue";
import { noteLocalRead, hasLocalRead } from "@/lib/offline/progress";
import { reportOffline, reportOnline } from "@/lib/offline/useOnline";

type Props = {
  dayNumber: number;
  book: string;
  chapter: number;
  /** Words of scripture in this chapter, counted server-side. */
  words: number;
  /** Already in chapter_reads when the page rendered. */
  alreadyRead: boolean;
  /** 1-based place in the day's sequence, and how long that sequence is. */
  position: number;
  total: number;
  prevHref: string | null;
  prevLabel: string | null;
  nextHref: string;
  /** "Next: Genesis 2", or "Finish day" on the last chapter. */
  nextLabel: string;
  isLast: boolean;
  /** False on a day the reader hasn't reached: they may read ahead, but
      marking ahead is refused server-side and isn't ours to record. */
  canRecord: boolean;
};

/** How often the dwell clock ticks. A second is plenty for a threshold
    measured in tens of seconds, and it costs nothing. */
const TICK_MS = 1000;

/**
 * The foot of a chapter: where you are, the way on, and the quiet moment
 * the chapter gets recorded.
 *
 * Reading is recorded by moving on. Two things have to be true before a
 * chapter counts: its last verse has been on screen, and the reader has
 * spent long enough in it for that to have been reading rather than
 * scrolling (lib/readingPace works the time out from the chapter's own
 * word count, so Psalm 119 asks for more than Psalm 117). Tapping Next is
 * the third thing — the reader saying they are done with it — and it sits
 * on top of the other two rather than replacing them, so a flick to the
 * bottom and an instant tap still doesn't count.
 *
 * If the conditions aren't met, Next still takes you on. It just doesn't
 * record. Nobody is blocked, nothing is explained, no one is nagged: the
 * reader came here to read, not to satisfy a page.
 *
 * Presence, not scrolling. An IntersectionObserver watches the last verse;
 * a scroll listener would run on every frame of every scroll of a long
 * chapter, which is the wrong thing to put on the one screen that has to
 * stay smooth. The clock only advances while the page is visible and the
 * reader has moved in the last minute, so reading on the sofa counts and a
 * phone face-down on the table does not. A short chapter that fits on one
 * screen never scrolls, so its last verse is there from the moment it
 * opens and the dwell decides it alone — intended, not a hole.
 */
export default function ChapterPager({
  dayNumber,
  book,
  chapter,
  words,
  alreadyRead,
  position,
  total,
  prevHref,
  prevLabel,
  nextHref,
  nextLabel,
  isLast,
  canRecord
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recorded, setRecorded] = useState(alreadyRead);
  const [toast, setToast] = useState<string | null>(null);

  // The clock and the observer's answer live in refs: they change every
  // second and nothing on screen depends on them, so re-rendering a page
  // of scripture once a second to store a number would be absurd.
  const dwell = useRef(0);
  const reachedEnd = useRef(false);
  const lastActive = useRef(Date.now());
  const sent = useRef(alreadyRead);

  // A chapter recorded with no signal is still recorded. The server row
  // isn't there yet, so `alreadyRead` arrived false — but the reader read
  // it, and coming back to it must not say otherwise, nor offer to record
  // it a second time.
  useEffect(() => {
    if (alreadyRead) return;
    let cancelled = false;
    void hasLocalRead({ day_number: dayNumber, book, chapter }).then((yes) => {
      if (cancelled || !yes) return;
      sent.current = true;
      setRecorded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [alreadyRead, dayNumber, book, chapter]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const verses = document.querySelectorAll<HTMLElement>(".dw-verse");
    const last = verses[verses.length - 1];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Once seen, it stays seen — scrolling back up to re-read the
          // middle of a chapter doesn't un-finish it.
          if (entry.isIntersecting) reachedEnd.current = true;
        }
      },
      { threshold: 0 }
    );
    if (last) observer.observe(last);

    const noteActivity = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener("scroll", noteActivity, { passive: true });
    window.addEventListener("touchstart", noteActivity, { passive: true });
    window.addEventListener("pointerdown", noteActivity, { passive: true });
    window.addEventListener("keydown", noteActivity);
    // Coming back to the tab is activity in itself, and the idle clock
    // shouldn't have been running while it was hidden anyway.
    const onVisibility = () => {
      if (document.visibilityState === "visible") noteActivity();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive.current > IDLE_AFTER_MS) return;
      dwell.current += TICK_MS;
    }, TICK_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener("scroll", noteActivity);
      window.removeEventListener("touchstart", noteActivity);
      window.removeEventListener("pointerdown", noteActivity);
      window.removeEventListener("keydown", noteActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Re-armed per chapter: each one gets its own clock and its own end.
  }, [book, chapter]);

  /**
   * Record the chapter.
   *
   * `keepalive` because this fires as the reader navigates away, and a
   * plain fetch is cancelled when the page goes. The request is never
   * waited on: moving to the next chapter must not wait for a network.
   *
   * "mark" mode, never a toggle — see /api/chapter-read. Re-reading a
   * chapter must not quietly un-record it.
   *
   * A failed request used to put the tick back and hope a later pass caught
   * it. On a train there is no later pass — the reader walks fourteen
   * chapters, every request fails, and the day ends up recording none of
   * them. So a failure now goes into the queue instead, and the queue sends
   * it when the signal comes back. The screen keeps saying "Read", because
   * they did read it.
   */
  const record = useCallback(() => {
    if (!canRecord || sent.current) return;
    sent.current = true;
    setRecorded(true);

    const payload = { day_number: dayNumber, book, chapter, mode: "mark" };

    // Noted on the device first, so the day view is right the moment the
    // reader gets back to it, with or without a network.
    void noteLocalRead({ day_number: dayNumber, book, chapter });

    void fetch("/api/chapter-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    })
      .then((res) => {
        reportOnline();
        // A 5xx or a 401 is worth another go later; the endpoint already
        // treats a duplicate as success, so re-sending costs nothing.
        if (!res.ok && (res.status >= 500 || res.status === 401)) {
          void enqueue("chapter-read", payload);
        }
      })
      .catch(() => {
        reportOffline();
        void enqueue("chapter-read", payload);
      });
  }, [canRecord, dayNumber, book, chapter]);

  function onNext() {
    const met = reachedEnd.current && dwell.current >= requiredDwellMs(words);
    if (met) record();
    // Either way, they move on. The conditions decide what is recorded,
    // never whether the reader may leave.
    router.push(nextHref);
  }

  /** The one fallback: the audio Bible in the car, a paper Bible at the
      kitchen table. Quiet, in the overflow, never the main path. */
  function markElsewhere() {
    setMenuOpen(false);
    if (!canRecord || recorded) return;
    record();
    setToast(`${book} ${chapter} marked read`);
    window.setTimeout(() => setToast(null), 2600);
    router.refresh();
  }

  return (
    <div className="chapter-pager mt-16">
      <div className="chapter-pager-where">
        <span className="meta">
          Chapter {position} of {total} today
        </span>
        {recorded && (
          <span className="meta chapter-pager-kept" aria-label="Recorded as read">
            Read
          </span>
        )}
      </div>

      <div className="chapter-pager-controls mt-3">
        {prevHref ? (
          <button
            type="button"
            onClick={() => router.push(prevHref)}
            className="btn-secondary chapter-pager-prev"
          >
            <span aria-hidden>&larr;</span>
            <span className="truncate">{prevLabel}</span>
          </button>
        ) : (
          <span className="chapter-pager-prev" />
        )}

        <button type="button" onClick={onNext} className="btn-primary chapter-pager-next">
          <span className="truncate">{nextLabel}</span>
          <span aria-hidden>{isLast ? "✓" : "→"}</span>
        </button>
      </div>

      {/* The override. One item, behind a dot menu, because it answers a
          real question — "I read this somewhere the app couldn't see" —
          that is not the usual one. */}
      <div className="chapter-pager-more mt-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More for this chapter"
          className="chapter-pager-dots"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="6" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="18" cy="12" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <div role="menu" className="chapter-pager-menu">
            <button
              type="button"
              role="menuitem"
              onClick={markElsewhere}
              disabled={!canRecord || recorded}
              className="chapter-pager-menu-item"
            >
              {recorded ? "Already recorded" : "I read this elsewhere"}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="toast" style={{ bottom: 0 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
