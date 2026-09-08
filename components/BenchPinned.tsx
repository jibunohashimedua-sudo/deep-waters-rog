"use client";

type Props = {
  /** "PSALM 42:3" — mono, uppercase, the way every reference is set. */
  reference: string;
  /** The verse itself, in the reading serif. */
  text: string;
};

/**
 * The verse the Bench is working on.
 *
 * It stays where it is while the panes scroll, because everything below it
 * is about these words and a study surface that loses sight of its own text
 * is a set of tabs about nothing. The sonar rule down its left edge is the
 * same rule a selected verse wears in the chapter — this is that verse,
 * still held.
 */
export default function BenchPinned({ reference, text }: Props) {
  return (
    <div className="bench-pinned">
      <p className="kicker kicker-strong">{reference}</p>
      <p className="bench-pinned-text">{text}</p>
    </div>
  );
}
