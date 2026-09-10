"use client";
import { createClient } from "@/lib/supabase/client";
import {
  queueAll,
  queueCount,
  queueDelete,
  queuePush,
  queueUpdate,
  type QueueItem
} from "./db";
import { isOnline, reportOffline, reportOnline } from "./useOnline";

/**
 * Writes made with no signal, and getting them where they were going.
 *
 * The rule this file exists to keep is one sentence long: **nothing a reader
 * wrote is ever lost, and nothing is ever silently dropped.** A note typed
 * on the Piccadilly line is in IndexedDB before the reader's thumb leaves
 * the button, and it stays there until the server has said yes. If the
 * server says no for a real reason — a day that has not arrived, a note over
 * the length cap — the item is *kept*, marked with the reason, and shown to
 * the reader. It is never thrown away to tidy up the queue.
 *
 * REPLAYED IN ORDER, OLDEST FIRST, ONE AT A TIME. The store's key is
 * auto-incrementing, so insertion order is key order and `getAll()` is
 * already sorted. Serial rather than parallel because these are not
 * independent: a note added and then edited has to land in that order, and a
 * highlight added and then removed must not race.
 *
 * A DUPLICATE IS SUCCESS. Every kind below is safe to send twice, and each
 * one says how. That is not politeness, it is the only way a queue can be
 * retried at all — a reply lost on the way back is indistinguishable from a
 * request that never arrived, so every replay has to assume it might be the
 * second one.
 *
 * WHY NOT BACKGROUND SYNC. The Background Sync API would replay these
 * without the app being open, which sounds better and is worse here: it
 * would put the writes somewhere the reader cannot see, and the brief asks
 * for the opposite — "show the user what is waiting to sync". It is also
 * unsupported in Safari, which is most of this congregation's phones. So the
 * queue is the app's, in the app's own storage, replayed when the app is
 * running and visible.
 */

export type QueueKind =
  | "chapter-read"
  | "highlight-add"
  | "highlight-remove"
  | "verse-note-add"
  | "verse-note-edit"
  | "verse-note-remove"
  | "reflection";

/** A real uuid, so a queued row can carry its final id from the moment it
    is written. That is what lets a highlight made offline be removed offline,
    and what makes every replay below safe to repeat. */
export function newId(): string {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  // Old WebKit. Same shape, same uniqueness for this purpose.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ------------------------------------------------------------- the listeners

type Snapshot = { pending: number; blocked: number };

const listeners = new Set<(s: Snapshot) => void>();
let snapshot: Snapshot = { pending: 0, blocked: 0 };

export function subscribeQueue(fn: (s: Snapshot) => void): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => listeners.delete(fn);
}

export function queueSnapshot(): Snapshot {
  return snapshot;
}

async function refreshSnapshot(): Promise<void> {
  const items = await queueAll();
  snapshot = {
    pending: items.filter((i) => !i.blocked).length,
    blocked: items.filter((i) => i.blocked).length
  };
  for (const l of listeners) l(snapshot);
}

// ---------------------------------------------------------------- enqueueing

/**
 * Put a write in the queue and try it straight away if there is signal.
 *
 * Callers use this the same way whether they are online or not, which is the
 * point: the reader's screen already shows the change, and this is the only
 * thing standing between that and the database. There is no separate
 * "online" path to keep in step.
 */
export async function enqueue(
  kind: QueueKind,
  payload: Record<string, unknown>
): Promise<void> {
  await queuePush({ kind, payload, at: Date.now(), tries: 0 });
  await refreshSnapshot();
  if (isOnline()) void replayQueue();
}

/**
 * Take a queued write back out again.
 *
 * One caller: a highlight made offline and then removed offline. Sending an
 * insert followed by a delete would work, but it is two round trips to
 * describe something that never happened, and if the connection returns
 * between the two the reader would see the highlight flash back onto the
 * page. Cancelling the insert is the honest description of what the reader
 * actually did.
 *
 * Returns the ids it managed to cancel.
 */
export async function cancelQueuedHighlights(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  const cancelled: string[] = [];
  for (const item of await queueAll()) {
    if (item.kind !== "highlight-add" || item.seq == null) continue;
    const rows = (item.payload.rows as { id: string }[] | undefined) ?? [];
    const keep = rows.filter((r) => !wanted.has(r.id));
    if (keep.length === rows.length) continue;
    for (const r of rows) if (wanted.has(r.id)) cancelled.push(r.id);
    if (keep.length === 0) await queueDelete(item.seq);
    else await queueUpdate({ ...item, payload: { ...item.payload, rows: keep } });
  }
  if (cancelled.length > 0) await refreshSnapshot();
  return cancelled;
}

// ------------------------------------------------------------------ replaying

/** What one attempt at one item came to. */
type Outcome =
  | { done: true }
  /** The network, not the server. Stop the whole run and keep everything. */
  | { retry: true }
  /** The server, and it meant it. Keep the item, show the reason. */
  | { blocked: string };

let running = false;

/**
 * Send everything waiting, oldest first.
 *
 * Guarded against re-entry: the `online` event, a tab becoming visible and a
 * fresh enqueue can all arrive within the same second, and three replays of
 * the same queue racing each other is how a note gets written twice.
 */
export async function replayQueue(): Promise<Snapshot> {
  if (running) return snapshot;
  running = true;
  try {
    const supabase = createClient();
    for (const item of await queueAll()) {
      if (item.seq == null) continue;
      // A blocked item has already been answered by the server. Retrying it
      // on every reconnection would be pestering a server that has made its
      // position clear, and the reader has been told.
      if (item.blocked) continue;

      let outcome: Outcome;
      try {
        outcome = await send(supabase, item);
      } catch {
        outcome = { retry: true };
      }

      if ("done" in outcome) {
        await queueDelete(item.seq);
        continue;
      }
      if ("blocked" in outcome) {
        await queueUpdate({ ...item, tries: item.tries + 1, blocked: outcome.blocked });
        continue;
      }
      // Network. Everything after this one would fail the same way, and
      // order matters, so stop here and keep the queue as it is.
      await queueUpdate({ ...item, tries: item.tries + 1 });
      break;
    }
  } finally {
    running = false;
    await refreshSnapshot();
  }
  return snapshot;
}

