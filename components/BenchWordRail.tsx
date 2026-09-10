"use client";
import { useEffect, useRef } from "react";
import type { TaggedWord } from "@/lib/studyData";
import { scrollRailTo } from "@/lib/scrollPane";

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
  const railRef = useRef<HTMLDivElement>(null);

  // The fade at the right edge promises more chips off-screen, so it has
  // to go once there are none. Watched rather than assumed: the rail is
  // scrolled by finger, by the keyboard moving focus through the chips,
  // and by the code that keeps the chosen one in view.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      if (atEnd) rail.dataset.atEnd = "true";
      else delete rail.dataset.atEnd;
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    return () => {
      rail.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [words]);

  // The chosen chip stays where it can be seen. Chosen from the Words lens
  // rather than the rail, it may be off the right-hand edge; this brings it
  // just inside, scrolling the strip alone.
  useEffect(() => {
    if (!activeKey) return;
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>(`[data-chip-key="${CSS.escape(activeKey)}"]`);
    scrollRailTo(rail ?? null, chip ?? null);
  }, [activeKey]);

  if (words.length === 0) return null;
  return (
    <div
      className="bench-rail no-scrollbar"
      role="group"
      aria-label="Words in this verse"
      ref={railRef}
    >
      {words.map((w) => {
        const key = `${w.verse}|${w.wordIndex}`;
        return (
          <button
            key={key}
            type="button"
            className="bench-word"
            data-chip-key={key}
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
