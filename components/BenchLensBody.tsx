"use client";
import { LENS_BY_ID, type LensId } from "@/lib/bench";
import type { Translation } from "@/lib/translations";
import type { ParallelRow } from "@/lib/parallelVerse";
import type { BenchWord } from "@/lib/benchWords";
import BenchTranslations from "./BenchTranslations";
import BenchHouse, { type HouseRow } from "./BenchHouse";

export type LensData = {
  visibleTranslations: Translation[];
  rows: Map<string, ParallelRow>;
  bookSlug: string | null;
  canShowMore: boolean;
  onShowMore: () => void;
  houseRows: HouseRow[] | null;
  houseLoading: boolean;
  planDay: number | null;
  activeWord: BenchWord | null;
};

/**
 * One lens's content, and the line at its foot saying where that content
 * came from.
 *
 * Five of the seven are honest about being empty. They are not hidden and
 * they are not filled with something plausible: the tab is there, the lens
 * opens, and it says in one mono line that its dataset has not been loaded
 * yet. A study tool that invents a cross reference is worse than one that
 * hasn't got any.
 */
export default function BenchLensBody({
  lens,
  data
}: {
  lens: LensId;
  data: LensData;
}) {
  const meta = LENS_BY_ID.get(lens);
  return (
    <div className="bench-lens-body">
      {lens === "translations" && (
        <BenchTranslations
          visible={data.visibleTranslations}
          rows={data.rows}
          bookSlug={data.bookSlug}
          canShowMore={data.canShowMore}
          onShowMore={data.onShowMore}
        />
      )}

      {lens === "house" && (
        <BenchHouse
          rows={data.houseRows}
          planDay={data.planDay}
          loading={data.houseLoading}
        />
      )}

      {/* The same sentence every pending lens says, so a reader learns it
          once. A word lens adds one line naming what it is aimed at, which
          is a fact about the rail and not a hedge about the dataset. */}
      {meta?.pending && (
        <>
          <p className="bench-empty">
            The {meta.label} dataset has not been loaded yet.
          </p>
          {meta.takesWord && data.activeWord && (
            <p className="bench-empty">
              Aimed at &ldquo;{data.activeWord.word}&rdquo;.
            </p>
          )}
        </>
      )}

      {meta && <p className="bench-source">Source: {meta.source}</p>}
    </div>
  );
}
