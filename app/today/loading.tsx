import Nav from "@/components/Nav";

/**
 * Shown while the server is fetching the day's data.
 *
 * The blocks are sized from the real page rather than guessed at, and the
 * reading rows borrow .read-list and .read-row themselves — so their grid,
 * padding and rules are identical by construction instead of by a number
 * copied across that goes stale the next time the row is touched.
 *
 * Measured against /today: the greeting is 31px over 20px, the gauge is
 * 15px under a 14px meta row, and each reading row is 70px — 15px of
 * padding either side of a 21px reference over a 14px label.
 *
 * Two things genuinely can't be reserved, because nothing knows them until
 * the data lands:
 *
 *   · the "Kept" chip, which only exists once today's reflection is saved
 *     and adds 39px to the gauge block when it does
 *   · the third reading row, which is the Rhapsody article and is absent on
 *     any day without one
 *
 * Three rows are reserved because that is the ordinary day. A day without an
 * article settles up by one row, which is a smaller and rarer movement than
 * making every ordinary day push down by one.
 */
export default function TodayLoading() {
  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading today</span>

        {/* Greeting */}
        <div className="mb-10">
          <div className="skeleton h-[31px] w-56" />
          <div className="skeleton mt-2 h-5 w-40" />
        </div>

        {/* Day counter and the gauge — a scale with ticks, not a capsule,
            so the placeholder is a rule of the same 15px height. */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between gap-3">
            <div className="skeleton h-[14px] w-16" />
            <div className="skeleton h-[14px] w-28" />
          </div>
          <div className="skeleton mt-2 h-[15px] w-full" />
        </div>

        {/* The three readings, as list rows rather than cards. */}
        <div className="read-list">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="read-row">
              <div className="skeleton h-[14px] w-7" />
              <div>
                <div className="skeleton h-[21px] w-40" />
                <div className="skeleton mt-1 h-[14px] w-28" />
              </div>
              <div className="skeleton h-[14px] w-4" />
            </div>
          ))}
        </div>

        {/* Reflection. The only block here that can't be sized honestly: the
            form is 733px once a reflection is kept and much shorter before,
            so this reserves a plausible middle rather than pretending. */}
        <div className="mt-16">
          <div className="skeleton h-[200px] w-full" />
        </div>
      </main>
    </>
  );
}
