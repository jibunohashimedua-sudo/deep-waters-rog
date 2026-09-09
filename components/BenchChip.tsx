"use client";

/**
 * The seventh chip on the verse toolbar — the one that opens the Bench.
 *
 * It is its own module for the same reason MoreSheetPastoralRows is:
 * VerseToolbar is a static import in ScriptureReader, so anything written
 * inside it ships to every reader on /read and /bible/*. The label and the
 * data-elite marker were literals there, which meant a member's own bundle
 * carried both the feature's name and the name of the tier it belongs to.
 * ELITE_EXCELLENCE_AUDIT P2-I.
 *
 * Behind next/dynamic and mounted only when the flag is on, both strings
 * travel in a chunk a member never requests.
 *
 * It sits after Compare because comparing and opening the Bench are the
 * same motion — you are still with the verse — and it carries the Fathom
 * violet on its border and its label so it reads as another kind of thing
 * without shouting.
 */
export default function BenchChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="verse-action"
      data-elite="true"
      onClick={onClick}
    >
      Bench
    </button>
  );
}
