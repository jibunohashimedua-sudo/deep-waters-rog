"use client";
import type { CrossRef } from "@/lib/studyData";

type Props = { refs: CrossRef[] | null; loading: boolean };

/**
 * Where else this passage is answered.
 *
 * Ordered by the dataset's own votes, so the references a reader would
 * actually turn to come first, and each one carries its verse rather than
 * making you look it up to find out whether it was worth the trip.
 */
export default function BenchCrossRefs({ refs, loading }: Props) {
  if (loading) return <p className="bench-empty">Looking up the references…</p>;
  if (!refs || refs.length === 0) {
    return <p className="bench-empty">No cross references for this verse.</p>;
  }
  return (
    <ul className="bench-rows">
      {refs.map((r) => (
        <li key={r.target_ref} className="bench-row">
          <p className="meta meta-strong">{r.target_ref.toUpperCase()}</p>
          {r.text
            ? <p className="bench-scripture">{r.text}</p>
            : <p className="bench-empty">Text not carried for this reference.</p>}
        </li>
      ))}
    </ul>
  );
}
