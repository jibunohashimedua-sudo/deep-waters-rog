/**
 * Ninety days, read left to right as a depth profile.
 *
 * This replaced a ten-by-nine grid of squares, which is the contribution
 * graph every code-hosting site ships and therefore says nothing about
 * this app at all. A profile says the thing the grid could not: the shape
 * of a person's ninety days, where it ran deep and where it thinned out.
 *
 * Height is the share of that day's reading actually completed, which is
 * the same measure the church-pulse chart plots — so the two agree, and a
 * reader comparing their own page to the pastor's is comparing like with
 * like. For one person that share is discrete, so there are four heights
 * and no others. Discrete steps are what make it read as a sounding taken
 * at intervals rather than as a line someone drew.
 *
 * Colour is tense, and only tense:
 *   kept      violet — the past
 *   today     sonar  — now
 *   missed    nothing above the baseline
 *   ahead     nothing at all
 *
 * A missed day is a gap in the profile and gets no red, no amber, no
 * empty marker and no label. The plan is ninety days of reading, not a
 * compliance record, and a gap is simply where no sounding was taken.
 *
 * Same bar language as PulseCurve, different palette: two instruments of
 * the same make rather than the same chart twice.
 */
export default function SoundingProfile({
  days,
  today
}: {
  /** Share of the day's reading completed, 0 to 1, by day number. */
  days: Map<number, number>;
  /** The reader's current day. Days after it are still to come. */
  today: number;
}) {
  const BAR = 2;
  const GAP = 2;
  const H = 34;
  const W = 90 * (BAR + GAP) - GAP;

  // Four heights and no others: none, a third, two thirds, all of it.
  const step = (share: number) => Math.round(Math.min(1, Math.max(0, share)) * 3) / 3;

  return (
    <div className="mt-4">
      <svg
        className="sounding"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Your ninety days. Day ${today} of 90.`}
      >
        {/* The instrument's scale. Every bar sits on it. */}
        <rect className="sounding-base" x="0" y={H - 1} width={W} height="1" />
        {Array.from({ length: 90 }, (_, i) => {
          const day = i + 1;
          if (day > today) return null;
          const h = step(days.get(day) ?? 0) * (H - 1);
          // Today, before the first reading of the day, has a share of
          // zero and would vanish — taking the only mark of where "now"
          // sits with it, at exactly the hour most people open the app.
          // A 2px tick on the baseline marks the position instead. It is
          // the plumb marker's job, done here: not progress, just where
          // the kept days stop and the ones still ahead begin.
          if (h <= 0) {
            if (day !== today) return null;
            return (
              <rect
                key={day}
                className="sounding-today"
                x={i * (BAR + GAP)}
                y={H - 3}
                width={BAR}
                height="2"
              />
            );
          }
          return (
            <rect
              key={day}
              className={day === today ? "sounding-today" : "sounding-day"}
              x={i * (BAR + GAP)}
              y={H - 1 - h}
              width={BAR}
              height={h}
            />
          );
        })}
      </svg>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="meta">Day 1</p>
        <p className="meta">Day 90</p>
      </div>
    </div>
  );
}
