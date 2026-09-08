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
}): Map<string, ParallelRow> {
  const { active, bookSlug, chapter, start, end, visible } = args;
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

    for (const t of wanted) {
      (async () => {
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
      })();
    }

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
