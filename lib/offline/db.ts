"use client";

/**
 * Everything the app keeps on the phone so it can be read without signal.
 *
 * One IndexedDB database, four stores, and a deliberately small surface:
 * every function here either resolves with an answer or resolves with
 * nothing. None of them reject. That is the whole design rule — offline
 * storage is a convenience layer under a working app, and a reader must
 * never lose a chapter, a note or a screen because a private-mode browser
 * refused to open a database. Safari in Private Browsing, a phone with no
 * space left, a locked-down enterprise profile: all of them fall through to
 * "nothing cached", which is exactly how the app behaved before this file
 * existed.
 *
 * Written by hand rather than with `idb` for one reason: package.json is
 * untouched by this pass. The wrapper below is thirty lines and does the
 * three things we need.
 *
 * WHAT IS DELIBERATELY NOT HERE: anything belonging to somebody else. The
 * chapters are scripture, the marks and progress are the signed-in reader's
 * own, and the cached community views hold only what the server was willing
 * to show that reader when it sent them. See purgeOffline() and lib/offline
 * /session.ts for the other half of that promise.
 */

const DB_NAME = "deep-waters";
const DB_VERSION = 1;

/** Scripture, keyed by translation + book + chapter. */
export const CHAPTERS = "chapters";
/** Highlights and verse notes, keyed by their row id. */
export const MARKS = "marks";
/** Everything small and singular — preferences, progress, cached views. */
export const KV = "kv";
/** Writes made with no signal, waiting their turn. */
export const QUEUE = "queue";

export type ChapterRow = {
  /** `bibleId|bookSlug|chapter` — so two panes in two translations are two
      independent rows and neither can evict the other. */
  key: string;
  bibleId: string;
  bookSlug: string;
  bookName: string;
  chapter: number;
  reference: string;
  html: string;
  resolvedId: string;
  fallbackNote: string | null;
  /** "read" is a chapter the reader opened; "download" came from the bulk
      download. Only the second is removed by "Delete the download". */
  source: "read" | "download";
  at: number;
};

export type MarkRow = {
  id: string;
  kind: "highlight" | "note";
  /** `${book}|${chapter}`, so a reader can ask for one chapter's marks. */
  chapterKey: string;
  row: Record<string, unknown>;
};

export type QueueItem = {
  seq?: number;
  kind: string;
  payload: Record<string, unknown>;
  at: number;
  tries: number;
  /** Set when the server refused for a real reason rather than a missing
      network. The item is kept and shown, never dropped. */
  blocked?: string;
};

export const chapterKey = (bibleId: string, bookSlug: string, chapter: number) =>
  `${bibleId}|${bookSlug}|${chapter}`;

// ----------------------------------------------------------------- opening

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** True when this browser can store anything at all. Server rendering and
    Safari's stricter private modes both land here. */
export function storageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!storageAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const done = (v: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      done(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAPTERS)) {
        const s = db.createObjectStore(CHAPTERS, { keyPath: "key" });
        s.createIndex("source", "source", { unique: false });
      }
      if (!db.objectStoreNames.contains(MARKS)) {
        const s = db.createObjectStore(MARKS, { keyPath: "id" });
        s.createIndex("chapterKey", "chapterKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(KV)) {
        db.createObjectStore(KV, { keyPath: "k" });
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: "seq", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab asking for a newer version, or a purge deleting the
      // database underneath us. Close rather than hold the upgrade off.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      done(db);
    };
    request.onerror = () => done(null);
    request.onblocked = () => done(null);

    // A database that never answers is the same as no database. Without
    // this, a blocked open in Safari leaves every caller awaiting for ever
    // and the reading surface never draws.
    setTimeout(() => done(null), 3000);
  });

  return dbPromise;
}

/** Run one transaction. Resolves with the result, or with `fallback` if
    anything at all went wrong. Never rejects. */
