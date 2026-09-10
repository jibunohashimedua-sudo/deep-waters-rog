"use client";
import TranslationSwitcher from "./TranslationSwitcher";
import type { ParallelRow } from "@/lib/parallelVerse";

/** The passage this window is holding, as the Bench remembers it. */
export type SecondPassage = {
  bookSlug: string;
  /** Display name — "Isaiah" — because the reference line is read, not parsed. */
  book: string;
  chapter: number;
  start: number;
  end: number;
  bibleId: string;
};

type Props = {
  userId: string;
  passage: SecondPassage | null;
  row: ParallelRow | null;
  /** How many verses this chapter has, once we have asked. */
  verseCount: number | null;
  /** Set when a range came in longer than the window will hold. */
  capped: string | null;
  onOpenPicker: () => void;
  onChangeTranslation: (bibleId: string) => void;
  onChangeEnd: (end: number) => void;
  onClear: () => void;
  onCopy: () => void;
  onNote: () => void;
  onToSermon: () => void;
  sermonState: "idle" | "saving" | "added";
  sermonAdded: string | null;
};

/** The window holds four verses. Past that it stops being a second text
    and becomes a second reader, which the Bible tab already is. */
export const SECOND_TEXT_MAX_VERSES = 4;

/**
 * A second passage, chosen by the pastor and left where he put it.
 *
 * Every other lens is aimed at the pinned verse. This one is not, and that
 * is the whole point of it: it is the passage he wants open *beside* the
 * one he is studying. Moving the pinned verse in the reader does not move
 * this, switching lenses does not clear it, and nothing is loaded into it
 * until he asks for something.
 *
 * The picker, the translation control and the fetch are all the app's
 * existing ones — ReferencePicker, TranslationSwitcher and
 * fetchParallelVerse — so this window reads the Bible exactly the way
 * every other surface does, in whichever edition he points it at.
 */
export default function BenchSecondText({
  userId, passage, row, verseCount, capped,
  onOpenPicker, onChangeTranslation, onChangeEnd, onClear,
  onCopy, onNote, onToSermon, sermonState, sermonAdded
}: Props) {
  if (!passage) {
    return (
      <div className="bench-second">
        <button type="button" className="bench-more" onClick={onOpenPicker}>
          Choose a passage
        </button>
        <p className="bench-empty">
          Nothing is loaded here. Pick a passage to sit beside the verse
          you are studying — it stays where you put it while you move
          around the chapter.
        </p>
      </div>
    );
  }

  const reference =
    passage.end > passage.start
      ? `${passage.book} ${passage.chapter}:${passage.start}–${passage.end}`
      : `${passage.book} ${passage.chapter}:${passage.start}`;

  // Only the verses that could actually be reached from the start, and
  // never more than the window holds.
  const lastOffered = Math.min(
    passage.start + SECOND_TEXT_MAX_VERSES - 1,
    verseCount ?? passage.start + SECOND_TEXT_MAX_VERSES - 1
  );
  const endOptions: number[] = [];
  for (let v = passage.start; v <= lastOffered; v++) endOptions.push(v);

  return (
    <div className="bench-second">
      <div className="bench-second-head">
        <button
          type="button"
          className="bench-second-ref"
          onClick={onOpenPicker}
          aria-label={`${reference}. Choose another passage.`}
        >
          {reference.toUpperCase()} <span aria-hidden>&#9662;</span>
        </button>
        <TranslationSwitcher
          userId={userId}
          currentId={passage.bibleId}
          onChange={onChangeTranslation}
          persist={false}
          label="Translation for this window"
        />
      </div>

      {endOptions.length > 1 && (
        <div className="bench-second-range">
          <label htmlFor="bench-second-end" className="meta">
            Through verse
          </label>
          <select
            id="bench-second-end"
            className="bench-second-select"
            value={passage.end}
            onChange={(e) => onChangeEnd(Number(e.target.value))}
          >
            {endOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Said out loud rather than quietly obeyed. A range that arrives
          longer than four verses — from a cross reference, usually — is
          cut to four, and the reader is told which four he is looking at
          instead of being left to wonder where the rest went. */}
      {capped && <p className="bench-capped">{capped}</p>}

      {row?.status === "loading" && (
        <p className="bench-empty" aria-live="polite">Loading…</p>
      )}
      {row?.status === "error" && <p className="bench-empty">{row.message}</p>}
      {row?.status === "ready" && (
        <p className="bench-scripture selectable">{row.text}</p>
      )}

      <div className="bench-row-actions">
        <button
          type="button"
          className="bench-act"
          onClick={onCopy}
          disabled={row?.status !== "ready"}
        >
          Copy
        </button>
        <button
          type="button"
          className="bench-act"
          onClick={onNote}
          disabled={row?.status !== "ready"}
        >
          Note
        </button>
        <button
          type="button"
          className="bench-act"
          data-on={sermonState === "added" ? "true" : undefined}
          onClick={onToSermon}
          disabled={row?.status !== "ready" || sermonState === "saving"}
        >
          {sermonState === "added" && sermonAdded
            ? `Added to ${sermonAdded}`
            : sermonState === "saving"
              ? "Adding…"
              : "To sermon"}
        </button>
        <button type="button" className="bench-act" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
