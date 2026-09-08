"use client";
import type { Translation } from "@/lib/translations";
import type { ParallelRow } from "@/lib/parallelVerse";

type Props = {
  visible: Translation[];
  rows: Map<string, ParallelRow>;
  /** Null when we couldn't work out which book this verse is in. */
  bookSlug: string | null;
  canShowMore: boolean;
  onShowMore: () => void;
};

/**
 * The pinned verse in every edition the app already carries.
 *
 * The list is TRANSLATIONS — the same list behind the reading bar's switcher
 * and behind Compare — and the text comes through the same fetcher Compare
 * uses. Elite adds no translation source of its own: a study layer that
 * quietly introduced a different set of editions from the one the rest of
 * the app reads in would be two Bibles in one app.
 */
export default function BenchTranslations({
  visible,
  rows,
  bookSlug,
  canShowMore,
  onShowMore
}: Props) {
  if (!bookSlug) {
    return (
      <p className="bench-empty">
        We couldn’t work out which book this verse is in, so there is nothing
        to line up beside it.
      </p>
    );
  }

  return (
    <>
      <ul className="bench-rows">
        {visible.map((t) => {
          const row = rows.get(t.id) ?? ({ status: "loading" } as ParallelRow);
          return (
            <li key={t.id} className="bench-row">
              <p className="kicker kicker-strong">
                {t.abbr} &middot; {t.name}
              </p>
              {row.status === "loading" && (
                <p className="bench-empty" aria-live="polite">
                  Loading…
                </p>
              )}
              {row.status === "error" && (
                <p className="bench-empty">{row.message}</p>
              )}
              {row.status === "ready" && (
                <p className="bench-scripture selectable">{row.text}</p>
              )}
            </li>
          );
        })}
      </ul>

      {canShowMore && (
        <button type="button" onClick={onShowMore} className="bench-more">
          Show more translations
        </button>
      )}
    </>
  );
}
