"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IDLE_AFTER_MS,
  requiredDwellMs,
  untickKey,
  wasUnticked
} from "@/lib/readingPace";

type TrackedChapter = {
  book: string;
  chapter: number;
  /** Words of scripture in it, counted server-side from the chapter HTML. */
  words: number;
  /** Already in chapter_reads when the page rendered. */
  alreadyRead: boolean;
};

type Props = {
  dayNumber: number;
  chapters: TrackedChapter[];
  /** False on a day the reader hasn't reached — the API refuses those, and
      marking a day ahead isn't ours to do anyway. */
  enabled: boolean;
};

/** How often the dwell clock ticks. A second is plenty for a threshold
    measured in tens of seconds, and it costs nothing. */
const TICK_MS = 1000;

/** How long the confirmation stays up. Long enough to read, short enough
    that it is gone before it is in the way. */
const CONFIRM_MS = 2600;

/**
 * Chapters that record themselves as read.
 *
 * A chapter counts when two things are both true: its last verse has been
 * on screen, and the reader has spent long enough in it (lib/readingPace).
 * Reaching the end alone would credit a flick to the bottom; time alone
 * would credit a tab left open.
 *
 * Presence, not scrolling. An IntersectionObserver watches the chapter and
 * its last verse — a scroll listener would run on every frame of every
 * scroll of a long chapter, which is exactly the wrong thing to put on the
 * one screen that has to stay smooth. The clock only advances while the
 * page is visible and the reader has moved in the last minute, so reading
 * on the sofa counts and a phone face-down on the table does not.
 *
 * A short chapter that fits on one screen never scrolls, so its last verse
 * is on screen from the moment it opens and the dwell decides it on its
 * own. That is the intended behaviour, not a hole in it.
 *
 * It renders nothing but the confirmation: a line of mono at the foot of
 * the screen for a couple of seconds. Nothing modal, nothing that moves
 * the page, nothing that can take the scroll position away mid-sentence.
 */
export default function ChapterReadTracker({
  dayNumber,
  chapters,
  enabled
}: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // The server rebuilds `chapters` on every render, so the array identity
  // changes even when nothing about the day has. What matters is which
  // chapters they are and which are already recorded — this is that, as
  // one string, so the observers aren't torn down and rebuilt mid-scroll.
  const chapterSignature = chapters
    .map((c) => `${c.book}|${c.chapter}|${c.alreadyRead}`)
    .join(",");

  // Everything the clock touches lives in refs: it runs on an interval and
  // on observer callbacks, and re-rendering the reading screen once a
  // second to store a number would be absurd.
  const dwell = useRef(new Map<string, number>());
  const inView = useRef(new Set<string>());
  const reachedEnd = useRef(new Set<string>());
  const marked = useRef(new Set<string>());
  const lastActive = useRef(Date.now());
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || chapters.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const key = (c: { book: string; chapter: number }) =>
      `${c.book}|${c.chapter}`;

    // Chapters already ticked need no watching at all.
    const todo = chapters.filter(
      (c) => !c.alreadyRead && !wasUnticked(untickKey(dayNumber, c.book, c.chapter))
    );
    if (todo.length === 0) return;

    const byKey = new Map(todo.map((c) => [key(c), c]));

    // --------------------------------------------------------- watching

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const k = el.dataset.dwChapter;
          if (!k) continue;
          if (el.dataset.dwRole === "end") {
            // The last verse. Once seen, it stays seen — scrolling back up
            // to re-read the middle of a chapter doesn't un-finish it.
            if (entry.isIntersecting) reachedEnd.current.add(k);
          } else if (entry.isIntersecting) {
            inView.current.add(k);
          } else {
            inView.current.delete(k);
          }
        }
      },
      { threshold: 0 }
    );

    const watched: HTMLElement[] = [];
    for (const [k, c] of byKey) {
      const article = document.querySelector<HTMLElement>(
        `article[data-book="${CSS.escape(c.book)}"][data-chapter="${c.chapter}"]`
      );
      if (!article) continue;
      const verses = article.querySelectorAll<HTMLElement>(".dw-verse");
      const last = verses[verses.length - 1];
      if (!last) continue;

      // Two watchers per chapter: the whole chapter, for "is the reader
      // in here", and its last verse, for "have they reached the end".
      // The last verse sits inside the chapter, so they are told apart by
      // dwRole rather than by which element arrived.
      article.dataset.dwChapter = k;
      article.dataset.dwRole = "body";
      observer.observe(article);
      watched.push(article);

      last.dataset.dwChapter = k;
      last.dataset.dwRole = "end";
      observer.observe(last);
      watched.push(last);
    }

    // ----------------------------------------------------------- clock

    const noteActivity = () => {
      lastActive.current = Date.now();
    };
    window.addEventListener("scroll", noteActivity, { passive: true });
    window.addEventListener("touchstart", noteActivity, { passive: true });
    window.addEventListener("pointerdown", noteActivity, { passive: true });
    window.addEventListener("keydown", noteActivity);

    // Coming back to the tab is activity in itself, and the idle clock
    // shouldn't have been running while the tab was hidden anyway.
    const onVisibility = () => {
      if (document.visibilityState === "visible") noteActivity();
    };
    document.addEventListener("visibilitychange", onVisibility);

    async function mark(k: string) {
      const c = byKey.get(k);
      if (!c || marked.current.has(k)) return;
      // Claimed before the request goes out, so a slow network can't let
      // the next tick send a second one.
      marked.current.add(k);

      try {
        const res = await fetch("/api/chapter-read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            day_number: dayNumber,
            book: c.book,
            chapter: c.chapter,
            // Never a toggle. The manual boxes toggle; this can only ever
            // add, so arriving at a chapter that is already ticked leaves
            // it ticked instead of quietly clearing it.
            mode: "mark"
          })
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        // Let it try again later in the session rather than losing the
        // chapter to one bad request.
        marked.current.delete(k);
        return;
      }

      setConfirmed(`${c.book} ${c.chapter} marked read`);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmed(null), CONFIRM_MS);

      // So the day view's chapter list and the day gauge are right when
      // the reader goes back to them. Next keeps the scroll position on a
      // refresh, and the chapter HTML is unchanged, so nothing on this
      // screen moves.
      router.refresh();
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive.current > IDLE_AFTER_MS) return;

      for (const [k, c] of byKey) {
        if (marked.current.has(k)) continue;
        if (!inView.current.has(k)) continue;

        const next = (dwell.current.get(k) ?? 0) + TICK_MS;
        dwell.current.set(k, next);

        if (reachedEnd.current.has(k) && next >= requiredDwellMs(c.words)) {
          void mark(k);
        }
      }
    }, TICK_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener("scroll", noteActivity);
      window.removeEventListener("touchstart", noteActivity);
      window.removeEventListener("pointerdown", noteActivity);
      window.removeEventListener("keydown", noteActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      // These attributes are ours, written onto markup React owns, so
      // they are taken back off rather than left behind.
      for (const el of watched) {
        delete el.dataset.dwChapter;
        delete el.dataset.dwRole;
      }
    };
    // `chapters` itself is deliberately not a dependency — see
    // chapterSignature above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dayNumber, router, chapterSignature]);

  if (!confirmed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 bottom-8 z-[70] -translate-x-1/2 px-4 py-2 text-[13px] font-medium pointer-events-none"
      style={{ background: "var(--text)", color: "var(--bg)" }}
    >
      {confirmed}
    </div>
  );
}
