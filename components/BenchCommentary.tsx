"use client";
import type { CommentaryEntry } from "@/lib/studyData";

type Props = { entries: CommentaryEntry[] | null; loading: boolean; verse: number };

/**
 * Matthew Henry on this passage.
 *
 * Henry wrote on passages rather than verses, so the heading says which
 * span this is — showing his words on verses 1–21 under a heading that
 * claimed verse 16 would be a small lie about a large paragraph.
 */
export default function BenchCommentary({ entries, loading, verse }: Props) {
  if (loading) return <p className="bench-empty">Fetching the commentary…</p>;
  if (!entries || entries.length === 0) {
    return <p className="bench-empty">No commentary on this passage.</p>;
  }
  return (
    <>
      {entries.map((e) => (
        <section key={`${e.verse_start}-${e.verse_end}`} className="bench-commentary">
          <p className="meta meta-strong">
            {e.verse_start === 0
              ? "On the chapter"
              : e.verse_start === e.verse_end
                ? `Verse ${e.verse_start}`
                : `Verses ${e.verse_start}–${e.verse_end}`}
            {e.verse_start !== 0 && `, containing verse ${verse}`}
          </p>
          <p className="bench-said">{e.body}</p>
        </section>
      ))}
    </>
  );
}
