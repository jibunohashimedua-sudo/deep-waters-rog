"use client";
import { useEffect } from "react";
import { daySlots } from "@/lib/plan";
import { bookByName } from "@/lib/bibleBooks";
import { seedChapter, cachedChapterAsync, fetchParallelChapter } from "@/lib/parallelVerse";

type Props = {
  bookSlug: string | null;
  chapter: number;
  bibleId: string;
  reference: string;
  html: string;
  fallbackNote: string | null;
  /** The plan day being read, when there is one. Null on the Bible tab,
      where there is no run of chapters coming next. */
  dayNumber?: number | null;
};

/** How long to wait after paint before doing any of this. Long enough that
    the chapter in front of the reader has settled; short enough that a
    reader who reads one chapter and locks the phone still gets the day. */
const AFTER_PAINT_MS = 800;

/** Between warming requests. The point is to be invisible: this is a
    background courtesy, not a download, and it must never take the network
    away from something the reader is waiting on. */
const BETWEEN_MS = 400;

/**
 * Keep this chapter, and quietly get the rest of the day ready.
 *
 * Two jobs, both after paint, neither blocking anything.
 *
 * The first is the important one and costs nothing: the chapter on this
 * screen was server-rendered into the HTML, so it is already here, and this
 * hands it to the offline store. /bible/[book]/[chapter] has always done
 * this through ParallelBible's seed; the daily reading never had a second
 * pane and so never did. That was the gap — the one screen the whole plan
 * walks through was the one screen that saved nothing.
 *
 * The second is what makes the train work without anybody thinking about
 * it. The reader who opens Deep Waters on the platform gets the rest of
 * today and the whole of tomorrow warmed behind them, one chapter at a
 * time, with a pause between each. Chapters already on the device are
 * skipped without a request. It is deliberately unhurried: if the reader
 * goes into the tunnel halfway through, they have half, and half of
 * tomorrow is better than none of it.
 *
 * Renders nothing, exactly like ChapterPrefetch beside it.
 */
export default function ChapterKeep({
  bookSlug,
  chapter,
  bibleId,
  reference,
  html,
  fallbackNote,
  dayNumber = null
}: Props) {
  // Save what is on the screen. Its own effect, with its own dependencies,
  // so it happens the moment the chapter changes and is never held up by
  // the warming below.
  useEffect(() => {
    if (!bookSlug || !html) return;
    seedChapter(bookSlug, chapter, bibleId, { reference, html, fallbackNote });
  }, [bookSlug, chapter, bibleId, reference, html, fallbackNote]);

  useEffect(() => {
    if (!dayNumber) return;

    let stopped = false;
    const timers: number[] = [];

    const run = async () => {
      // Today's remaining chapters first, then tomorrow's. A reader is far
      // more likely to lose signal partway through today than to need
      // tomorrow, so today is never left half-done to start on tomorrow.
      const wanted = [...daySlots(dayNumber), ...daySlots(dayNumber + 1)];

      for (const slot of wanted) {
        if (stopped) return;
        const book = bookByName(slot.book);
        if (!book) continue;

        // Already here — from this visit, an earlier one, or the download.
        // No request, and no pause either: skipping should be instant.
        const have = await cachedChapterAsync(book.slug, slot.chapter, bibleId);
        if (have || stopped) continue;

        // Goes through the same fetcher the second pane uses, so it lands in
        // the same cache in the same shape, and rides the same server-side
        // bible_cache. A chapter warmed here for one reader is warm for the
        // whole church.
        const got = await fetchParallelChapter({
          bookSlug: book.slug,
          chapter: slot.chapter,
          bibleId
        });
        // A failure means no signal or no quota. Either way, stop: the next
        // twelve would fail the same way, and hammering a rate-limited key
        // is the one thing this must not do.
        if (got.status !== "ready") return;

        await new Promise<void>((resolve) => {
          timers.push(window.setTimeout(resolve, BETWEEN_MS));
        });
      }
    };

    const start = window.setTimeout(() => void run(), AFTER_PAINT_MS);
    timers.push(start);

    return () => {
      stopped = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [dayNumber, bibleId]);

  return null;
}
