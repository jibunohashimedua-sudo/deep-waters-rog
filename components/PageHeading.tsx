import type { ReactNode } from "react";

/**
 * The page title. One size, one weight, one face — sans, 28px rising to
 * 34px on a wider screen, semibold, tight tracking — copy-pasted by hand
 * into 25-odd files before this existed, each one free to drift a little
 * from the rest. Most did: an unexplained `mt-3` on about half of them,
 * an `mt-2` on one, none at all on the rest, with no difference in what
 * actually sits above the heading to explain it.
 *
 * Plain `<PageHeading>` is right for the common case — the heading is the
 * first thing in `<main>`, and `<main>`'s own top padding is doing the
 * spacing. A screen that puts a real eyebrow or breadcrumb directly above
 * the heading (`.meta`, a small `<h2>`) can pass `className="mt-2"` for
 * the gap that relationship earns. `center` is for the auth/marketing
 * screens that centre a single card.
 */
export default function PageHeading({
  children,
  className = "",
  center = false
}: {
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <h1
      className={`text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight ${
        center ? "text-center " : ""
      }${className}`}
    >
      {children}
    </h1>
  );
}
