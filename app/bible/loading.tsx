import Nav from "@/components/Nav";

/** Reserves the search box and the first band of book cards. */
export default function BibleLoading() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10" aria-busy="true">
        <span className="sr-only">Loading the Bible</span>
        <div className="skeleton h-3 w-28" />
        <div className="skeleton mt-3 h-9 w-44" />
        <div className="skeleton mt-2 h-4 w-64" />
        <div className="skeleton mt-6 h-12 w-full" />
        <div className="skeleton mt-10 h-3 w-32" />
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-[64px] w-full" />
          ))}
        </div>
      </main>
    </>
  );
}
