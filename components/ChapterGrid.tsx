"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import ReferencePicker, { type PickerStep } from "./ReferencePicker";

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

/**
 * The chapter grid, with a visible way to a verse beside it.
 *
 * A tap opens the chapter at the top, which is what most people want most of
 * the time. "Jump to a verse" opens the picker at this book's chapters and
 * then its verses, so somebody who has just heard "Psalm twenty-three, verse
 * four" gets there without arriving at the top of the psalm and scrolling.
 *
 * The press-and-hold shortcut survives for anyone who learnt it, but it is no
 * longer the only door: a gesture is a shortcut, never an interface.
 */
export default function ChapterGrid({ bookSlug, bookName, chapters, read }: Props) {
  const [picker, setPicker] = useState<{
    open: boolean;
    step: PickerStep;
    chapter: number | null;
  }>({ open: false, step: "chapter", chapter: null });

  const readSet = new Set(read);

  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  // Set when a long press fires, so the click that the browser sends
  // afterwards doesn't also navigate to the chapter.
  const swallowClick = useRef(false);

  function openVerses(chapter: number) {
    setPicker({ open: true, step: "verse", chapter });
  }

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
      openVerses(chapter);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setPicker({ open: true, step: "chapter", chapter: null })}
        className="chip mt-8 gap-2"
      >
        <span aria-hidden>&#8595;</span>
        Jump to a verse
      </button>

      <ul className="mt-4 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
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
                  openVerses(c);
                }}
              >
                {c}
              </Link>
            </li>
          );
        })}
      </ul>

      <ReferencePicker
        open={picker.open}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        bookSlug={bookSlug}
        chapter={picker.chapter}
        startStep={picker.step}
      />
    </>
  );
}
