/**
 * The app's icon vocabulary.
 *
 * Drawn, never set in emoji. An emoji is whatever the reader's phone decides
 * it is — a different drawing on an iPhone, an Android and a Mac, at a weight
 * this system doesn't set and in colours it doesn't own — so a column of them
 * matches nothing else on the screen.
 *
 * One hand throughout: a 24 box, no fill, round caps and joins, and no detail
 * that dies at 19px. The weight is a prop because the same mark has to hold at
 * 19px in a list and at 88px as the hero of an onboarding slide, and a stroke
 * that reads as confident small reads as fat large.
 *
 * Several of these were already drawn elsewhere and are gathered here so the
 * app says the same thing with the same mark: `comment` and `amen` are the
 * ones under every reflection, `bible` and `depth` are two of the tab bar's.
 *
 * Still duplicated, deliberately, for now: components/BottomNav.tsx and
 * components/ReflectionCard.tsx keep their own inline copies. Folding those in
 * touches files a second session is working near; worth doing once it lands.
 */

export const ICONS = {
  // ---- the tab bar's own marks, reused where the app describes itself ----
  bible: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H5.5A1.5 1.5 0 0 0 4 20V4.5Z" />
      <path d="M11.5 7.5v6M9 10h5" />
    </>
  ),
  /** Four bars descending — the sounding line, and the mark for progress. */
  depth: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,

  // ---- the marks under every reflection ----
  amen: (
    <path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9Z" />
  ),
  comment: (
    <path d="M20.5 12.2c0 3.8-3.8 6.9-8.5 6.9a10 10 0 0 1-2.7-.4L4 20.5l1.6-3.7a6.4 6.4 0 0 1-2.1-4.6c0-3.8 3.8-6.9 8.5-6.9s8.5 3.1 8.5 6.9Z" />
  ),

  // ---- the More sheet ----
  edit: <path d="M4 20h4L18 10l-4-4L4 16v4ZM14 6l4 4" />,
  /** A ping and two returns — the sounding this app is named for, turned
      on the church itself. Church pulse listens for who is out there; it
      is not a heartbeat and deliberately not a medical mark. */
  pulse: (
    <>
      <circle cx="12" cy="17" r="1.3" />
      <path d="M8.4 13.6a5 5 0 0 1 7.2 0" />
      <path d="M5.2 10.4a9.5 9.5 0 0 1 13.6 0" />
    </>
  ),
  /** A manuscript: a page with a folded corner and two lines written on
      it. Elite's Sermons row, and nothing else in the app uses it. */
  sermon: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4M9.5 12h5M9.5 16h3.5" />
    </>
  ),
  /** The prayer wall is a wall. Brickwork is the same geometry as the gauge. */
  prayer: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" />
    </>
  ),
  cohorts: (
    <>
      <circle cx="6.5" cy="9" r="2" />
      <circle cx="17.5" cy="9" r="2" />
      <circle cx="12" cy="7.5" r="2.2" />
      <path d="M3 17.5c0-2 1.6-3.4 3.5-3.4M21 17.5c0-2-1.6-3.4-3.5-3.4M8 19.5c0-2.2 1.8-3.9 4-3.9s4 1.7 4 3.9" />
    </>
  ),
  finishers: <path d="M5 21V4M5 5h11l-2 3.6L16 12.2H5" />,
  /** A square bubble with lines in it — testimony, and a comment notice. */
  testimony: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12.3h5" />
    </>
  ),
  /** A horn, not a bell. The bell already means notifications. */
  announcements: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M18 9.6a4 4 0 0 1 0 4.8" />
    </>
  ),
  admin: (
    <>
      <path d="M4 9h7M15.2 9H20M4 15h3M11.2 15H20" />
      <circle cx="13" cy="9" r="2.2" />
      <circle cx="9" cy="15" r="2.2" />
    </>
  ),
  signout: <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8M19 12H9M15.5 8.5 19 12l-3.5 3.5" />,

  // ---- notifications ----
  /** A milestone kept: a disc on a ribbon. */
  badge: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.4 7 21l5-2.6L17 21l-1.5-7.6" />
    </>
  ),
  reminder: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 2" />
    </>
  ),

  // ---- theme ----
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5M12 19v2.5M4.6 4.6 6.4 6.4M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4 6.4 17.6M17.6 6.4l1.8-1.8" />
    </>
  ),
  dark: <path d="M20 14.7A8.5 8.5 0 0 1 9.3 4a8.5 8.5 0 1 0 10.7 10.7Z" />,
  /** Following the system: one circle, half of it filled. */
  system: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
} as const;

export type IconName = keyof typeof ICONS;

export default function Icon({
  name,
  className = "w-[19px] h-[19px] shrink-0",
  strokeWidth = 1.8
}: {
  name: IconName;
  className?: string;
  /** Lighter for large sizes: 1.8 reads as confident at 19px and fat at 88px. */
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}
