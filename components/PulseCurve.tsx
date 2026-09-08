import {
  CURVE_MIN_DAYS,
  steepestFall,
  usableCurvePoints,
  type PulseCurvePoint
} from "@/lib/pulse";

/**
 * Where people fall away.
 *
 * One line across all ninety days: of the members who have actually
 * reached a day, what share of them kept it. Days the church has not
 * reached yet are not drawn — a plan four days old has eighty-six days
 * of nothing, and a line dropping to zero across them would be a lie
 * told in ink.
 *
 * Below CURVE_MIN_DAYS of history there is no curve to draw at all, and
 * the page says so rather than showing a shape with no meaning in it.
 * That is the state a young plan sees first, so it is written to be read,
 * not to look broken.
 */
export default function PulseCurve({ points }: { points: PulseCurvePoint[] }) {
  // Days a real share of the church has reached — not days one member
  // with an old start date has reached. See usableCurvePoints.
  const usable = usableCurvePoints(points);

  if (usable.length < CURVE_MIN_DAYS) {
    const reached = usable.length;
    return (
      <div className="empty-state">
        <span className="empty-mark" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M5 30h30" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M8 24l5-3 4 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="empty-body">Not enough of the plan has happened yet.</p>
        <p className="empty-hint">
          {`The plan is ${reached} day${reached === 1 ? "" : "s"} old. The curve needs at least ${CURVE_MIN_DAYS} before a line through it means anything, so it will appear here on its own.`}
        </p>
      </div>
    );
  }

  // A 90-wide box: one unit per plan day, so day N sits at x = N - 1
  // whether or not the days after it exist yet.
  const W = 90;
  const H = 34;
  const PAD = 3;

  const x = (day: number) => ((day - 1) / 89) * W;
  const y = (p: PulseCurvePoint) => PAD + (1 - p.completed / p.eligible) * (H - PAD * 2);

  const d = usable.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day_number).toFixed(2)} ${y(p).toFixed(2)}`).join(" ");
  const fall = steepestFall(points);
  const last = usable[usable.length - 1];

  return (
    <div className="mt-4">
      <svg
        className="pulse-curve"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          fall
            ? `Completion by day, day 1 to day ${last.day_number}. The steepest fall is at day ${fall.day}.`
            : `Completion by day, day 1 to day ${last.day_number}.`
        }
      >
        <line className="pulse-curve-axis" x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} />
        {fall && (
          <line
            className="pulse-curve-mark"
            x1={x(fall.day)}
            y1="0"
            x2={x(fall.day)}
            y2={H}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path className="pulse-curve-line" d={d} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <p className="kicker">{`Day 1 — Day ${last.day_number}`}</p>
        {fall && (
          <p className="kicker kicker-strong">
            {`Steepest fall · Day ${fall.day} · ${Math.round(fall.drop * 100)} points`}
          </p>
        )}
      </div>
    </div>
  );
}
