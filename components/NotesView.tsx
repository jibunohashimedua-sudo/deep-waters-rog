"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type NoteRow = {
  id: string;
  book: string;
  /** "PSALM 42:7" — already uppercased for the mono line. */
  reference: string;
  /** What the reader wrote. */
  body: string;
  /** ISO date of the last edit. */
  updatedAt: string;
  /** Opens the chapter at the verse. */
  href: string;
};

const PAGE = 40;

/**
 * Every note you have written, newest first.
 *
 * The same treatment as the highlights list — hairline-separated rows, the
 * reference in mono, the date in mono — with one difference that matters:
 * the body is set in the interface sans, not the reading serif, because a
 * note is something you wrote and the serif is reserved for scripture.
 *
 * Notes are private. They are never surfaced to the community, and the RLS
 * on verse_notes is select/insert/update/delete on auth.uid() = user_id, so
 * that is enforced at the database and not only by this page asking nicely.
 */
export default function NotesView({ rows }: { rows: NoteRow[] }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.body.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)
    );
  }, [rows, query]);

  useEffect(() => setVisible(PAGE), [query]);

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

  if (rows.length === 0) {
    return (
      <div className="mt-10">
        <p className="font-serif text-[19px] leading-[1.6] text-rog-ink">
          No notes yet.
        </p>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          While you&rsquo;re reading, tap a verse and choose Note. What you
          write stays private to you.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <label htmlFor="note-search" className="sr-only">
        Search your notes
      </label>
      <input
        id="note-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="chip !min-h-[44px] w-full px-4 !text-[13.5px] border"
      />

      <p className="kicker mt-5">
        {filtered.length} {filtered.length === 1 ? "note" : "notes"}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 font-serif text-[17px] text-rog-muted">
          Nothing here matches that.
        </p>
      ) : (
        <ul className="mark-list mt-5">
          {filtered.slice(0, visible).map((r) => (
            <li key={r.id} className="mark-row">
              <Link href={r.href} className="block">
                <span className="kicker kicker-strong block">{r.reference}</span>
                <span className="mark-note selectable block mt-2">{r.body}</span>
                <span className="kicker block mt-2">
                  {new Date(r.updatedAt).toLocaleDateString("en-GB")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden className="h-px" />
    </div>
  );
}
