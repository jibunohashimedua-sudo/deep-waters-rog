"use client";
import { LENS_BY_ID, type LensId } from "@/lib/bench";
import type { Translation } from "@/lib/translations";
import type { ParallelRow } from "@/lib/parallelVerse";
import type {
  CommentaryEntry, ConcordanceHit, CrossRef, StrongsEntry, TaggedWord,
  ExpositionEntry
} from "@/lib/studyData";
import BenchTranslations from "./BenchTranslations";
import BenchHouse, { type HouseRow } from "./BenchHouse";
import BenchWords from "./BenchWords";
import BenchConcordance from "./BenchConcordance";
import BenchCrossRefs from "./BenchCrossRefs";
import BenchCommentary from "./BenchCommentary";
import BenchExposition from "./BenchExposition";

export type LensData = {
  visibleTranslations: Translation[];
  rows: Map<string, ParallelRow>;
  bookSlug: string | null;
  canShowMore: boolean;
  onShowMore: () => void;
  houseRows: HouseRow[] | null;
  houseLoading: boolean;
  planDay: number | null;
  taggedWords: TaggedWord[];
  wordsLoading: boolean;
  strongsEntries: Map<string, StrongsEntry>;
  activeWordKey: string | null;
  activeWord: string | null;
  activeStrongsId: string | null;
  concordanceTotal: number;
  concordanceHits: ConcordanceHit[];
  concordanceLoading: boolean;
  concordanceMore: boolean;
  onConcordanceMore: () => void;
  crossRefs: CrossRef[] | null;
  crossRefsLoading: boolean;
  exposition: ExpositionEntry[] | null;
  expositionLoading: boolean;
  commentary: CommentaryEntry[] | null;
  commentaryLoading: boolean;
  verse: number;
  onPickWord: (word: TaggedWord) => void;
};

/**
 * One lens's content, and the line at its foot saying where that content
 * came from.
 *
 * Six of the seven now carry real data. Vine's is still honest about being
 * empty: no edition of it could be found under a licence clean enough to
 * import, and rather than put a different dictionary behind its name, the
 * tab opens and says so. A study tool that quietly substitutes one
 * reference work for another is worse than one that admits a gap.
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

      {lens === "words" && (
        <BenchWords
          words={data.taggedWords}
          entries={data.strongsEntries}
          activeKey={data.activeWordKey}
          loading={data.wordsLoading}
          onPick={data.onPickWord}
        />
      )}

      {lens === "concordance" && (
        <BenchConcordance
          strongsId={data.activeStrongsId}
          word={data.activeWord}
          total={data.concordanceTotal}
          hits={data.concordanceHits}
          loading={data.concordanceLoading}
          canShowMore={data.concordanceMore}
          onShowMore={data.onConcordanceMore}
        />
      )}

      {lens === "crossrefs" && (
        <BenchCrossRefs refs={data.crossRefs} loading={data.crossRefsLoading} />
      )}

      {lens === "exposition" && (
        <BenchExposition
          entries={data.exposition}
          loading={data.expositionLoading}
          verse={data.verse}
        />
      )}

      {lens === "commentary" && (
        <BenchCommentary
          entries={data.commentary}
          loading={data.commentaryLoading}
          verse={data.verse}
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
              Aimed at &ldquo;{data.activeWord}&rdquo;.
            </p>
          )}
        </>
      )}

      {meta && <p className="bench-source">Source: {meta.source}</p>}
    </div>
  );
}
