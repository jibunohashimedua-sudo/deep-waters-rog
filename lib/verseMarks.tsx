"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normaliseHighlightColour,
  type Highlight,
  type VerseNote
} from "@/lib/highlights";
import { getMarksForChapters, putMarksForChapters } from "@/lib/offline/db";
import { isNetworkFailure } from "@/lib/offline/marks";
import { reportOffline, reportOnline } from "@/lib/offline/useOnline";

/** One chapter on screen, as the marks tables name it. */
export type ChapterKey = { book: string; chapter: number };

/**
 * This reader's highlights and notes for a set of chapters.
 *
 * Lifted out of ScriptureReader unchanged — same two plain queries, same
 * "no nested joins" reason, same colour normalisation on the way in — so
 * that a reader holding its own marks and a pair of readers sharing one
 * store are loading the identical rows in the identical way. Two copies of
 * this query would be two things to keep in step, and the one that drifted
 * would drift silently: a highlight that paints on one surface and not on
 * another looks exactly like a highlight that was never saved.
 */
export async function loadVerseMarks(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  chapters: ChapterKey[]
): Promise<{
  highlights: Highlight[];
  notes: VerseNote[];
  errors: string[];
}> {
  const bookNames = Array.from(new Set(chapters.map((c) => c.book)));
  const errors: string[] = [];
  if (bookNames.length === 0) return { highlights: [], notes: [], errors };

  const chapterKeys = chapters.map((c) => `${c.book}|${c.chapter}`);

  // Separate plain queries — no nested joins (avoids HTTP 300 ambiguity).
  const [{ data: hData, error: hErr }, { data: nData, error: nErr }] =
    await Promise.all([
      supabase.from("highlights").select("*").eq("user_id", userId).in("book", bookNames),
      supabase.from("verse_notes").select("*").eq("user_id", userId).in("book", bookNames)
    ]);

  // No signal. A reader's own marks are the last thing that should vanish
  // when the network does — a highlight is a place they meant to come back
  // to — so the device's copy answers instead, and nothing is said. The
  // offline bar is already saying it, once, for the whole app; a toast per
  // chapter reading "Load failed" would be six ways of repeating it.
  if (isNetworkFailure(hErr) || isNetworkFailure(nErr)) {
    reportOffline();
    const stored = await getMarksForChapters(chapterKeys);
    return {
      highlights: stored
        .filter((m) => m.kind === "highlight")
        .map((m) => m.row as unknown as Highlight),
      notes: stored.filter((m) => m.kind === "note").map((m) => m.row as unknown as VerseNote),
      errors
    };
  }

  if (hErr) errors.push(hErr.message);
  if (nErr) errors.push(nErr.message);

  const chapterSet = new Set(chapterKeys);

  // Colours come back through the palette on the way in, so a row written
  // by the previous build during the deploy still paints. See
  // normaliseHighlightColour, and the colour-rename migration.
  const highlights = (hData ?? [])
    .filter((h) => chapterSet.has(`${h.book}|${h.chapter}`))
    .map((h) => ({ ...h, colour: normaliseHighlightColour(h.colour) }))
    .filter((h): h is Highlight => h.colour !== null);

  const notes = (nData ?? []).filter((n) =>
    chapterSet.has(`${n.book}|${n.chapter}`)
  ) as VerseNote[];

  // Keep them, for the next journey. Only when both queries came back
  // clean: storing a half-answer would let one failed query quietly delete
  // the device's copy of the other half.
  if (!hErr && !nErr) {
    reportOnline();
    void putMarksForChapters(chapterKeys, [
      ...highlights.map((h) => ({
        id: String(h.id),
        kind: "highlight" as const,
        chapterKey: `${h.book}|${h.chapter}`,
        row: h as unknown as Record<string, unknown>
      })),
      ...notes.map((n) => ({
        id: String(n.id),
        kind: "note" as const,
        chapterKey: `${n.book}|${n.chapter}`,
        row: n as unknown as Record<string, unknown>
      }))
    ]).catch(() => {});
  }

  return { highlights, notes, errors };
}

