"use client";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import {
  chapterKey,
  countChapters,
  deleteDownloadedChapters,
  getChapter,
  isQuotaError,
  kvGet,
  kvSet,
  putChapters,
  storageEstimate,
  type ChapterRow
} from "./db";
import { reportOffline, reportOnline } from "./useOnline";

/**
 * The whole Bible, onto the phone.
 *
 * Deliberately unhurried and deliberately interruptible. Nobody is watching
 * this happen — they turned it on and put the phone in a pocket — so the
 * only things that matter are that it finishes eventually, that it can be
 * stopped, that it picks up where it left off, and that it never costs
 * anybody else their scripture. Speed is not on the list.
 *
 *   BATCHED at twenty-five to a request, because the server pays one auth
 *   check and one cache query per batch rather than per chapter.
 *
 *   PACED with a pause between batches. This is running against a key the
 *   whole church shares and, on a phone, against a radio and a battery.
 *   Steady and invisible beats quick and hot.
 *
 *   RESUMABLE. The position is written after every batch, so a phone that
 *   locks, a tab that closes or a tunnel that arrives loses at most one
 *   batch. Starting again continues rather than restarts.
 *
 *   BUDGETED at the far end. The server refuses to spend the church's daily
 *   API.Bible allowance on one member's download; when it says so, this
 *   stops politely and says it will pick up tomorrow.
 *
 * The list is the whole Bible in canonical order rather than the plan's
 * order, and it comes to nearly the same thing: the ninety-day plan walks
 * every chapter of both testaments, so "download the plan" and "download the
 * Bible" are the same 1,189 chapters. Canonical order is used because a
 * download interrupted halfway then holds a contiguous stretch somebody
 * might actually be reading, rather than half of every book.
 */

/** Chapters per request. Matches MAX_PER_REQUEST in /api/bible/bulk. */
const BATCH = 25;

/** Between batches. Long enough to stay out of the way of anything the
    reader is doing, short enough to finish a Bible in a few minutes on a
    warm cache. */
const PAUSE_MS = 350;

/** After the server says the church's daily allowance is spent. */
const PAUSED_MESSAGE =
  "Paused for today — the church’s daily limit for new scripture has been reached. It’ll pick up on its own tomorrow, and everything already downloaded is ready to read.";

const STATE_KEY = "download";

export type DownloadState = {
  /** Which translation this download is of. Changing translation starts a
      new one rather than continuing into a mixture of two. */
  bibleId: string;
  /** How far through the chapter list, so an interrupted run resumes. */
  index: number;
  done: number;
  total: number;
  status: "idle" | "running" | "paused" | "complete" | "error";
  message: string | null;
  at: number;
};

/** Every chapter of every book, canonical order. 1,189 of them. */
export function allChapters(): { book: string; chapter: number }[] {
  const out: { book: string; chapter: number }[] = [];
  for (const book of BIBLE_BOOKS) {
    for (let c = 1; c <= book.chapters; c++) out.push({ book: book.slug, chapter: c });
  }
  return out;
}

export const TOTAL_CHAPTERS = allChapters().length;

export async function readDownloadState(): Promise<DownloadState | null> {
  return kvGet<DownloadState>(STATE_KEY);
}

async function writeState(state: DownloadState): Promise<void> {
  await kvSet(STATE_KEY, { ...state, at: Date.now() });
}

// --------------------------------------------------------------- the run

/** Set by cancel(), read between batches. A flag rather than an
    AbortController because the thing being stopped is the loop, not the
    request — a batch already in flight has been paid for and its chapters
    are worth keeping. */
let cancelled = false;
let running = false;

export function cancelDownload(): void {
  cancelled = true;
}

export function downloadRunning(): boolean {
  return running;
}

/**
 * Start, or continue.
 *
 * `onProgress` is called after every batch so the bar moves; it is the only
 * thing this reports, because a progress bar that jumps once a minute is a
 * progress bar nobody believes.
 */