type Supa = ReturnType<typeof createClient>;

async function send(supabase: Supa, item: QueueItem): Promise<Outcome> {
  const p = item.payload;
  switch (item.kind as QueueKind) {
    case "chapter-read":
      // Already idempotent at the endpoint: mode "mark" can only ever add,
      // and a unique violation there is treated as success. See
      // app/api/chapter-read/route.ts.
      return post("/api/chapter-read", p);

    case "verse-note-add":
      // Carries its own id, so a second attempt collides with the primary
      // key and the endpoint hands back the note that is already there.
      return post("/api/verse-note", p);

    case "verse-note-edit":
      // An update to a fixed body. Writing it twice writes the same thing.
      return patch("/api/verse-note", p);

    case "reflection":
      // Upserts on (user_id, day_number). Naturally repeatable.
      return post("/api/complete", p);

    case "highlight-add": {
      const rows = (p.rows as Record<string, unknown>[] | undefined) ?? [];
      if (rows.length === 0) return { done: true };
      const { error } = await supabase.from("highlights").insert(rows);
      if (!error) {
        reportOnline();
        return { done: true };
      }
      return fromPostgrest(error);
    }

    case "highlight-remove": {
      const ids = (p.ids as string[] | undefined) ?? [];
      if (ids.length === 0) return { done: true };
      // Deleting a row that is already gone is not an error in PostgREST —
      // it removes nothing and says so — which is exactly the answer we want
      // from a repeated attempt.
      const { error } = await supabase.from("highlights").delete().in("id", ids);
      if (!error) {
        reportOnline();
        return { done: true };
      }
      return fromPostgrest(error);
    }

    case "verse-note-remove": {
      const id = p.id as string;
      if (!id) return { done: true };
      const { error } = await supabase.from("verse_notes").delete().eq("id", id);
      if (!error) {
        reportOnline();
        return { done: true };
      }
      return fromPostgrest(error);
    }

    default:
      // A kind written by a newer build than this one. Keeping it and saying
      // so is better than deleting something we do not understand.
      return { blocked: "This app version doesn't know how to send that yet." };
  }
}

/** A duplicate is success. Everything else that is not the network is the
    server having decided, and the reader deserves to be told. */
function fromPostgrest(error: { code?: string; message?: string }): Outcome {
  if (error.code === "23505") return { done: true };
  const message = error.message ?? "";
  // supabase-js turns a dead network into a TypeError with this text rather
  // than a Postgres code, so it is the one thing to spot before giving up.
  if (!error.code && /fetch|network|load failed/i.test(message)) {
    reportOffline();
    return { retry: true };
  }
  return { blocked: friendly(message) };
}

async function post(url: string, body: unknown): Promise<Outcome> {
  return sendJson(url, "POST", body);
}
async function patch(url: string, body: unknown): Promise<Outcome> {
  return sendJson(url, "PATCH", body);
}

async function sendJson(url: string, method: string, body: unknown): Promise<Outcome> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    reportOffline();
    return { retry: true };
  }
  reportOnline();

  if (res.ok) return { done: true };

  // A 5xx is the server having a bad moment, not a verdict. Worth trying
  // again later. So is a 401, which on a phone that has been asleep usually
  // means the session needs refreshing rather than that the reader is out.
  if (res.status >= 500 || res.status === 401) return { retry: true };

  let message = "";
  try {
    const json = await res.json();
    message = typeof json?.error === "string" ? json.error : "";
  } catch {
    /* Not JSON. The status is all we have. */
  }
  return { blocked: friendly(message) };
}

function friendly(message: string): string {
  if (!message) return "The server wouldn't accept this one.";
  if (/hasn't arrived yet/i.test(message)) return "That day hadn't arrived yet.";
  if (/too_long|length/i.test(message)) return "That was too long to save.";
  if (/unauthorized|not signed in/i.test(message)) return "You were signed out.";
  return message;
}

// ------------------------------------------------------------------- starting

let started = false;

/**
 * Watch for the moments worth trying again.
 *
 * Coming back online is the obvious one. The other two matter more in
 * practice: a phone that has been in a pocket wakes on `visibilitychange`
 * with the radio already back, and a reader who opens the app after a train
 * journey gets the run on mount. `navigator.onLine` flipping is not
 * something to rely on alone — on iOS it is late, and sometimes wrong.
 */
export function startQueue(): () => void {
  void refreshSnapshot();
  if (started) return () => {};
  started = true;

  const attempt = () => {
    if (document.visibilityState !== "visible") return;
    void replayQueue();
  };

  window.addEventListener("online", attempt);
  document.addEventListener("visibilitychange", attempt);
  attempt();

  return () => {
    window.removeEventListener("online", attempt);
    document.removeEventListener("visibilitychange", attempt);
    started = false;
  };
}

/** Everything still waiting, for the screen that lists it. */
export async function pendingItems(): Promise<QueueItem[]> {
  return queueAll();
}

export async function pendingCount(): Promise<number> {
  return queueCount();
}

/** Let go of one the server refused. The only way anything leaves this queue
    unsent, and it takes a deliberate tap from the reader to do it. */
export async function discardBlocked(seq: number): Promise<void> {
  await queueDelete(seq);
  await refreshSnapshot();
}
