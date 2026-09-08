"use client";
import type { TaggedWord } from "@/lib/studyData";

type Props = {
  words: TaggedWord[];
  activeKey: string | null;
  onPick: (word: TaggedWord) => void;
};

/**
 * The tagged words of the pinned verse, in the order the KJV sets them,
 * each under its Strong's number.
 *
 * These are the real tags, not a guess made by splitting the sentence: one
 * button is one <w> element from the tagged text, so "only begotten" is one
 * word here because it is one word in the Greek. Tapping one aims Vine's
 * and the Concordance at it.
 *
 * It scrolls sideways and never wraps, so the row stays one row on a phone.
 * On a folding phone the rail is kept out of the seam by the layout, not by
 * anything here — see .bench[data-segments] in globals.css.
 */
export default function BenchWordRail({ words, activeKey, onPick }: Props) {
  if (words.length === 0) return null;
  return (
    <div className="bench-rail no-scrollbar" role="group" aria-label="Words in this verse">
      {words.map((w) => {
        const key = `${w.verse}|${w.wordIndex}`;
        return (
          <button
            key={key}
            type="button"
            className="bench-word"
            data-on={activeKey === key ? "true" : undefined}
            aria-pressed={activeKey === key}
            onClick={() => onPick(w)}
          >
            <span className="bench-word-text">{w.word}</span>
            <span className="bench-word-num">{w.strongsIds.join("·")}</span>
          </button>
        );
      })}
    </div>
  );
}
