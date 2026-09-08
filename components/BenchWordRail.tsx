"use client";
import { STRONGS_PLACEHOLDER, type BenchWord } from "@/lib/benchWords";

type Props = {
  words: BenchWord[];
  activeKey: string | null;
  onPick: (word: BenchWord) => void;
};

/**
 * The significant words in the pinned verse, in the order they are written.
 *
 * Tapping one aims Vine's and the Concordance at it. Each carries its
 * Strong's number underneath — a placeholder for now, and written as one:
 * an em dash where a number will be, rather than a number that might be
 * wrong. A wrong Strong's number is worse than a missing one, because it
 * looks right.
 *
 * It scrolls sideways and never wraps, so the row stays one row on a phone.
 * On a folding phone the rail is kept out of the seam by the layout, not by
 * anything here — see .bench[data-segments] in globals.css.
 */
export default function BenchWordRail({ words, activeKey, onPick }: Props) {
  if (words.length === 0) return null;
  return (
    <div className="bench-rail no-scrollbar" role="group" aria-label="Words in this verse">
      {words.map((w) => (
        <button
          key={w.key}
          type="button"
          className="bench-word"
          data-on={activeKey === w.key ? "true" : undefined}
          aria-pressed={activeKey === w.key}
          onClick={() => onPick(w)}
        >
          <span className="bench-word-text">{w.word}</span>
          <span className="bench-word-num">{w.strongs ?? STRONGS_PLACEHOLDER}</span>
        </button>
      ))}
    </div>
  );
}
