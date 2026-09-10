"use client";
import { useEffect, useRef, useState } from "react";
import type { Translation } from "@/lib/translations";

/** One translation's line: in flight, arrived, or failed on its own. */
export type ParallelRow =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "error"; message: string };

/**
 * One passage in one translation, from the app's own endpoint.
 *
 * Lifted out of CompareSheet unchanged so the Bench's Translations lens
 * asks for parallel text the same way the Compare sheet does — one fetcher,
 * one endpoint, one cache behind it. Adding a second would have meant two
 * things to keep in step and two ways for a translation to fail.
 */
export async function fetchParallelVerse(args: {
  bookSlug: string;
  chapter: number;
  start: number;
  end: number;
  bibleId: string;
}): Promise<ParallelRow> {
  try {
    const params = new URLSearchParams({
      book: args.bookSlug,
      chapter: String(args.chapter),
      start: String(args.start),
      end: String(args.end),
      bible: args.bibleId
    });
    const res = await fetch(`/api/bible/verse-text?${params.toString()}`);
    const json = await res.json();
    return res.ok && json?.ok && typeof json.text === "string"
      ? { status: "ready", text: json.text }
      : {
          status: "error",
          message:
            typeof json?.message === "string"
              ? json.message
              : "This one wouldn’t load just now."
        };
  } catch {
    return {
      status: "error",
      message: "This one wouldn’t load just now. Check your connection."
    };
  }
}

/**
 * A row per translation for one passage, loaded independently.
 *
 * Each line loads on its own and fails on its own, which is what lets a
 * translation that doesn't carry this book say so where its text would have
 * been rather than taking the whole list down. A new passage empties the
 * map; the same passage keeps what it already has, so reopening on a verse
 * you have already compared is instant.
 */
export function useParallelRows(args: {
  /** Only fetch while the surface showing these rows is actually visible. */
  active: boolean;
  bookSlug: string | null;
  chapter: number;
  start: number;
  end: number;
  /** The translations wanted right now — the first batch, then more. */
  visible: Translation[];
  /**
   * Called once when a batch has finished arriving, however it went.
   *
   * Only the Bench passes this, and only in Stack mode, where it advances
   * the reveal counter. It exists because Translations is the first lens
   * in the stack and had no way to say it was done — so the chain it was
   * supposed to start never moved. See STACK_SEED in lib/bench.ts and
   * ELITE_EXCELLENCE_AUDIT P1-A. CompareSheet passes nothing and behaves
   * exactly as it did.
   */
  onSettled?: () => void;
}): Map<string, ParallelRow> {
  const { active, bookSlug, chapter, start, end, visible, onSettled } = args;
  const [rows, setRows] = useState<Map<string, ParallelRow>>(new Map());
  const fetchedFor = useRef<string | null>(null);

  const passageKey = `${bookSlug}|${chapter}|${start}|${end}`;

  useEffect(() => {
    if (!active) return;
    if (fetchedFor.current !== passageKey) {
      fetchedFor.current = passageKey;
      setRows(new Map());
    }
  }, [active, passageKey]);

  const ids = visible.map((t) => t.id).join(",");

  // Read through a ref so a caller passing an inline closure — which the
  // Bench does — cannot re-enter the effect on every render.
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (!active || !bookSlug) return;

    const wanted = visible.filter((t) => !rows.has(t.id));
    if (wanted.length === 0) return;

    // Mark them loading in one pass so the placeholders draw before a
    // single request comes back.
    setRows((prev) => {
      const next = new Map(prev);
      for (const t of wanted) next.set(t.id, { status: "loading" });
      return next;
    });

    let cancelled = false;
    const forPassage = passageKey;

    // Every line settles on its own; the batch has settled when the last
    // of them has, whether it arrived or failed.
    Promise.all(
      wanted.map(async (t) => {
        const row = await fetchParallelVerse({
          bookSlug,
          chapter,
          start,
          end,
          bibleId: t.id
        });
        // Don't write into a list that has since moved to another verse.
        if (cancelled || fetchedFor.current !== forPassage) return;
        setRows((prev) => new Map(prev).set(t.id, row));
      })
    ).finally(() => {
      if (cancelled) return;
      settledRef.current?.();
    });

    return () => {
      cancelled = true;
    };
    // `rows` is deliberately out of the dependency list: it is written by
    // this effect, and reading it here is only to skip what is already in
    // flight. Including it would re-enter on every arriving translation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, bookSlug, chapter, start, end, passageKey, ids]);

  return rows;
}

