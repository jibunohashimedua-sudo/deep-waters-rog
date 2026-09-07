import Nav from "@/components/Nav";

/** Matches the reading page: heading, then scripture at its real measure. */
export default function ReadLoading() {
  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading today&rsquo;s reading</span>
        <div className="skeleton h-4 w-32" />
        <div className="mt-10 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton mt-3 h-9 w-64" />
          </div>
          <div className="skeleton h-[44px] w-28 !rounded-full" />
        </div>
        <div className="mt-16 space-y-3">
          {["100%", "96%", "99%", "90%", "100%", "94%", "86%", "98%", "92%"].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: w }} />
          ))}
        </div>
      </main>
    </>
  );
}
