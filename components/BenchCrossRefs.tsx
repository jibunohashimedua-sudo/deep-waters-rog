"use client";
import type { CrossRef } from "@/lib/studyData";

type Props = {
  refs: CrossRef[] | null;
  loading: boolean;
  /** Tapping a reference opens it in the second window. */
  onOpen: (ref: CrossRef) => void;
};

/**
 * Where else this passage is answered.
 *
 * Ordered by the dataset's own votes, so the references a reader would
 * actually turn to come first, and each one carries its verse rather than
 * making you look it up to find out whether it was worth the trip.
 *
 * Tapping one loads it into the second window. That is what turns this
 * from a list into somewhere to go: the passage opens beside the verse
 * being studied, and the verse being studied does not move.
 */
export default function BenchCrossRefs({ refs, loading, onOpen }: Props) {
  if (loading) return <p className="bench-empty">Looking up the references…</p>;
  if (!refs || refs.length === 0) {
    return <p className="bench-empty">No cross references for this verse.</p>;
  }
  return (
    <ul className="bench-rows">
      {refs.map((r) => (
        <li key={r.target_ref} className="bench-row">
          {/* The whole row is the control. A cross reference is somewhere
              to go and sit, not a line to read and lose — this opens it in
              the second window and leaves the pinned verse where it is. */}
          <button
            type="button"
            className="bench-crossref"
            onClick={() => onOpen(r)}
            aria-label={`Open ${r.target_ref} in the second window`}
          >
            <span className="meta meta-strong">{r.target_ref.toUpperCase()}</span>
            {r.text
              ? <span className="bench-scripture">{r.text}</span>
              : <span className="bench-empty">Text not carried for this reference.</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