function tx<T>(
  store: string | string[],
  mode: IDBTransactionMode,
  body: (t: IDBTransaction) => Promise<T> | T,
  fallback: T
): Promise<T> {
  return openDb().then((db) => {
    if (!db) return fallback;
    return new Promise<T>((resolve) => {
      let value: T = fallback;
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(store, mode);
      } catch {
        resolve(fallback);
        return;
      }
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => resolve(fallback);
      transaction.onabort = () => resolve(fallback);
      Promise.resolve(body(transaction))
        .then((v) => {
          value = v;
        })
        .catch(() => {
          // Leave `value` at the fallback and let the transaction finish.
        });
    });
  });
}

/** One IDBRequest as a promise that resolves to null rather than throwing. */
function req<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * True when the browser refused the write because there is no room.
 *
 * Named separately because it is the one storage failure worth telling the
 * reader about: everything else is "we couldn't cache that", which is not
 * news, but "your phone is full" explains why the download stopped.
 */
export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null;
  return (
    e?.name === "QuotaExceededError" ||
    e?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e?.code === 22
  );
}

// ---------------------------------------------------------------- chapters

export async function putChapter(row: ChapterRow): Promise<boolean> {
  return tx(
    CHAPTERS,
    "readwrite",
    async (t) => {
      const existing = await req(t.objectStore(CHAPTERS).get(row.key));
      // A chapter the reader actually opened outranks one the bulk download
      // put there, so deleting the download never takes away a chapter they
      // have read. Upgrading only ever goes download → read.
      const source =
        (existing as ChapterRow | null)?.source === "read" ? "read" : row.source;
      t.objectStore(CHAPTERS).put({ ...row, source });
      return true;
    },
    false
  );
}

/** Several at once, in one transaction — the download writes 25 a time. */
export async function putChapters(rows: ChapterRow[]): Promise<boolean> {
  if (rows.length === 0) return true;
  return tx(
    CHAPTERS,
    "readwrite",
    (t) => {
      const store = t.objectStore(CHAPTERS);
      for (const row of rows) store.put(row);
      return true;
    },
    false
  );
}

export async function getChapter(
  bibleId: string,
  bookSlug: string,
  chapter: number
): Promise<ChapterRow | null> {
  return tx(
    CHAPTERS,
    "readonly",
    (t) =>
      req(t.objectStore(CHAPTERS).get(chapterKey(bibleId, bookSlug, chapter))) as Promise<
        ChapterRow | null
      >,
    null
  );
}

export async function countChapters(): Promise<number> {
  return tx(CHAPTERS, "readonly", async (t) => (await req(t.objectStore(CHAPTERS).count())) ?? 0, 0);
}

/** Remove only what the bulk download put there. Chapters the reader opened
    for themselves stay, because they did not ask to lose those. */
export async function deleteDownloadedChapters(): Promise<number> {
  return tx(
    CHAPTERS,
    "readwrite",
    async (t) => {
      const index = t.objectStore(CHAPTERS).index("source");
      const keys = (await req(index.getAllKeys(IDBKeyRange.only("download")))) ?? [];
      for (const k of keys) t.objectStore(CHAPTERS).delete(k as IDBValidKey);
      return keys.length;
    },
    0
  );
}

// ------------------------------------------------------------------- marks

/** Replace the stored marks for a set of chapters with what the server just
    said. Replace, never merge: a highlight removed on another device has to
    disappear here too, and merging would resurrect it. */
export async function putMarksForChapters(
  chapterKeys: string[],
  rows: MarkRow[]
): Promise<boolean> {
  return tx(
    MARKS,
    "readwrite",
    async (t) => {
      const store = t.objectStore(MARKS);
      const index = store.index("chapterKey");
      for (const ck of chapterKeys) {
        const stale = (await req(index.getAllKeys(IDBKeyRange.only(ck)))) ?? [];
        for (const k of stale) store.delete(k as IDBValidKey);
      }
      for (const row of rows) store.put(row);
      return true;
    },
    false
  );
}