export async function runDownload(
  bibleId: string,
  onProgress: (state: DownloadState) => void
): Promise<DownloadState> {
  const chapters = allChapters();

  let state = await readDownloadState();
  // A different translation is a different download. Starting one does not
  // delete the other's chapters — they are keyed by translation and both
  // are perfectly good to read — it just starts counting again.
  if (!state || state.bibleId !== bibleId || state.status === "complete") {
    state = {
      bibleId,
      index: 0,
      done: 0,
      total: chapters.length,
      status: "running",
      message: null,
      at: Date.now()
    };
  }
  state = { ...state, status: "running", message: null, total: chapters.length };

  if (running) return state;
  running = true;
  cancelled = false;
  await writeState(state);
  onProgress(state);

  try {
    while (state.index < chapters.length) {
      if (cancelled) {
        state = { ...state, status: "idle", message: null };
        break;
      }

      const slice = chapters.slice(state.index, state.index + BATCH);

      // Skip what is already here without asking the server. On a second
      // run — or after reading the plan for a fortnight — most of a batch
      // is often already on the device, and there is no reason to fetch a
      // chapter twice or to spend a batch of the church's budget on it.
      const missing: { book: string; chapter: number }[] = [];
      for (const ref of slice) {
        const have = await getChapter(bibleId, ref.book, ref.chapter);
        if (!have) missing.push(ref);
      }

      if (missing.length === 0) {
        state = {
          ...state,
          index: state.index + slice.length,
          done: state.done + slice.length
        };
        await writeState(state);
        onProgress(state);
        continue;
      }

      let json: {
        ok?: boolean;
        paused?: boolean;
        reason?: string;
        chapters?: {
          book: string;
          chapter: number;
          reference: string;
          html: string;
          resolvedId: string;
        }[];
      };
      try {
        const res = await fetch("/api/bible/bulk", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bible: bibleId, chapters: missing })
        });
        reportOnline();
        if (!res.ok) {
          state = {
            ...state,
            status: "error",
            message:
              res.status === 401
                ? "You were signed out. Sign in again and the download will pick up where it stopped."
                : "That didn’t work just now. Try again in a moment — nothing already downloaded is lost."
          };
          break;
        }
        json = await res.json();
      } catch {
        reportOffline();
        state = {
          ...state,
          status: "paused",
          message:
            "Paused — no connection. It’ll pick up when you’re back online, from where it stopped."
        };
        break;
      }

      const rows: ChapterRow[] = [];
      for (const c of json.chapters ?? []) {
        const book = BIBLE_BOOKS.find((b) => b.slug === c.book);
        if (!book) continue;
        rows.push({
          key: chapterKey(bibleId, c.book, c.chapter),
          bibleId,
          bookSlug: c.book,
          bookName: book.name,
          chapter: c.chapter,
          reference: c.reference,
          html: c.html,
          resolvedId: c.resolvedId,
          fallbackNote: null,
          source: "download",
          at: Date.now()
        });
      }

      try {
        const stored = await putChapters(rows);
        if (!stored) throw new Error("write refused");
      } catch (err) {
        // The browser will not take any more. Said plainly, and stopped
        // cleanly: everything written so far is perfectly readable.
        state = {
          ...state,
          status: "error",
          message: isQuotaError(err)
            ? "Your phone is out of space for this, so the download stopped. Everything downloaded so far still works — you can free some space and start it again, or delete the download below."
            : "This device wouldn’t store any more. Everything downloaded so far still works."
        };
        break;
      }

      state = {
        ...state,
        index: state.index + slice.length,
        // Counted as done rather than as stored: a chapter a translation
        // simply doesn't carry will never arrive, and a progress bar that
        // can never reach the end is a bar that looks broken.
        done: state.done + slice.length
      };
      await writeState(state);
      onProgress(state);

      if (json.paused) {
        state = {
          ...state,
          status: "paused",
          message: PAUSED_MESSAGE
        };
        break;
      }

      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }

    if (state.index >= chapters.length && state.status === "running") {
      state = { ...state, status: "complete", message: null, done: chapters.length };
    }
  } finally {
    running = false;
    await writeState(state);
    onProgress(state);
  }

  return state;
}

// ------------------------------------------------------------- housekeeping

/** What is on the device, and what the browser says there is room for. */
export async function downloadSummary(): Promise<{
  chapters: number;
  usage: number | null;
  quota: number | null;
}> {
  const [chapters, estimate] = await Promise.all([countChapters(), storageEstimate()]);
  return {
    chapters,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null
  };
}

/**
 * Remove the download.
 *
 * Only what the download put there. Chapters the reader opened for
 * themselves stay — they did not ask to lose those, and they are what makes
 * the ordinary offline reading work.
 */
export async function deleteDownload(): Promise<number> {
  const removed = await deleteDownloadedChapters();
  await kvSet<DownloadState | null>(STATE_KEY, null);
  return removed;
}

/** "about 4 MB". Approximate on purpose — every number the browser gives
    for storage is an estimate, and a precise-looking figure would be a
    false precision. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  if (mb < 100) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb)} MB`;
}
