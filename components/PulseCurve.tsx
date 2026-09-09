import {
  CURVE_MIN_DAYS,
  steepestFall,
  usableCurvePoints,
  type PulseCurvePoint
} from "@/lib/pulse";

/**
 * Where people fall away. Ninety bars, one per plan day.
 *
 * Of the members who have actually reached a day, what share of them kept
 * it. Days the church has not reached yet are drawn as a stub in the rule
 * colour rather than left out: ninety slots are always ninety slots, and a
 * plan four days old should look four days old rather than look broken.
 *
 * This was a line chart until the icons came down to five and the round cap
 * on its stroke turned out to be the last curve in the app. The cap was not
 * the problem. A ninety-point line with round caps and a smooth join is the
 * single most recognisable default a charting library has, and squaring the
 * cap would have left the same chart wearing different shoes. Bars have no
 * caps and no joins to argue about, so the exception disappears rather than
 * needing a paragraph defending it.
 *
 * No gridlines, no legend, no tooltip. One mono label at each end, which is
 * the whole axis a reader of this page needs.
 */
export default function PulseCurve({ points }: { points: PulseCurvePoint[] }) {
  const usable = usableCurvePoints(points);

  if (usable.length < CURVE_MIN_DAYS) {
    const reached = usable.length;
    return (
      <div className="empty-state">
        <p className="empty-body">Not enough of the plan has happened yet.</p>
        <p className="empty-hint">
          {`The plan is ${reached} day${reached === 1 ? "" : "s"} old. It needs at least ${CURVE_MIN_DAYS} before the shape of it means anything, so it will appear here on its own.`}
        </p>
      </div>
    );
  }

  // 2 wide, 2 apart: day N starts at (N-1) * 4. Ninety of them come to 358.
  const BAR = 2;
  const GAP = 2;
  const H = 34;
  const W = 90 * (BAR + GAP) - GAP;

  const kept = new Map(usable.map((p) => [p.day_number, p.completed / p.eligible]));
  const fall = steepestFall(points);
  const last = usable[usable.length - 1];

  return (
    <div className="mt-4">
      <svg
        className="pulse-days"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          fall
            ? `Share of members who kept each day, day 1 to day ${last.day_number}. The steepest fall is at day ${fall.day}.`
            : `Share of members who kept each day, day 1 to day ${last.day_number}.`
        }
      >
        {Array.from({ length: 90 }, (_, i) => {
          const day = i + 1;
          const share = kept.get(day);
          // A day nobody has reached keeps its slot at the baseline.
          const h = share === undefined ? 1 : Math.max(1, share * H);
          const care = fall?.day === day;
          return (
            <rect
              key={day}
              x={i * (BAR + GAP)}
              y={H - h}
              width={BAR}
              height={h}
              className={
                share === undefined
                  ? "pulse-day-empty"
                  : care
                    ? "pulse-day-care"
                    : "pulse-day"
              }
            />
          );
        })}
      </svg>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="kicker">Day 1</p>
        <p className="kicker">{`Day ${last.day_number}`}</p>
      </div>

      {/* The one fact worth a sentence, said as a sentence. It was
          "Steepest fall · Day 34 · 12 points", which gave three facts the
          same weight and left the reader to work out which was the point. */}
      {fall && (
        <p className="mt-2 text-[13.5px] leading-[1.5] text-rog-muted">
          The steepest fall is at day {fall.day}, down{" "}
          {Math.round(fall.drop * 100)} points.
        </p>
      )}
    </div>
  );
}
