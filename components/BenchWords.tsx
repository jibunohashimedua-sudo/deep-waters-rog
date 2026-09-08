"use client";
import type { StrongsEntry, TaggedWord } from "@/lib/studyData";

type Props = {
  words: TaggedWord[] | null;
  entries: Map<string, StrongsEntry>;
  activeKey: string | null;
  loading: boolean;
  /** Tapping an entry here aims the other word lenses at it, exactly as
      tapping the same word on the rail does. */
  onPick: (word: TaggedWord) => void;
};

/**
 * Every tagged word in the pinned verse, with the lexicon behind it.
 *
 * The words are the KJV's, because the tagging is: a Strong's number is
 * attached to the King James rendering, whatever edition the reader has
 * open. The source line at the foot of the lens says so.
 */
export default function BenchWords({ words, entries, activeKey, loading, onPick }: Props) {
  if (loading) return <p className="bench-empty">Reading the tagging…</p>;
  if (!words || words.length === 0) {
    return (
      <p className="bench-empty">
        No tagged words for this verse. The tagging follows the KJV, so a
        verse it numbers differently can fall outside it.
      </p>
    );
  }

  return (
    <ul className="bench-rows">
      {words.map((w) => {
        const key = `${w.verse}|${w.wordIndex}`;
        return (
          <li
            key={key}
            className="bench-row"
            data-word-key={key}
            data-on={activeKey === key ? "true" : undefined}
          >
            <button
              type="button"
              className="bench-word-head"
              onClick={() => onPick(w)}
              aria-pressed={activeKey === key}
            >
              <span className="kicker kicker-strong">
                {w.word.toUpperCase()} &middot; {w.strongsIds.join(" · ")}
              </span>
            </button>
            {w.strongsIds.map((id) => {
              const e = entries.get(id);
              if (!e) {
                return (
                  <p key={id} className="bench-empty">
                    {id} — no lexicon entry.
                  </p>
                );
              }
              return (
                <div key={id} className="bench-word-entry">
                  <p className="bench-lemma">
                    {e.lemma}
                    {e.transliteration ? ` · ${e.transliteration}` : ""}
                  </p>
                  <p className="bench-said">{e.definition}</p>
                </div>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
