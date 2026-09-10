"use client";
import type { ExpositionEntry } from "@/lib/studyData";

type Props = { entries: ExpositionEntry[] | null; loading: boolean; verse: number };

/** What each source is called, in full, wherever one of its entries shows. */
const SOURCE_NAMES: Record<string, string> = {
  keil_delitzsch: "Keil and Delitzsch",
  robertson: "Robertson, Word Pictures"
};

/**
 * The exposition of the pinned passage.
 *
 * Named for what it holds, like every lens beside it. It was briefly
 * called Word study, which collided with the Word study *mode* in the row
 * above it — one screen, one name, two different kinds of control. The
 * mode kept the name; the lens took the one that describes its contents.
 *
 * Before that it was Vine's, which never had anything in it: no edition of
 * the Expository Dictionary could be found under a licence clean enough to
 * import, and putting a different dictionary behind Vine's name would have
 * been worse than an empty tab. Every entry here is labelled with the book
 * it actually came out of.
 *
 * Keil and Delitzsch cover the Old Testament, Robertson the New. Neither
 * writes on every verse, so the empty state says that plainly rather than
 * leaving a reader to wonder whether something failed to load.
 */
export default function BenchExposition({ entries, loading, verse }: Props) {
  if (loading) return <p className="bench-empty">Looking for an exposition…</p>;

  if (!entries || entries.length === 0) {
    return (
      <>
        <p className="bench-empty">No exposition on this verse.</p>
        <p className="bench-empty">
          Keil and Delitzsch cover the Old Testament and Robertson the New,
          but neither writes on every verse.
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
          <p className="meta meta-strong">
            {SOURCE_NAMES[e.source] ?? e.source}
            {" "}
            {e.verse_start === e.verse_end
              ? `Verse ${e.verse_start}`
              : `Verses ${e.verse_start}–${e.verse_end}`}
            {e.verse_start !== e.verse_end && `, containing verse ${verse}`}
          </p>
          <p className="bench-said">{e.body}</p>
        </section>
      ))}
    </>
  );
}
