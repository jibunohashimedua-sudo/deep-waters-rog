"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TranslationSwitcher from "./TranslationSwitcher";
import ReferencePicker from "./ReferencePicker";
import BackControl from "./BackControl";

type Props = {
  /** Where the back chevron goes — the day, or the book's chapter list. */
  backHref: string;
  /** Read out to screen readers, since the chevron carries no label. */
  backLabel: string;
  /** Mono line *under* the title — how much there is to read, and nothing
      else. It sat above as "DAY 34 · OLD TESTAMENT", which put a label and a
      number the reader already had in front of the only thing they came for. */
  meta?: string;
  /** The reference itself — "Genesis 1–2", "Psalm 42". */
  reference: string;
  userId: string;
  translationId: string;
  /** Where the picker should open, when this screen is one chapter of one
      book. The daily reading spans several, so it opens at the book step. */
  bookSlug?: string | null;
  chapter?: number | null;
};

/**
 * The header on every reading screen, on /read and on /bible alike.
 *
 * It carries the whole job of a reading screen's chrome: the way out, where
 * you are, and which translation you're in. The last two are controls, not
 * captions — the reference opens the book/chapter/verse picker, and the code
 * on the right opens the translation list. Both are reachable at any point in
 * a chapter, because the bar is sticky, and the moment you want either of
 * them is never the moment you happen to be at the top of the page.
 *
 * It condenses rather than shrinking. The bar itself is one fixed row —
 * chevron, reference, translation — and the large reference lives in the
 * page below, scrolling away like the scripture does. As it goes, its mono
 * twin fades up into the bar. Nothing animates but opacity and a 6px
 * translate, so a scroll on an old phone stays on the compositor, and the
 * bar never changes height, which means the words underneath it never jump.
 *
 * Opaque, with one hairline beneath. No blur — see globals.css.
 */
export default function ReadingHeader({
  backHref,
  backLabel,
  meta,
  reference,
  userId,
  translationId,
  bookSlug = null,
  chapter = null
}: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [condensed, setCondensed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Watching a sentinel below the title rather than a scroll offset: the
  // title's height changes with the length of the reference and with the
  // viewport, so any fixed threshold would be right on one screen and
  // wrong on the next. This asks the layout instead of guessing at it.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // The sentinel counts as gone the moment it slides under the bar
    // rather than when it leaves the viewport entirely. The bar is
    // measured rather than assumed to be 52px, because on a phone with a
    // notch it is 52px plus the status bar inset, and a number typed here
    // would be wrong on exactly the devices this app is read on.
    const barHeight = Math.round(bar.current?.getBoundingClientRect().height ?? 52);
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <header
        ref={bar}
        className="reading-bar safe-top-bar"
        data-condensed={condensed ? "true" : undefined}
        aria-label="Reading"
      >
        <BackControl variant="bare" fallbackHref={backHref} label={backLabel} />

        {/* The condensed reference, which is also the picker once it has
            faded up. It is invisible and unpressable until then — see
            .reading-ref in globals.css — because the full-size one below
            is still on screen and doing the same job. */}
        <button
          type="button"
          className="reading-ref"
          onClick={() => setPickerOpen(true)}
          tabIndex={condensed ? 0 : -1}
          aria-hidden={!condensed}
          aria-label={`${reference}. Go to another passage.`}
        >
          {reference} &#9662;
        </button>

        <TranslationSwitcher userId={userId} currentId={translationId} />
      </header>

      <div className="pt-8">
        <h1>
          {/* The title is the book-and-chapter control. Somebody looking at
              "Psalm 42" and wanting Psalm 43 should be able to say so by
              pressing the words in front of them. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="reading-title reading-title-btn"
            aria-haspopup="dialog"
          >
            {reference}
            <span className="reading-caret" aria-hidden>
              &#9662;
            </span>
          </button>
        </h1>
        {meta && <p className="meta mt-2">{meta}</p>}
      </div>

      {/* Zero-height tell-tale. When this passes under the bar, the bar
          takes the reference over. */}
      <div ref={sentinel} aria-hidden className="h-px" />

      <ReferencePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        bookSlug={bookSlug}
        chapter={chapter}
        startStep="book"
      />
    </>
  );
}
