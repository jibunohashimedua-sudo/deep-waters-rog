"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BIBLE_BOOKS,
  NT_GROUPS,
  OT_GROUPS,
  searchBooks,
  type BibleBook,
  type BookGroup
} from "@/lib/bibleBooks";

/**
 * The whole Bible, one tap from anywhere.
 *
 * Search sits at the very top and is the fastest route to a book: someone
 * looking something up mid-service types "gen", "jn" or "1 cor" and the grid
 * narrows as they type. With the box empty it shows all 66, grouped the way
 * a Bible's contents page does.
 */
export default function BookPicker() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchBooks(query), [query]);
  const searching = query.trim().length > 0;

  // Membership lookup, so grouped rendering stays O(n) rather than
  // re-filtering 66 books once per group.
  const matched = useMemo(() => new Set(results.map((b) => b.slug)), [results]);

  const groupsWithHits = (groups: BookGroup[]) =>
    groups
      .map((g) => ({
        group: g,
        books: BIBLE_BOOKS.filter((b) => b.group === g && matched.has(b.slug))
      }))
      .filter((s) => s.books.length > 0);

  const ot = groupsWithHits(OT_GROUPS);
  const nt = groupsWithHits(NT_GROUPS);

  return (
    <>
      {/* Pinned so it stays reachable while the grid scrolls under it. The
          offset clears the sticky app header above. */}
      <div className="sticky top-[60px] z-30 -mx-6 px-6 py-3 bible-search-bar">
        <label htmlFor="book-search" className="sr-only">
          Search for a book
        </label>
        <input
          id="book-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a book — try “gen”, “jn”, “1 cor”"
          className="w-full min-h-[48px] rounded-full px-5 text-base bg-white/80 dark:bg-white/10 border border-rog-line focus:border-rog-purple focus:outline-none text-rog-ink placeholder:text-rog-muted"
        />
      </div>

      {searching && results.length === 0 && (
        <div className="empty-state mt-10">
          <p className="empty-body">No book by that name.</p>
          <p className="empty-hint">
            Try the start of the name, or an abbreviation like “rev” or “2 tim”.
          </p>
        </div>
      )}

      {ot.length > 0 && (
        <Testament title="Old Testament" sections={ot} />
      )}
      {nt.length > 0 && (
        <Testament title="New Testament" sections={nt} />
      )}
    </>
  );
}

function Testament({
  title,
  sections
}: {
  title: string;
  sections: { group: BookGroup; books: BibleBook[] }[];
}) {
  return (
    <section className="mt-10">
      <h2 className="kicker">{title}</h2>
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
