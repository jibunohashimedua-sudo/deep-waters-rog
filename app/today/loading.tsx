import Nav from "@/components/Nav";

/**
 * Shown while the server is fetching the day's data. Every block is the size
 * of the real thing it stands in for, so nothing moves when the content
 * lands — the greeting, the progress rule, the two reading tiles.
 */
export default function TodayLoading() {
  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading today</span>
        <div className="skeleton h-7 w-56" />
        <div className="skeleton mt-3 h-4 w-40" />

        <div className="mt-10 mb-10">
          <div className="flex items-center justify-between">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton mt-2 h-2 w-full !rounded-full" />
        </div>

        <div className="skeleton h-3 w-32" />
        <div className="skeleton mt-3 h-9 w-28" />

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <div className="skeleton h-[132px] w-full !rounded-3xl" />
          <div className="skeleton h-[132px] w-full !rounded-3xl" />
        </div>

        <div className="skeleton mt-16 h-40 w-full !rounded-3xl" />
      </main>
    </>
  );
}
