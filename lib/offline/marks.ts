"use client";
import type { Highlight, VerseNote } from "@/lib/highlights";
import { deleteMarks, putMark } from "./db";

/**
 * Keeping one reader's own marks on their own device.
 *
 * The bulk load and its write-through live in lib/verseMarks.tsx, beside the
 * query, because that is where the app already decided marks are loaded once
 * for every surface. What is here is the other direction: a single highlight
 * or note changing, saved to the device the moment the screen shows it, so
 * that a reader who highlights a verse in a tunnel and closes the app finds
 * the highlight there when they open it again — before the queue has had any
 * chance to reach the server.
 *
 * Fire and forget, all of it. None of these can fail in a way worth telling
 * anybody about: the screen is already correct, the queue is already carrying
 * the change, and the worst case is one more journey where a mark needs a
 * network to reappear.
 */

export function rememberHighlights(rows: Highlight[]): Promise<unknown> {
  return Promise.all(
    rows.map((h) =>
      putMark({
        id: String(h.id),
        kind: "highlight",
        chapterKey: `${h.book}|${h.chapter}`,
        row: h as unknown as Record<string, unknown>
      })
    )
  ).catch(() => undefined);
}

export function rememberNotes(rows: VerseNote[]): Promise<unknown> {
  return Promise.all(
    rows.map((n) =>
      putMark({
        id: String(n.id),
        kind: "note",
        chapterKey: `${n.book}|${n.chapter}`,
        row: n as unknown as Record<string, unknown>
      })
    )
  ).catch(() => undefined);
}

export function forgetMarks(ids: string[]): Promise<unknown> {
  return deleteMarks(ids).catch(() => undefined);
}

/**
 * True when PostgREST didn't answer because there was nothing to answer
 * over.
 *
 * supabase-js hands a dead network back in the same `error` slot it uses for
 * a Postgres complaint, so the two have to be told apart by hand. A real
 * database error carries a `code`; a network failure is a TypeError whose
 * message is whatever the browser happens to call it — "Failed to fetch" in
 * Chrome, "Load failed" in Safari, "NetworkError when attempting to fetch a
 * resource" in Firefox.
 *
 * This distinction is load-bearing. Get it wrong towards "database error" and
 * an offline reader watches their highlight vanish off the page with a
 * meaningless message; get it wrong towards "network" and a genuine refusal
 * is silently queued for ever. One place decides it, so both readings of it
 * are the same reading.
 */
export function isNetworkFailure(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code) return false;
  return /fetch|network|load failed/i.test(error.message ?? "");
}