/**
 * One copy of the marks, shared by every pane on screen.
 *
 * A highlight belongs to a verse, not to a pane. With two panes each
 * holding their own copy — which is what a reader does on its own —
 * highlighting Romans 8:1 on the left would leave the right showing it
 * unmarked until something reloaded, and the two would go on disagreeing
 * for as long as they were both open. There is no syncing here to get
 * wrong: both panes read the same array, so both repaint on the same
 * render, because there is only one truth to repaint from.
 */
export type SharedMarks = {
  highlights: Highlight[];
  notes: VerseNote[];
  setHighlights: Dispatch<SetStateAction<Highlight[]>>;
  setNotes: Dispatch<SetStateAction<VerseNote[]>>;
  /** A pane says which chapters it is showing; the store loads their union. */
  register: (paneId: string, chapters: ChapterKey[]) => void;
  unregister: (paneId: string) => void;
};

const VerseMarksContext = createContext<SharedMarks | null>(null);

/**
 * The shared store, when there is one.
 *
 * Null everywhere else — which is every surface in the app except a Bible
 * page with two panes open. A reader that gets null holds its own marks and
 * runs exactly the code it ran before this existed, so the single pane,
 * /read, and the daily reading are not merely unaffected in practice but
 * take the same branch they always took.
 */
export function useSharedVerseMarks(): SharedMarks | null {
  return useContext(VerseMarksContext);
}

const keyOfChapters = (chapters: ChapterKey[]) =>
  chapters
    .map((c) => `${c.book}|${c.chapter}`)
    .sort()
    .join(",");

export function VerseMarksProvider({
  userId,
  supabase,
  onError,
  children
}: {
  userId: string;
  supabase: SupabaseClient<any, any, any>;
  onError?: (message: string) => void;
  children: ReactNode;
}) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<VerseNote[]>([]);
  /** paneId → the chapters it is showing, flattened to a comparable string. */
  const [registry, setRegistry] = useState<Record<string, string>>({});

  const register = useCallback((paneId: string, chapters: ChapterKey[]) => {
    const key = keyOfChapters(chapters);
    setRegistry((prev) => (prev[paneId] === key ? prev : { ...prev, [paneId]: key }));
  }, []);

  const unregister = useCallback((paneId: string) => {
    setRegistry((prev) => {
      if (!(paneId in prev)) return prev;
      const next = { ...prev };
      delete next[paneId];
      return next;
    });
  }, []);

  // The union of every pane's chapters, as one stable string, so a pane
  // re-rendering with the same chapters doesn't re-enter the fetch.
  const wanted = useMemo(
    () => Array.from(new Set(Object.values(registry).flatMap((v) => v.split(",")))).sort(),
    [registry]
  );
  const wantedKey = wanted.join(";");

  useEffect(() => {
    const chapters = wanted
      .filter(Boolean)
      .map((k) => {
        const at = k.lastIndexOf("|");
        return { book: k.slice(0, at), chapter: Number(k.slice(at + 1)) };
      })
      .filter((c) => c.book && Number.isFinite(c.chapter));
    if (chapters.length === 0) return;

    let cancelled = false;
    (async () => {
      const res = await loadVerseMarks(supabase, userId, chapters);
      if (cancelled) return;
      for (const message of res.errors) onError?.(message);
      setHighlights(res.highlights);
      setNotes(res.notes);
    })();
    return () => {
      cancelled = true;
    };
    // `wanted` is derived from wantedKey; listing the array itself would
    // re-enter on every render that rebuilt it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, userId, supabase, onError]);

  const value = useMemo<SharedMarks>(
    () => ({ highlights, notes, setHighlights, setNotes, register, unregister }),
    [highlights, notes, register, unregister]
  );

  return (
    <VerseMarksContext.Provider value={value}>{children}</VerseMarksContext.Provider>
  );
}
