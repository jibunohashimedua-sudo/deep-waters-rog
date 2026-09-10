"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bookBySlug, stepChapter } from "@/lib/bibleBooks";
import { planDayForChapter } from "@/lib/plan";
import {
  cachedChapter,
  chapterCacheKey,
  fetchParallelChapter,
  seedChapter,
  type ParallelChapter
} from "@/lib/parallelVerse";
import type { PaneRef, PaneState } from "@/lib/parallel";
import ScriptureReader from "@/components/ScriptureReader";
import ReferencePicker from "@/components/ReferencePicker";
import TranslationSwitcher from "@/components/TranslationSwitcher";
import BackControl from "@/components/BackControl";

type Props = {
  side: "left" | "right";
  pane: PaneState;
  userId: string;
  isPastoral: boolean;
  /**
   * The chapter this page was server-rendered with, when this pane happens
   * to be showing it. Saves the first pane a round trip for text that is
   * already on the page, and means opening a second pane costs one fetch
   * rather than two.
   */
  seed?: { reference: string; html: string; fallbackNote: string | null } | null;
  onRefChange: (ref: PaneRef) => void;
  onTranslationChange: (id: string) => void;
  /** True for the pane you are reading in — its translation is your
      translation, and follows you to your other devices. */
  persistTranslation: boolean;
  /** The controls that belong to the pair, dropped into this pane's bar. */
  controls?: ReactNode;
  /** True when there are two panes. One pane keeps the page's own scroll. */
  split: boolean;
  /**
   * The way out, on the pane that carries it.
   *
   * A reading screen hides the tab bar — it is the one place in the app
   * with a single job — so the header's back control is the only way off
   * it. The single pane has always had one; a pane needs one too, or a
   * split view is a room with no door.
   */
  backHref?: string | null;
  onScroller?: (el: HTMLElement | null) => void;
  onScroll?: () => void;
};

/**
 * One Bible, in one translation, at one place — its own header, its own
 * chapter, its own scroll.
 *
 * Both sides of a parallel view are this same component, which is the point:
 * there is no "second pane" with a reduced set of powers. Each one carries
 * the same reference picker and the same translation switcher the single
 * reading screen has always carried, and mounts the same ScriptureReader, so
 * highlighting, notes, Compare, Copy, Share and the Bench all work from
 * either side without either side knowing which side it is.
 */
