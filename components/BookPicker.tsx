"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  BIBLE_BOOKS,
  NT_GROUPS,
  OT_GROUPS,
  searchBooks,
  type BibleBook,
  type BookGroup,
  type Testament
} from "@/lib/bibleBooks";
import { formatReference, parseReference, referenceHref } from "@/lib/reference";

/**
 * The whole Bible, one tap from anywhere.
 *
 * Three ways in, in order of how fast they are:
 *
 *   1. Type a reference — "jn 3:16", "1 cor 13:4", "Ps 23" — and press
 *      enter. Two seconds, no navigation in between. This is the path
 *      somebody uses when a reference has just been read aloud, so it is
 *      the one everything else defers to.
 *   2. Type part of a book name and pick from what comes back. Searching
 *      crosses both testaments, so looking for John doesn't require being
 *      on the right tab first — which is the whole reason the tabs hide
 *      while a search is running.
 *   3. Browse: pick a testament, then a section, then a book.
 *
 * The testaments are tabs rather than one long scroll because the two are
 * genuinely separate places in someone's head, and the old single list put
 * Matthew nine screens below Genesis.
 */
export default function BookPicker() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [testament, setTestament] = useState<Testament>("ot");
  const tabsRef = useRef<HTMLDivElement>(null);

  const searching = query.trim().length > 0;

  // A typed reference wins over a book search: someone who typed a chapter
  // and verse has told us exactly where they want to be.
  const reference = useMemo(() => parseReference(query), [query]);
  const results = useMemo(() => searchBooks(query), [query]);
  const matched = useMemo(() => new Set(results.map((b) => b.slug)), [results]);

  const sectionsFor = (groups: BookGroup[], filter: boolean) =>
    groups
      .map((g) => ({
        group: g,
        books: BIBLE_BOOKS.filter(
          (b) => b.group === g && (!filter || matched.has(b.slug))
        )
      }))
      .filter((s) => s.books.length > 0);

  const otHits = sectionsFor(OT_GROUPS, true);
  const ntHits = sectionsFor(NT_GROUPS, true);
  const browseSections = sectionsFor(
    testament === "ot" ? OT_GROUPS : NT_GROUPS,
    false
  );

  // Enter takes the shortest road available: a parsed reference first, then
  // a single unambiguous book, then the best-ranked match. Doing nothing
  // when the intent is obvious is its own kind of rudeness.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (reference) {
      router.push(referenceHref(reference));
      return;
    }
    if (results.length > 0 && searching) {
      router.push(`/bible/${results[0].slug}`);
    }
  }

  // Left/right arrows move between the testament tabs, which is what a
  // screen reader user expects from a tablist.
  function onTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Testament = testament === "ot" ? "nt" : "ot";
    setTestament(next);
    const btns = tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    btns?.[next === "ot" ? 0 : 1]?.focus();
  }

  const nothingFound = searching && !reference && results.length === 0;

  return (
    <>
      {/* Pinned so it stays reachable while the list scrolls under it. The
          offset clears the sticky app header above. */}
      <div className="sticky top-[60px] z-30 -mx-6 px-6 py-3 bible-search-bar">
        <label htmlFor="book-search" className="sr-only">
          Search for a book, or type a reference
        </label>
        <input
          id="book-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Book or reference — try “jn 3:16”"
          className="w-full min-h-[48px] rounded-full px-5 text-base bg-white/80 dark:bg-white/10 border border-rog-line focus:border-rog-purple focus:outline-none text-rog-ink placeholder:text-rog-muted"
        />

        {/* Tabs live inside the pinned bar so switching testament doesn't
            mean scrolling back up. They disappear while searching, because
            a search already crosses both. */}
        {!searching && (
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Testament"
            onKeyDown={onTabKeyDown}
            className="segmented mt-3"
          >
            {(["ot", "nt"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={testament === t}
                tabIndex={testament === t ? 0 : -1}
                onClick={() => setTestament(t)}
                className="segmented-option"
              >
                {t === "ot" ? "Old Testament" : "New Testament"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The reference jump. Sits above everything, styled as the answer
          rather than as one more option, because it is one. */}
      {reference && (
        <Link href={referenceHref(reference)} className="reference-jump mt-6">
          <span className="reference-jump-label">Go to</span>
          <span className="reference-jump-ref">{formatReference(reference)}</span>
          <span className="reference-jump-arrow" aria-hidden>
            &rarr;
          </span>
        </Link>
      )}

      {nothingFound && (
        <div className="empty-state mt-10">
          <p className="empty-body">No book by that name.</p>
          <p className="empty-hint">
            Try the start of the name, an abbreviation like “rev” or “2 tim”, or
            a whole reference like “jn 3:16”.
          </p>
        </div>
      )}

      {searching ? (
        // Searching: both testaments at once, each labelled so a match is
        // never ambiguous about which half of the Bible it came from.
        <>
          {otHits.length > 0 && (
            <TestamentSections title="Old Testament" sections={otHits} />
          )}
          {ntHits.length > 0 && (
            <TestamentSections title="New Testament" sections={ntHits} />
          )}
        </>
      ) : (
        <div
          role="tabpanel"
          aria-label={testament === "ot" ? "Old Testament" : "New Testament"}
        >
          <TestamentSections sections={browseSections} />
        </div>
      )}
    </>
  );
}

function TestamentSections({
  title,
  sections
}: {
  title?: string;
  sections: { group: BookGroup; books: BibleBook[] }[];
}) {
  return (
    <section className="mt-8">
      {title && <h2 className="kicker">{title}</h2>}
      {sections.map((s) => (
        <div key={s.group} className="mt-6">
          <h3 className="text-sm font-semibold text-rog-ink">{s.group}</h3>
          {/* Cards, not a list: two up on a narrow phone, more as it widens. */}
          <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {s.books.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/bible/${b.slug}`}
                  className="surface-soft !p-3 flex flex-col justify-between min-h-[64px] hover:border-rog-purple group select-none"
                >
                  <span className="font-serif text-base text-rog-ink leading-tight">
                    {b.name}
                  </span>
                  <span className="mt-1 text-[11px] text-rog-muted group-hover:text-rog-purple transition-colors">
                    {b.chapters} {b.chapters === 1 ? "chapter" : "chapters"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
