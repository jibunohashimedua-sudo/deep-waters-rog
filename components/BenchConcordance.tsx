"use client";
import type { ConcordanceHit } from "@/lib/studyData";

type Props = {
  strongsId: string | null;
  word: string | null;
  total: number;
  hits: ConcordanceHit[];
  loading: boolean;
  canShowMore: boolean;
  onShowMore: () => void;
};

/**
 * Everywhere else this word is used, by its Strong's number.
 *
 * Some numbers run to thousands of verses, so the count is stated and the
 * verses come a page at a time — never the whole set. The word itself is
 * marked in each verse, using the exact English the KJV tags with that
 * number, so the eye lands on it without reading the line twice.
 */
export default function BenchConcordance({
  strongsId, word, total, hits, loading, canShowMore, onShowMore
}: Props) {
  if (!strongsId) {
    return <p className="bench-empty">Choose a word from the rail above.</p>;
  }
  if (loading && hits.length === 0) {
    return <p className="bench-empty">Counting {strongsId}…</p>;
  }
  if (total === 0) {
    return (
      <p className="bench-empty">
        {strongsId} appears only here.
      </p>
    );
  }

  return (
    <>
      <p className="meta">
        {`${total} ${total === 1 ? "verse" : "verses"}`}
      </p>
      <ul className="bench-rows">
        {hits.map((h) => (
          <li key={`${h.book}|${h.chapter}|${h.verse}`} className="bench-row">
            <p className="meta meta-strong">
              {`${h.book} ${h.chapter}:${h.verse}`.toUpperCase()}
            </p>
            <p className="bench-scripture">{mark(h.text, h.word)}</p>
          </li>
        ))}
      </ul>
      {canShowMore && (
        <button type="button" className="bench-more" onClick={onShowMore}>
          {loading ? "Loading…" : "Show more verses"}
        </button>
      )}
    </>
  );
}

/** The tagged phrase, marked where it stands in the verse. */
function mark(text: string, word: string) {
  if (!text) return null;
  if (!word) return text;
  const at = text.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <em className="bench-hit">{text.slice(at, at + word.length)}</em>
      {text.slice(at + word.length)}
    </>
  );
}
