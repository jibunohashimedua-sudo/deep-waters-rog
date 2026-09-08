"use client";
import type { WordStudyEntry } from "@/lib/studyData";

type Props = { entries: WordStudyEntry[] | null; loading: boolean; verse: number };

/** What each source is called, in full, wherever one of its entries shows. */
const SOURCE_NAMES: Record<string, string> = {
  keil_delitzsch: "Keil and Delitzsch"
};

/**
 * Word study on the pinned passage.
 *
 * This lens replaced Vine's, which never had anything in it — no edition of
 * Vine's Expository Dictionary could be found under a licence clean enough
 * to import, and putting a different dictionary behind Vine's name would
 * have been worse than an empty tab. So the lens says what it is, and every
 * entry is labelled with the book it actually came out of.
 *
 * Keil and Delitzsch cover the Old Testament. The New Testament has no
 * source loaded yet, and says so rather than showing nothing.
 */
export default function BenchWordStudy({ entries, loading, verse }: Props) {
  if (loading) return <p className="bench-empty">Looking for a word study…</p>;

  if (!entries || entries.length === 0) {
    return (
      <p className="bench-empty">
        No word study on this verse. Keil and Delitzsch cover the Old
        Testament; nothing is loaded for the New Testament yet.
      </p>
    );
  }

  return (
    <>
      {entries.map((e) => (
        <section
          key={`${e.source}-${e.verse_start}-${e.verse_end}`}
          className="bench-commentary"
        >
          <p className="kicker kicker-strong">
            {SOURCE_NAMES[e.source] ?? e.source}
            {" · "}
            {e.verse_start === e.verse_end
              ? `Verse ${e.verse_start}`
              : `Verses ${e.verse_start}–${e.verse_end}`}
            {e.verse_start !== e.verse_end && ` · containing verse ${verse}`}
          </p>
          <p className="bench-said">{e.body}</p>
        </section>
      ))}
    </>
  );
}
