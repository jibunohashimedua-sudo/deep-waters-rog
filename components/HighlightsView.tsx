"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HIGHLIGHT_COLOURS,
  HIGHLIGHT_LIGHT,
  type HighlightColour
} from "@/lib/highlights";

export type HighlightRow = {
  id: string;
  book: string;
  colour: HighlightColour;
  /** "PSALM 42:7" — already uppercased for the mono line. */
  reference: string;
  /** The verse itself. Empty when the chapter isn't in the shared cache. */
  text: string;
  /** ISO date the mark was made. */
  createdAt: string;
  /** Opens the chapter at the verse. */
  href: string;
  /** How many verses the row covers, for the count line. */
  verses: number;
};

type Props = {
  rows: HighlightRow[];
  /** Non-null when the verse-text lookup failed; said plainly, not hidden. */
  textError: string | null;
};

/** How many rows are drawn before the list asks for more. */
const PAGE = 40;

/**
 * Every verse you have marked, newest first.
 *
 * By day 90 this is a hundred rows and more, so the filters are not a later
 * refinement — an unfiltered list of a hundred verses is a list nobody
 * reads. Colour, book and text all narrow it, and the count line says what
 * is left. The filtering happens here rather than in the database because
 * the whole set is already on the page: a hundred references and their
 * verses is a few tens of kilobytes, and filtering it in the browser is
 * instant where a round trip per keystroke would not be.
 *
 * Rows, not cards. A hairline between them and a 2px rule down the left in
 * the highlight's own colour, so the colour is identifiable at a glance —
 * which is the whole reason the five have names.
 */
export default function HighlightsView({ rows, textError }: Props) {
  const [colour, setColour] = useState<HighlightColour | "all">("all");
  const [book, setBook] = useState("all");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Only the books this person has actually marked in. Offering all 66
  // would be a list of 64 dead ends and 2 useful ones.
  const books = useMemo(() => {
    const seen = new Set(rows.map((r) => r.book));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (colour !== "all" && r.colour !== colour) return false;
      if (book !== "all" && r.book !== book) return false;
      if (!q) return true;
      return (
        r.text.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)
      );
    });
  }, [rows, colour, book, query]);

  // Narrowing the list should always show its top, not leave you scrolled
  // into the middle of a set that no longer exists.
  useEffect(() => setVisible(PAGE), [colour, book, query]);

  // Draw a page at a time. A hundred rows of clamped serif is a lot of
  // layout to do at once on a phone, and almost none of it gets looked at.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible((v) => (v >= filtered.length ? v : v + PAGE));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const verseCount = filtered.reduce((n, r) => n + r.verses, 0);
  const bookCount = new Set(filtered.map((r) => r.book)).size;

  async function copyAll() {
    const body = filtered
      .map((r) => (r.text ? `${r.reference}\n${r.text}` : r.reference))
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(body);
      setCopied(`${filtered.length} copied.`);
    } catch {
      setCopied("Couldn't copy. Try again.");
    }
    window.setTimeout(() => setCopied(null), 2600);
  }

  if (rows.length === 0) {
    return (
      <div className="mt-10">
        <p className="font-serif text-[19px] leading-[1.6] text-rog-ink">
          Nothing marked yet.
        </p>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          While you&rsquo;re reading, tap a verse to select it, then choose a
          colour from the bar at the bottom of the screen. Everything you mark
          collects here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Colour. Five square swatches and All — the same swatch as the
          toolbar, so the thing you pressed to make the mark is the thing
          you press to find it again. */}
      <div className="hl-filter" role="group" aria-label="Filter by colour">
        <button
          type="button"
          className="chip shrink-0 !min-h-[44px]"
          data-on={colour === "all" ? "true" : undefined}
          onClick={() => setColour("all")}
        >
          All
        </button>
        {HIGHLIGHT_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            className="hl-swatch"
            data-c={c}
            data-on={colour === c ? "true" : undefined}
            aria-pressed={colour === c}
            aria-label={HIGHLIGHT_LIGHT[c].name}
            title={HIGHLIGHT_LIGHT[c].name}
            onClick={() => setColour((prev) => (prev === c ? "all" : c))}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        <label htmlFor="hl-book" className="sr-only">
          Book
        </label>
        <select
          id="hl-book"
          value={book}
          onChange={(e) => setBook(e.target.value)}
          className="chip !min-h-[44px] appearance-none px-4 max-w-[180px] truncate"
        >
          <option value="all">All books</option>
          {books.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <label htmlFor="hl-search" className="sr-only">
          Search your highlights
        </label>
        <input
          id="hl-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="chip !min-h-[44px] flex-1 min-w-[140px] px-4 !text-[13.5px] border"
        />
      </div>

      <p className="kicker mt-5">
        {verseCount} {verseCount === 1 ? "verse" : "verses"} &middot; {bookCount}{" "}
        {bookCount === 1 ? "book" : "books"}
      </p>

      {textError && (
        <p className="mt-3 text-[13.5px] leading-5 text-danger">
          The verses themselves wouldn&rsquo;t load just now, so these are
          listed by reference. Nothing you marked has been lost.
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="mt-8 font-serif text-[17px] text-rog-muted">
          Nothing here matches that.
        </p>
      ) : (
        <ul className="mark-list mt-5">
          {filtered.slice(0, visible).map((r) => {
            const open = expanded.has(r.id);
            return (
              <li key={r.id} className="mark-row" data-c={r.colour}>
                <Link href={r.href} className="block">
                  <span className="kicker kicker-strong block">{r.reference}</span>
                  {r.text && (
                    <span
                      className="mark-text selectable block mt-2"
                      data-clamped={open ? undefined : "true"}
                    >
                      {r.text}
                    </span>
                  )}
                  <span className="kicker block mt-2">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </span>
                </Link>
                {r.text && r.text.length > 190 && (
                  <button
                    type="button"
                    className="kicker mt-2 hover:text-rog-ink"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                  >
                    {open ? "Less" : "Full verse"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div ref={sentinel} aria-hidden className="h-px" />

      {/* Quiet, at the foot, where you'd reach for it after reading down
          the list rather than before you have. */}
      {filtered.length > 0 && (
        <div className="mt-8 flex items-center gap-4">
          <button type="button" className="chip !min-h-[44px]" onClick={copyAll}>
            Copy all as text
          </button>
          {copied && (
            <span className="kicker" role="status" aria-live="polite">
              {copied}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
