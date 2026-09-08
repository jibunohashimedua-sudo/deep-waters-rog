"use client";
import { useEffect, useMemo, useState } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { TRANSLATIONS, translationById, type Translation } from "@/lib/translations";
import { useParallelRows } from "@/lib/parallelVerse";

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

  const passageKey = `${bookSlug}|${chapter}|${start}|${end}`;
  const visible = useMemo(() => ordered.slice(0, shown), [ordered, shown]);

  // The rows themselves — and the "everything fetched for this exact
  // passage" cache behind them — live in lib/parallelVerse now, shared with
  // the Bench's Translations lens so there is one fetcher for parallel text.
  const rows = useParallelRows({
    active: open,
    bookSlug,
    chapter,
    start,
    end,
    visible
  });

  // A new passage starts the list back at the first batch. Emptying the
  // rows is the hook's job.
  useEffect(() => {
    if (!open) return;
    setShown(FIRST_BATCH);
  }, [open, passageKey]);

  // Counted, so a sheet opened on top of another one doesn't leave the
  // body locked when the first of them closes. See lib/useLockBodyScroll.
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
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
