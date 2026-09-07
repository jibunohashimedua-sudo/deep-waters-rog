"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TranslationSwitcher from "./TranslationSwitcher";

type Props = {
  /** Where the back chevron goes — the day, or the book's chapter list. */
  backHref: string;
  /** Read out to screen readers, since the chevron carries no label. */
  backLabel: string;
  /** Mono line above the title: "DAY 34 · OLD TESTAMENT", or the book group. */
  kicker: string;
  /** The reference itself — "Genesis 1–2", "Psalm 42". */
  reference: string;
  userId: string;
  translationId: string;
};

/**
 * The header on every reading screen, on /read and on /bible alike.
 *
 * You used to have to scroll back to the top of a chapter to change
 * translation, which is the wrong way round: the moment you want another
 * rendering is the moment a line stops making sense, and that is never at
 * the top. So the bar is sticky and the switcher is always in it.
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
  kicker,
  reference,
  userId,
  translationId
}: Props) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);

  // Watching a sentinel below the title rather than a scroll offset: the
  // title's height changes with the length of the reference and with the
  // viewport, so any fixed threshold would be right on one screen and
  // wrong on the next. This asks the layout instead of guessing at it.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      // The bar is 52px tall, so the sentinel counts as gone the moment it
      // slides under it rather than when it leaves the viewport entirely.
      { rootMargin: "-52px 0px 0px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <header
        className="reading-bar"
        data-condensed={condensed ? "true" : undefined}
        aria-label="Reading"
      >
        <Link href={backHref} className="reading-back" aria-label={backLabel}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>

        {/* Hidden from assistive tech: it is the same reference as the
            heading below, and announcing it twice is noise. */}
        <span className="reading-ref" aria-hidden>
          {reference}
        </span>

        <TranslationSwitcher userId={userId} currentId={translationId} />
      </header>

      <div className="pt-8">
        <p className="kicker">{kicker}</p>
        <h1 className="reading-title mt-3">{reference}</h1>
      </div>

      {/* Zero-height tell-tale. When this passes under the bar, the bar
          takes the reference over. */}
      <div ref={sentinel} aria-hidden className="h-px" />
    </>
  );
}
