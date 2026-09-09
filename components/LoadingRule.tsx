/**
 * The only loading state in the app.
 *
 * A 1px sonar rule draws left to right across the top of the region that
 * is waiting, and then it is gone. No spinner, no shimmer, no stack of
 * pulsing grey blocks pretending to be the content that hasn't arrived —
 * a skeleton is a guess about a layout, and when the guess is wrong the
 * page jumps twice instead of once.
 *
 * The animation is delayed 200ms in CSS, so anything that resolves faster
 * than that shows nothing at all. Most things do.
 */
export default function LoadingRule({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="loading-rule" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
