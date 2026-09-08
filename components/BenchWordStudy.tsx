"use client";
import type { WordStudyEntry } from "@/lib/studyData";

type Props = { entries: WordStudyEntry[] | null; loading: boolean; verse: number };

/** What each source is called, in full, wherever one of its entries shows. */
const SOURCE_NAMES: Record<string, string> = {
  keil_delitzsch: "Keil and Delitzsch",
  robertson: "Robertson, Word Pictures"
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
 * Keil and Delitzsch cover the Old Testament. Robertson covers the New,
 * except for the two volumes of his that are still in copyright — John and
 * Hebrews, and the General Epistles with Revelation. Where neither has an
 * entry the lens says which books are missing and why, rather than leaving
 * a reader to wonder whether the verse simply has nothing in it.
 */
export default function BenchWordStudy({ entries, loading, verse }: Props) {
  if (loading) return <p className="bench-empty">Looking for a word study…</p>;

  if (!entries || entries.length === 0) {
    return (
      <>
        <p className="bench-empty">No word study on this verse.</p>
        <p className="bench-empty">
          Keil and Delitzsch cover the Old Testament, and Robertson the New
          — except John, Hebrews, the General Epistles and Revelation,
          whose volumes are still in copyright and are not loaded.
        </p>
      </>
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
