import Nav from "@/components/Nav";

/**
 * A chapter takes a network round trip to API.Bible the first time anyone
 * opens it, so this stands in at the reading measure and rhythm — lines of
 * roughly verse length, not a grey slab.
 */
export default function ChapterLoading() {
  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading the chapter</span>
        <div className="skeleton h-4 w-28" />
        <div className="mt-10 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-9 w-52" />
          </div>
          <div className="skeleton h-[44px] w-28 !rounded-full" />
        </div>
        <div className="mt-16 space-y-3">
          {["100%", "97%", "92%", "99%", "88%", "100%", "95%", "83%"].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: w }} />
          ))}
        </div>
      </main>
    </>
  );
}
