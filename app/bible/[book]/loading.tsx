import Nav from "@/components/Nav";

/** Reserves the heading and a block of chapter tiles at their real size. */
export default function BookLoading() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading chapters</span>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-10 h-3 w-20" />
        <div className="skeleton mt-3 h-9 w-48" />
        <div className="skeleton mt-2 h-4 w-36" />
        <div className="mt-10 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} className="skeleton h-[44px] w-full" />
          ))}
        </div>
      </main>
    </>
  );
}