// ---------------------------------------------------------- whole chapters

/** One chapter's worth of a pane: in flight, arrived, or failed on its own. */
export type ParallelChapter =
  | { status: "loading" }
  | {
      status: "ready";
      reference: string;
      html: string;
      /** What was actually fetched, which is the KJV where the chosen
          translation doesn't carry this book. */
      resolvedId: string;
      fallbackNote: string | null;
    }
  | { status: "error"; message: string };

/**
 * Chapters already fetched, kept for the life of the tab.
 *
 * Module state, not component state, and that is the point: a pane unmounts
 * whenever the split folds away on a rotation, and remounts when it comes
 * back. Without this, coming back out of portrait would show a spinner over
 * a chapter the browser fetched thirty seconds ago. The server caches the
 * same chapters behind /api/bible/chapter, so this is only saving the round
 * trip — but the round trip is the whole of the flicker.
 *
 * Scripture doesn't change, so there is nothing here to invalidate.
 */
const chapterCache = new Map<string, ParallelChapter & { status: "ready" }>();

export const chapterCacheKey = (
  bookSlug: string,
  chapter: number,
  bibleId: string
) => `${bookSlug}|${chapter}|${bibleId}`;

export function cachedChapter(
  bookSlug: string,
  chapter: number,
  bibleId: string
): (ParallelChapter & { status: "ready" }) | null {
  return chapterCache.get(chapterCacheKey(bookSlug, chapter, bibleId)) ?? null;
}

/**
 * Seed the cache with a chapter the server already rendered.
 *
 * The first pane of a parallel view is showing a chapter this page was
 * server-rendered with. Swapping the panes and swapping back must not send
 * that same chapter over the network again to get it back.
 */
export function seedChapter(
  bookSlug: string,
  chapter: number,
  bibleId: string,
  value: { reference: string; html: string; fallbackNote: string | null }
): void {
  const key = chapterCacheKey(bookSlug, chapter, bibleId);
  if (chapterCache.has(key)) return;
  chapterCache.set(key, {
    status: "ready",
    reference: value.reference,
    html: value.html,
    resolvedId: bibleId,
    fallbackNote: value.fallbackNote
  });
}

/**
 * One chapter, in one translation, for a reading pane.
 *
 * Shaped like fetchParallelVerse above and failing the same way for the
 * same reasons, so a pane that can't load says the same sort of thing the
 * Compare sheet says rather than inventing its own vocabulary for the same
 * network. The difference is only what comes back: a run of verses as text
 * there, a whole chapter as verse-wrapped HTML here.
 */
export async function fetchParallelChapter(args: {
  bookSlug: string;
  chapter: number;
  bibleId: string;
}): Promise<ParallelChapter> {
  const hit = cachedChapter(args.bookSlug, args.chapter, args.bibleId);
  if (hit) return hit;

  try {
    const params = new URLSearchParams({
      book: args.bookSlug,
      chapter: String(args.chapter),
      bible: args.bibleId
    });
    const res = await fetch(`/api/bible/chapter?${params.toString()}`);
    const json = await res.json();
    if (res.ok && json?.ok && typeof json.html === "string") {
      const value = {
        status: "ready" as const,
        reference: String(json.reference ?? ""),
        html: json.html as string,
        resolvedId: String(json.resolvedId ?? args.bibleId),
        fallbackNote:
          typeof json.fallbackNote === "string" ? json.fallbackNote : null
      };
      chapterCache.set(
        chapterCacheKey(args.bookSlug, args.chapter, args.bibleId),
        value
      );
      return value;
    }
    return {
      status: "error",
      message:
        typeof json?.message === "string"
          ? json.message
          : "That chapter wouldn’t load just now."
    };
  } catch {
    return {
      status: "error",
      message:
        "That chapter wouldn’t load just now. Check your connection and try again."
    };
  }
}
