/**
 * The app's five icons. There are no others.
 *
 * Every one is built from the same bar: a 16 box, a 1.25 stroke, butt caps,
 * mitre joins, and not one curve anywhere. That is the whole vocabulary —
 * the four tabs and More — and it is deliberately too small a set to
 * describe anything else, because in this app a thing that needs naming
 * gets a word rather than a drawing.
 *
 * The set this replaced had round caps, round joins and circles in it, which
 * quietly argued with the rest of the system: in Fathom the only curve is a
 * pill, and a pill means "press me". An icon is not a touch target — the
 * tab around it is — so an icon has no business being round.
 *
 * DEPTH is the mark itself: four bars descending 12, 9, 6, 3, the sounding
 * line the app is named for. It is the one icon that was already right.
 */

export type IconName = "today" | "bible" | "people" | "depth" | "more";

const PATHS: Record<IconName, JSX.Element> = {
  /** A list, with today filled. */
  today: (
    <>
      <rect x="2" y="1.5" width="12" height="3" fill="currentColor" stroke="none" />
      <rect x="2.625" y="7.125" width="10.75" height="1.75" />
      <rect x="2.625" y="12.125" width="10.75" height="1.75" />
    </>
  ),
  /** A book: square, with a spine. */
  bible: (
    <>
      <rect x="2.625" y="2.625" width="10.75" height="10.75" />
      <line x1="6" y1="2.625" x2="6" y2="13.375" />
    </>
  ),
  /** Two square portraits. */
  people: (
    <>
      <rect x="2.625" y="5.125" width="4.75" height="4.75" />
      <rect x="8.875" y="7.125" width="4.75" height="4.75" />
    </>
  ),
  /** The mark. */
  depth: (
    <>
      <line x1="2" y1="3.5" x2="14" y2="3.5" />
      <line x1="2" y1="7" x2="11" y2="7" />
      <line x1="2" y1="10.5" x2="8" y2="10.5" />
      <line x1="2" y1="14" x2="5" y2="14" />
    </>
  ),
  /** Three squares. */
  more: (
    <>
      <rect x="2.5" y="6.75" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="6.75" y="6.75" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="11" y="6.75" width="2.5" height="2.5" fill="currentColor" stroke="none" />
    </>
  )
};

export default function Icon({
  name,
  className
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={16}
      height={16}
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      fill="none"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