export async function getMarksForChapters(chapterKeys: string[]): Promise<MarkRow[]> {
  return tx(
    MARKS,
    "readonly",
    async (t) => {
      const index = t.objectStore(MARKS).index("chapterKey");
      const out: MarkRow[] = [];
      for (const ck of chapterKeys) {
        const rows = (await req(index.getAll(IDBKeyRange.only(ck)))) ?? [];
        out.push(...(rows as MarkRow[]));
      }
      return out;
    },
    []
  );
}

/** One mark, written or removed locally so the screen is right before the
    network agrees. The queue carries the same change to the server. */
export async function putMark(row: MarkRow): Promise<boolean> {
  return tx(MARKS, "readwrite", (t) => {
    t.objectStore(MARKS).put(row);
    return true;
  }, false);
}

export async function deleteMarks(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  return tx(MARKS, "readwrite", (t) => {
    for (const id of ids) t.objectStore(MARKS).delete(id);
    return true;
  }, false);
}

// ---------------------------------------------------------------------- kv

export async function kvGet<T>(key: string): Promise<T | null> {
  return tx(
    KV,
    "readonly",
    async (t) => {
      const hit = (await req(t.objectStore(KV).get(key))) as { v: T } | null;
      return hit ? hit.v : null;
    },
    null
  );
}

export async function kvSet<T>(key: string, value: T): Promise<boolean> {
  return tx(KV, "readwrite", (t) => {
    t.objectStore(KV).put({ k: key, v: value, at: Date.now() });
    return true;
  }, false);
}

export async function kvDelete(key: string): Promise<boolean> {
  return tx(KV, "readwrite", (t) => {
    t.objectStore(KV).delete(key);
    return true;
  }, false);
}

// ------------------------------------------------------------------- queue

export async function queuePush(item: Omit<QueueItem, "seq">): Promise<number | null> {
  return tx(
    QUEUE,
    "readwrite",
    async (t) => (await req(t.objectStore(QUEUE).add(item))) as number | null,
    null
  );
}

/** Oldest first — the store's key is auto-incrementing, so insertion order
    and key order are the same thing and getAll() is already sorted. */
export async function queueAll(): Promise<QueueItem[]> {
  return tx(
    QUEUE,
    "readonly",
    async (t) => ((await req(t.objectStore(QUEUE).getAll())) ?? []) as QueueItem[],
    []
  );
}

export async function queueCount(): Promise<number> {
  return tx(QUEUE, "readonly", async (t) => (await req(t.objectStore(QUEUE).count())) ?? 0, 0);
}

export async function queueDelete(seq: number): Promise<boolean> {
  return tx(QUEUE, "readwrite", (t) => {
    t.objectStore(QUEUE).delete(seq);
    return true;
  }, false);
}

export async function queueUpdate(item: QueueItem): Promise<boolean> {
  if (item.seq == null) return false;
  return tx(QUEUE, "readwrite", (t) => {
    t.objectStore(QUEUE).put(item);
    return true;
  }, false);
}

// ------------------------------------------------------------------- purge

/**
 * Delete the whole database.
 *
 * Called on sign out, and on arriving as a different person. Deliberately
 * total: the brief asks for everything to go, and a partial clear is exactly
 * the kind of thing that leaves one forgotten store holding somebody else's
 * notes. The cost is that a downloaded Bible has to be downloaded again
 * after signing out, which is the right way round.
 */
export function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    if (!storageAvailable()) return resolve();
    // Drop our handle first, or the delete sits blocked behind it.
    const held = dbPromise;
    dbPromise = null;
    Promise.resolve(held)
      .then((db) => db?.close())
      .catch(() => {})
      .then(() => {
        let request: IDBOpenDBRequest;
        try {
          request = indexedDB.deleteDatabase(DB_NAME);
        } catch {
          return resolve();
        }
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
        setTimeout(resolve, 3000);
      });
  });
}

/** How much room the browser will give us, and how much is used. Both are
    approximations the browser is allowed to fudge; they are shown as "about". */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator?.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    if (typeof e.usage !== "number" || typeof e.quota !== "number") return null;
    return { usage: e.usage, quota: e.quota };
  } catch {
    return null;
  }
}