export default function ReaderPane({
  side,
  pane,
  userId,
  isPastoral,
  seed = null,
  onRefChange,
  onTranslationChange,
  persistTranslation,
  controls,
  split,
  backHref = null,
  onScroller,
  onScroll
}: Props) {
  const book = bookBySlug(pane.ref.bookSlug);
  const key = chapterCacheKey(pane.ref.bookSlug, pane.ref.chapter, pane.bibleId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The chapter, adjusted during render when the pane moves rather than in
  // an effect afterwards. A chapter already in the tab's cache — which is
  // every chapter you have looked at since the page loaded, and the one the
  // server rendered — is on screen in the same frame the reference changes,
  // with no flash of a loading line over text the browser already has.
  const [held, setHeld] = useState<{ key: string; value: ParallelChapter }>(() => {
    if (seed) {
      seedChapter(pane.ref.bookSlug, pane.ref.chapter, pane.bibleId, seed);
    }
    return {
      key,
      value:
        cachedChapter(pane.ref.bookSlug, pane.ref.chapter, pane.bibleId) ?? {
          status: "loading"
        }
    };
  });
  if (held.key !== key) {
    setHeld({
      key,
      value:
        cachedChapter(pane.ref.bookSlug, pane.ref.chapter, pane.bibleId) ?? {
          status: "loading"
        }
    });
  }

  useEffect(() => {
    if (held.key !== key) return;
    if (held.value.status !== "loading") return;
    let cancelled = false;
    (async () => {
      const value = await fetchParallelChapter({
        bookSlug: pane.ref.bookSlug,
        chapter: pane.ref.chapter,
        bibleId: pane.bibleId
      });
      if (cancelled) return;
      setHeld((prev) => (prev.key === key ? { key, value } : prev));
    })();
    return () => {
      cancelled = true;
    };
  }, [key, held.key, held.value.status, pane.ref.bookSlug, pane.ref.chapter, pane.bibleId]);

  useEffect(() => {
    onScroller?.(scrollRef.current);
    return () => onScroller?.(null);
  }, [onScroller]);

  const chapter = held.value;
  const planDay = planDayForChapter(book?.name ?? "", pane.ref.chapter);

  // Memoised: ScriptureReader takes this as a prop and holds the injected
  // markup still on its identity. A fresh array every render would re-inject
  // the whole chapter on every render. See the note in ScriptureReader.
  const chapters = useMemo(
    () =>
      chapter.status === "ready" && book
        ? [
            {
              book: book.name,
              chapter: pane.ref.chapter,
              reference: chapter.reference,
              html: chapter.html
            }
          ]
        : [],
    [chapter, book, pane.ref.chapter]
  );

  // The whole run, not just its first verse — /bible/john/3/16-18 marks
  // three verses on the single pane and marks three here.
  const focusVerse = useMemo(
    () =>
      pane.ref.verse
        ? { start: pane.ref.verse, end: pane.ref.verseEnd ?? pane.ref.verse }
        : undefined,
    [pane.ref.verse, pane.ref.verseEnd]
  );

  const prev = book ? stepChapter(book, pane.ref.chapter, -1) : null;
  const next = book ? stepChapter(book, pane.ref.chapter, 1) : null;
  const label = side === "left" ? "Left" : "Right";

  return (
    <section
      className="parallel-pane"
      aria-label={
        split ? `${label} Bible: ${book?.name ?? ""} ${pane.ref.chapter}` : undefined
      }
    >
      <div
        ref={scrollRef}
        data-pane-scroll
        className="parallel-scroll"
        onScroll={onScroll}
      >
        <header className="parallel-bar">
          {backHref && (
            <BackControl
              variant="bare"
              fallbackHref={backHref}
              label={`Back to ${book?.name ?? "the book list"}`}
              className="shrink-0 -ml-1"
            />
          )}

          <button
            type="button"
            className="parallel-ref"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-label={`${book?.name ?? ""} ${pane.ref.chapter}. Go to another passage.`}
          >
            <span className="truncate">
              {book?.name} {pane.ref.chapter}
            </span>
            <span className="reading-caret" aria-hidden>
              &#9662;
            </span>
          </button>

          <div className="parallel-bar-end">
            {/* Previous and next, so a pane can walk a book without opening
                the picker for every chapter. Rolls across books, exactly as
                the single reading screen's pager does. */}
            <button
              type="button"
              className="parallel-step"
              disabled={!prev}
              onClick={() =>
                prev &&
                onRefChange({
                  bookSlug: prev.book.slug,
                  chapter: prev.chapter,
                  verse: null
                })
              }
              aria-label={
                prev ? `Previous chapter, ${prev.book.name} ${prev.chapter}` : "Previous chapter"
              }
            >
              &larr;
            </button>
            <button
              type="button"
              className="parallel-step"
              disabled={!next}
              onClick={() =>
                next &&
                onRefChange({
                  bookSlug: next.book.slug,
                  chapter: next.chapter,
                  verse: null
                })
              }
              aria-label={
                next ? `Next chapter, ${next.book.name} ${next.chapter}` : "Next chapter"
              }
            >
              &rarr;
            </button>

            <TranslationSwitcher
              userId={userId}
              currentId={pane.bibleId}
              onChange={onTranslationChange}
              persist={persistTranslation}
              label={split ? `${label} translation` : "Translation"}
            />

            {controls}
          </div>
        </header>

        <div className="parallel-body">
          {chapter.status === "ready" && chapter.fallbackNote && (
            <p className="mt-4 surface-soft !py-3 !px-4 text-sm text-rog-muted">
              {chapter.fallbackNote}
            </p>
          )}

          {chapter.status === "loading" && (
            <p className="mt-10 text-sm text-rog-muted" role="status">
              Loading {book?.name} {pane.ref.chapter}&hellip;
            </p>
          )}

          {chapter.status === "error" && (
            <div className="mt-10 empty">
              <p>{chapter.message}</p>
            </div>
          )}

          {chapter.status === "ready" && chapters.length > 0 && (
            <ScriptureReader
              key={key}
              userId={userId}
              dayNumber={planDay?.day ?? 1}
              testament={planDay?.testament ?? book?.testament ?? "ot"}
              focusVerse={focusVerse}
              translationId={pane.bibleId}
              isPastoral={isPastoral}
              chapters={chapters}
            />
          )}
        </div>
      </div>

      <ReferencePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        bookSlug={pane.ref.bookSlug}
        chapter={pane.ref.chapter}
        startStep="book"
        onPick={onRefChange}
      />
    </section>
  );
}
