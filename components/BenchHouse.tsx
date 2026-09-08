"use client";

export type HouseRow = {
  id: string;
  /** The plan day the writer was on when they wrote it. */
  day: number;
  /** What they typed as the reference — kept as they wrote it. */
  reference: string | null;
  reflection: string;
  amens: number;
};

type Props = {
  rows: HouseRow[] | null;
  /** The plan day this passage falls on, when the plan passes through it. */
  planDay: number | null;
  loading: boolean;
};

/**
 * What this church wrote about this passage.
 *
 * Every row here was already shared to the community feed — the query reads
 * the community_feed view, which is the feed itself, so a reflection left
 * blank to keep it private cannot appear and neither can any verse note.
 * That filter is in the query and not in this component on purpose: a
 * privacy rule that lives in a renderer is one refactor away from being
 * gone.
 *
 * No names, no portraits, no links to anybody. The text and the amens, and
 * the day the house was on when they wrote it.
 */
export default function BenchHouse({ rows, planDay, loading }: Props) {
  if (loading) {
    return <p className="bench-empty">Reading the house…</p>;
  }

  if (!rows || rows.length === 0) {
    return (
      <>
        <p className="bench-empty">The house has not written on this verse.</p>
        {planDay !== null && (
          <p className="bench-empty">
            The plan reads this passage on day {planDay}.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {planDay !== null && (
        <p className="kicker">The house reads this on day {planDay}</p>
      )}
      <ul className="bench-rows">
        {rows.map((r) => (
          <li key={r.id} className="bench-row">
            <p className="kicker">
              {`Day ${r.day}`}
              {r.reference ? ` · ${r.reference}` : ""}
              {r.amens > 0 ? ` · ${r.amens} amen${r.amens === 1 ? "" : "s"}` : ""}
            </p>
            <p className="bench-said">{r.reflection}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
