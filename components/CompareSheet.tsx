"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TRANSLATIONS, translationById, type Translation } from "@/lib/translations";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Book slug for the API — null when we couldn't resolve one. */
  bookSlug: string | null;
  chapter: number;
  start: number;
  end: number;
  /** "Psalm 42:3–5", for the heading and for what gets copied. */
  reference: string;
  /** The edition the reader is currently in. It leads the list. */
  currentId: string;
  /** Borrows the reader's toast, so a copy says so in the usual place. */
  onToast: (message: string) => void;
};

/** How many translations are shown before "Show more". Enough to be a
    comparison, few enough to read without scrolling on a phone. */
const FIRST_BATCH = 5;

/** How many more each press of "Show more" adds. */
const MORE_STEP = 5;

type Row =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string };

/**
 * One passage, several translations, stacked.
 *
 * The list is TRANSLATIONS — the same list behind the switcher in the reading
 * bar — so adding an edition to the app adds it here without anyone
 * remembering to. It leads with whatever you're reading in, then works down
 * the complete Bibles, and holds the rest behind "Show more": twenty-six
 * chapter fetches to answer a question about one verse would be rude to the
 * reader and to the rate limit both.
 *
 * Each translation loads on its own line and fails on its own line. A
 * translation that doesn't carry this book, or numbers it differently, says
 * so where its text would have been rather than quietly showing you the King
 * James under another name.
 */
export default function CompareSheet({
  open,
  onClose,
  bookSlug,
  chapter,
  start,
  end,
  reference,
  currentId,
  onToast
}: Props) {
  // Current edition first, then everything else in the order the switcher
  // lists it. Deduped, because the current one is in that list too.
  const ordered: Translation[] = useMemo(() => {
    const current = translationById(currentId);
    return [current, ...TRANSLATIONS.filter((t) => t.id !== current.id)];
  }, [currentId]);

  const [shown, setShown] = useState(FIRST_BATCH);
  const [rows, setRows] = useState<Map<string, Row>>(new Map());

  // Everything fetched for this exact passage, so reopening the sheet on a
  // verse you've already compared is instant.
  const fetchedFor = useRef<string | null>(null);

  const passageKey = `${bookSlug}|${chapter}|${start}|${end}`;
  const visible = ordered.slice(0, shown);

  // A new passage empties the sheet; the same passage keeps what it has.
  useEffect(() => {
    if (!open) return;
    if (fetchedFor.current !== passageKey) {
      fetchedFor.current = passageKey;
      setRows(new Map());
      setShown(FIRST_BATCH);
    }
  }, [open, passageKey]);

  useEffect(() => {
    if (!open || !bookSlug) return;

    const wanted = visible.filter((t) => !rows.has(t.id));
    if (wanted.length === 0) return;

    // Mark them loading in one pass so the sheet draws its placeholders
    // before a single request comes back.
    setRows((prev) => {
      const next = new Map(prev);
      for (const t of wanted) next.set(t.id, { status: "loading" });
      return next;
    });

    let cancelled = false;
    const forPassage = passageKey;

    for (const t of wanted) {
      (async () => {
        let row: Row;
        try {
          const params = new URLSearchParams({
            book: bookSlug,
            chapter: String(chapter),
            start: String(start),
            end: String(end),
            bible: t.id
          });
          const res = await fetch(`/api/bible/verse-text?${params.toString()}`);
          const json = await res.json();
          row =
            res.ok && json?.ok && typeof json.text === "string"
              ? { status: "ready", text: json.text }
              : {
                  status: "error",
                  message:
                    typeof json?.message === "string"
                      ? json.message
                      : "This one wouldn’t load just now."
                };
        } catch {
          row = {
            status: "error",
            message: "This one wouldn’t load just now. Check your connection."
          };
        }
        // Don't write into a sheet that has since moved to another verse.
        if (cancelled || fetchedFor.current !== forPassage) return;
        setRows((prev) => new Map(prev).set(t.id, row));
      })();
    }

    return () => {
      cancelled = true;
    };
    // `rows` is deliberately out of the dependency list: it is written by
    // this effect, and reading it here is only to skip what is already in
    // flight. Including it would re-enter on every arriving translation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookSlug, chapter, start, end, shown, passageKey, ordered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function copyOne(t: Translation, text: string) {
    try {
      await navigator.clipboard.writeText(`“${text}” — ${reference} (${t.abbr})`);
      onToast(`Copied the ${t.abbr}.`);
    } catch {
      onToast("Couldn’t copy. Try again.");
    }
  }

  return (
    <div
      // Tagged like the note sheet: a tap in here is the reason the verses
      // were selected, so it must not clear the selection.
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
        role="dialog"
        aria-modal="true"
        aria-label={`${reference} in several translations`}
        className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="pt-2 pb-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="px-5 pb-5">
          <p className="kicker">Side by side</p>
          <h2 className="mt-2 font-serif text-2xl font-medium text-rog-ink leading-tight">
            {reference}
          </h2>

          {!bookSlug && (
            <p className="mt-6 text-sm text-rog-muted">
              We couldn&rsquo;t work out which book this verse is in, so there is
              nothing to compare. Nothing you&rsquo;ve saved is affected.
            </p>
          )}

          {bookSlug && (
            <>
              <ul className="mt-6 card-list">
                {visible.map((t) => {
                  const row = rows.get(t.id) ?? { status: "loading" as const };
                  return (
                    <li key={t.id} className="card">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="kicker kicker-strong">
                          {t.abbr} &middot; {t.name}
                        </span>
                        {row.status === "ready" && (
                          <button
                            type="button"
                            onClick={() => copyOne(t, row.text)}
                            className="act shrink-0 text-xs"
                          >
                            Copy
                          </button>
                        )}
                      </div>

                      {row.status === "loading" && (
                        <p className="mt-2 text-sm text-rog-muted" aria-live="polite">
                          Loading…
                        </p>
                      )}

                      {row.status === "error" && (
                        <p className="mt-2 text-sm text-rog-muted">{row.message}</p>
                      )}

                      {row.status === "ready" && (
                        <p className="mt-2 font-serif text-[16px] leading-relaxed text-rog-ink selectable">
                          {row.text}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {shown < ordered.length && (
                <button
                  type="button"
                  onClick={() => setShown((n) => Math.min(n + MORE_STEP, ordered.length))}
                  className="btn-secondary mt-5 w-full text-center"
                >
                  Show more translations
                </button>
              )}

              <p className="mt-5 text-xs text-rog-muted leading-relaxed">
                Comparing doesn&rsquo;t change the translation you&rsquo;re
                reading in, and it never touches your highlights or notes.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
