"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BIBLE_BOOKS,
  NT_GROUPS,
  OT_GROUPS,
  bookBySlug,
  searchBooks,
  type BibleBook,
  type Testament
} from "@/lib/bibleBooks";

export type PickerStep = "book" | "chapter" | "verse";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Where to start. A book already chosen skips ahead to its chapters. */
  bookSlug?: string | null;
  chapter?: number | null;
  startStep?: PickerStep;
};

type VerseState =
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "error" };

/**
 * Book, then chapter, then verse — all three, in one sheet, everywhere.
 *
 * The verse step used to exist only as a 450ms press-and-hold on a chapter
 * tile, announced in one line of grey hint text. A gesture nobody performs
 * is a feature nobody has, so it is a step of the picker now: you can see it,
 * you arrive at it by tapping, and the chapter grid still opens the chapter
 * outright for anyone who doesn't want it.
 *
 * The verse counts come from /api/bible/verse-count, which reads them off the
 * chapter text in the reader's own translation rather than a table kept here.
 * Translations genuinely disagree about where verses fall — most visibly in
 * the Psalms — so a fixed table would be right for one edition and quietly
 * wrong for the rest.
 */
export default function ReferencePicker({
  open,
  onClose,
  bookSlug = null,
  chapter = null,
  startStep = "book"
}: Props) {
  const router = useRouter();

  const initialBook = useMemo(
    () => (bookSlug ? bookBySlug(bookSlug) : null),
    [bookSlug]
  );

  const [step, setStep] = useState<PickerStep>(startStep);
  const [book, setBook] = useState<BibleBook | null>(initialBook);
  const [ch, setCh] = useState<number | null>(chapter);
  const [query, setQuery] = useState("");
  const [testament, setTestament] = useState<Testament>(
    initialBook?.testament ?? "ot"
  );
  const [verses, setVerses] = useState<VerseState>({ status: "loading" });

  // Counts already asked for, so stepping back and forth is instant.
  const countCache = useRef<Map<string, number | null>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  // Each opening starts from wherever the caller pointed us, not from
  // wherever the last person left it.
  useEffect(() => {
    if (!open) return;
    setStep(startStep);
    setBook(initialBook);
    setCh(chapter);
    setQuery("");
    setTestament(initialBook?.testament ?? "ot");
  }, [open, startStep, initialBook, chapter]);

  // The sheet holds the page still underneath it, and Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // How many verses are in the chosen chapter. Asked for only once the
  // verse step is actually reached — Psalms alone would be 150 chapter
  // loads to answer up front, for a step most people walk straight past.
  useEffect(() => {
    if (!open || step !== "verse" || !book || !ch) return;

    const key = `${book.slug}|${ch}`;
    const cached = countCache.current.get(key);
    if (cached !== undefined) {
      setVerses(
        cached === null ? { status: "error" } : { status: "ready", count: cached }
      );
      return;
    }

    let cancelled = false;
    setVerses({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(
          `/api/bible/verse-count?book=${encodeURIComponent(book.slug)}&chapter=${ch}`
        );
        const json = await res.json();
        const count: number | null =
          res.ok && typeof json.count === "number" ? json.count : null;
        countCache.current.set(key, count);
        if (cancelled) return;
        setVerses(
          count === null ? { status: "error" } : { status: "ready", count }
        );
      } catch {
        if (!cancelled) setVerses({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, book, ch]);

  const searching = query.trim().length > 0;
  const results = useMemo(() => searchBooks(query), [query]);
  const browse = useMemo(
    () =>
      (testament === "ot" ? OT_GROUPS : NT_GROUPS)
        .map((g) => ({ group: g, books: BIBLE_BOOKS.filter((b) => b.group === g) }))
        .filter((s) => s.books.length > 0),
    [testament]
  );

  function chooseBook(b: BibleBook) {
    setBook(b);
    setCh(null);
    setQuery("");
    setStep("chapter");
  }

  function chooseChapter(n: number) {
    setCh(n);
    setStep("verse");
  }

  /** Straight into the chapter, no verse. The skip. */
  function openChapter(n: number) {
    if (!book) return;
    onClose();
    router.push(`/bible/${book.slug}/${n}`);
  }

  function openVerse(v: number) {
    if (!book || !ch) return;
    onClose();
    router.push(`/bible/${book.slug}/${ch}/${v}`);
  }

  const title =
    step === "book"
      ? "Pick a book"
      : step === "chapter"
        ? book!.name
        : `${book!.name} ${ch}`;

  const kicker =
    step === "book" ? "Step 1 of 3" : step === "chapter" ? "Step 2 of 3" : "Step 3 of 3";

  return (
    <div
      // Tagged like the note sheet so the reader's "tap outside clears the
      // selection" rule counts a tap in here as inside.
      data-verse-sheet
      className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Go to a passage"
        tabIndex={-1}
        className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="pt-2 pb-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-center gap-2">
            {/* One step back, not one page back. Only ever shown when
                there is a step behind this one. */}
            {step !== "book" && (
              <button
                type="button"
                onClick={() => setStep(step === "verse" ? "chapter" : "book")}
                aria-label={step === "verse" ? "Back to chapters" : "Back to books"}
                className="reading-back -ml-3 shrink-0"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <p className="kicker">{kicker}</p>
          </div>
          <h2 className="mt-2 font-serif text-2xl font-medium text-rog-ink leading-tight">
            {title}
          </h2>

          {/* ------------------------------------------------ step 1: book */}
          {step === "book" && (
            <>
              <label htmlFor="picker-book-search" className="sr-only">
                Search for a book
              </label>
              <input
                id="picker-book-search"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search — try “john”"
                className="mt-4 w-full min-h-[48px] px-5 text-base bg-white/80 dark:bg-white/10 border border-rog-line focus:border-rog-purple focus:outline-none text-rog-ink placeholder:text-rog-muted"
              />

              {!searching && (
                <div role="tablist" aria-label="Testament" className="segmented mt-3">
                  {(["ot", "nt"] as const).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      type="button"
                      aria-selected={testament === t}
                      onClick={() => setTestament(t)}
                      className="segmented-option"
                    >
                      {t === "ot" ? "Old Testament" : "New Testament"}
                    </button>
                  ))}
                </div>
              )}

              {searching && results.length === 0 && (
                <p className="mt-6 text-sm text-rog-muted">No book by that name.</p>
              )}

              <div className="mt-4 max-h-[46vh] overflow-y-auto">
                {searching ? (
                  <BookList books={results} onPick={chooseBook} />
                ) : (
                  browse.map((s) => (
                    <div key={s.group} className="mb-5">
                      <h3 className="text-sm font-semibold text-rog-ink">{s.group}</h3>
                      <BookList books={s.books} onPick={chooseBook} className="mt-2" />
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* --------------------------------------------- step 2: chapter */}
          {step === "chapter" && book && (
            <>
              <p className="mt-2 text-sm text-rog-muted">
                Tap a chapter to choose a verse, or open it from the start.
              </p>
              <ul className="mt-4 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[46vh] overflow-y-auto">
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <button
                      type="button"
                      className="chapter-tile w-full"
                      aria-label={`${book.name} chapter ${n}`}
                      onClick={() => chooseChapter(n)}
                    >
                      {n}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ----------------------------------------------- step 3: verse */}
          {step === "verse" && book && ch && (
            <>
              {/* The skip, offered first and as the primary action: most
                  people arriving here want the chapter, and being made to
                  pick a verse to get one would be the picker charging rent. */}
              <button
                type="button"
                onClick={() => openChapter(ch)}
                className="btn-secondary mt-4 w-full text-center"
              >
                Open {book.name} {ch} from the start
              </button>

              {verses.status === "loading" && (
                <p className="mt-6 text-sm text-rog-muted">Counting the verses…</p>
              )}

              {verses.status === "error" && (
                <p className="mt-6 text-sm text-rog-muted">
                  We couldn&rsquo;t count the verses in this chapter just now, so
                  open it from the start and scroll — nothing else is affected.
                </p>
              )}

              {verses.status === "ready" && (
                <>
                  <p className="mt-6 kicker">
                    {verses.count} {verses.count === 1 ? "verse" : "verses"}
                  </p>
                  <ul className="mt-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[42vh] overflow-y-auto">
                    {Array.from({ length: verses.count }, (_, i) => i + 1).map((v) => (
                      <li key={v}>
                        <button
                          type="button"
                          className="chapter-tile w-full"
                          aria-label={`${book.name} ${ch} verse ${v}`}
                          onClick={() => openVerse(v)}
                        >
                          {v}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BookList({
  books,
  onPick,
  className = ""
}: {
  books: BibleBook[];
  onPick: (b: BibleBook) => void;
  className?: string;
}) {
  return (
    <ul className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${className}`}>
      {books.map((b) => (
        <li key={b.slug}>
          <button
            type="button"
            onClick={() => onPick(b)}
            className="surface-soft !p-3 w-full text-left flex flex-col justify-between min-h-[60px] hover:border-rog-purple"
          >
            <span className="font-serif text-[15px] text-rog-ink leading-tight">
              {b.name}
            </span>
            <span className="mt-1 text-[11px] text-rog-muted">
              {b.chapters} {b.chapters === 1 ? "chapter" : "chapters"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
