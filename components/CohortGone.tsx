import Link from "next/link";

/**
 * "This cohort is no longer here." — a friendly stand-in for the raw 404
 * that used to render when a cohort had been deleted between the last
 * time the reader had the link and them clicking it. Notifications and
 * bookmarks can outlive the row they point at; this page acknowledges
 * that rather than pretending the URL is broken.
 *
 * Deliberately no `<Nav>`: this is a terminal page for both signed-in
 * and signed-out visitors, and the routes it hands them (Today / home)
 * both take them somewhere useful.
 */
export default function CohortGone({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="main-plain min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="kicker">Cohort</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          This cohort is no longer here.
        </h1>
        <p className="mt-4 font-serif text-[17px] leading-[1.55] text-rog-muted max-w-[36ch]">
          It may have been deleted, or the link may have been mistyped. Your
          own reading, reflections and highlights are unaffected.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <>
              <Link href="/today" className="btn-primary">Back to today</Link>
              <Link href="/community?view=cohorts" className="btn-secondary">Browse cohorts</Link>
            </>
          ) : (
            <Link href="/" className="btn-primary">Back to Deep Waters</Link>
          )}
        </div>
      </div>
    </main>
  );
}
