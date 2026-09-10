// API.Bible wrapper.
//
// Chapter text is cached in Supabase (public.bible_cache), keyed by
// translation + book + chapter, so one person opening John 3 warms it for
// everybody. That matters: the plan touches a fixed ~1200 chapters, but free
// browsing can reach any of 31,000+ verses in any of 26 translations, and the
// key is rate limited. A per-process Map sits in front as a second-level
// cache so repeat renders in the same lambda skip the network entirely.
//
// Everything here returns an outcome rather than throwing or returning null,
// so callers can tell "we hit the rate limit" apart from "that chapter isn't
// in this translation" and say something useful either way.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BIBLE_ID } from "./translations";
import { countVersesInHtml } from "./verseParse";
import { fetchWithTimeout, isTimeoutError } from "./fetchWithTimeout";

/** How long to wait on API.Bible before giving up. The reader gets an
    empty state, not a spinning page. */
const API_BIBLE_TIMEOUT_MS = 6000;

/** Guards against caching non-scripture (a maintenance HTML page, an
    ad-driven error page) as if it were a chapter. Verse markers in
    API.Bible's HTML look like `<span class="v">1</span>`; every real
    chapter carries at least one. */
const VERSE_MARKER_RE = /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>\s*\d+\s*<\/span>/;

const BASE = "https://api.scripture.api.bible/v1";

/** How long a cached chapter stays good. Scripture doesn't change; this is
    only here so a bad fetch can't be cached for ever. */
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export type ChapterText = {
  reference: string;
  content: string;
};

export type ChapterFailure =
  | "rate-limit"   // API.Bible said slow down
  | "missing"      // that chapter isn't in this translation
  | "unavailable"  // network died, API errored, anything else
  | "no-key";      // API_BIBLE_KEY not configured

export type ChapterOutcome =
  | { ok: true; chapter: ChapterText }
  | { ok: false; kind: ChapterFailure };

/** Reader-facing copy for a failure. Never shows an HTTP code. */
export function chapterErrorMessage(kind: ChapterFailure): string {
  switch (kind) {
    case "rate-limit":
      return "We've hit today's limit for loading scripture. It'll come back on its own shortly — your reading and notes are all safe.";
    case "missing":
      return "We couldn't find that chapter. Try picking it again from the book list.";
    case "no-key":
      return "Scripture isn't configured on this deployment yet. Tell an admin.";
    default:
      return "That chapter wouldn't load just now. Check your connection and try again.";
  }
}

// ---------------------------------------------------------------- caches

const memoryCache = new Map<string, ChapterText>();

/**
 * In-flight requests, keyed by cache id. When two identical calls arrive at
 * once — /read fetching 13 chapters in parallel, or two readers opening the
 * same page seconds apart in the same lambda — both used to sail past the
 * memory cache and both hit API.Bible before either wrote back. That's a
 * wasted round trip and, on cold cache with a hot chapter, two-for-one
 * against the daily rate limit. Sharing the promise collapses concurrent
 * misses onto one fetch. The entry is dropped as soon as it resolves, so a
 * later miss reruns the fetch rather than clinging to a stale promise.
 */
const inflight = new Map<string, Promise<ChapterOutcome>>();

const cacheKey = (bibleId: string, book: string, chapter: number) =>
  `${bibleId}|${book}|${chapter}`;

/** Set once the shared cache turns out not to exist, so we stop asking. The
    app works fine without it — it just calls API.Bible more often. */
let sharedCacheUnavailable = false;

// Untyped on purpose: there are no generated DB types in this project, and
// the two columns we touch are checked by hand below.
let serviceClient: SupabaseClient<any, any, any> | null = null;
function getServiceClient(): SupabaseClient<any, any, any> | null {
  if (serviceClient) return serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return serviceClient;
}

/** True when the error means "the migration hasn't been run yet". */
function isMissingTable(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("could not find the table") || m.includes("does not exist");
}

async function readSharedCache(
  bibleId: string,
  book: string,
  chapter: number
): Promise<ChapterText | null> {
  if (sharedCacheUnavailable) return null;
  const sb = getServiceClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("bible_cache")
    .select("reference, content, fetched_at")
    .eq("bible_id", bibleId)
    .eq("book", book)
    .eq("chapter", chapter)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) {
      sharedCacheUnavailable = true;
      console.warn(
        "[deep-waters] bible_cache table not found — run supabase/migrations/2026_09_07_bible_cache_and_translations.sql. Falling back to live fetches."
      );
    } else {
      console.error("[deep-waters] bible_cache read:", error.message);
    }
    return null;
  }
  if (!data) return null;
  const age = Date.now() - new Date(data.fetched_at as string).getTime();
  if (age > CACHE_TTL_MS) return null;
  return { reference: data.reference as string, content: data.content as string };
}

async function writeSharedCache(
  bibleId: string,
  book: string,
  chapter: number,
  text: ChapterText
): Promise<void> {
  if (sharedCacheUnavailable) return;
  const sb = getServiceClient();
  if (!sb) return;
  const { error } = await sb.from("bible_cache").upsert(
    {
      bible_id: bibleId,
      book,
      chapter,
      reference: text.reference,
      content: text.content,
      fetched_at: new Date().toISOString()
    },
    { onConflict: "bible_id,book,chapter" }
  );
  if (error) {
    if (isMissingTable(error.message)) sharedCacheUnavailable = true;
    // A cache write failing must never cost the reader their chapter, so
    // this is logged and swallowed rather than surfaced.
    else console.error("[deep-waters] bible_cache write:", error.message);
  }
}

/**
 * Many chapters out of the shared cache in one query, and nothing else.
 *
 * Added for the offline download, which asks for chapters twenty-five at a
 * time. Going through fetchChapter for each of those would be twenty-five
 * separate `bible_cache` round trips to answer one batch, and on the warm
 * cache — which is most of the plan, most of the time — those round trips
 * are the entire cost of the request.
 *
 * Deliberately cache-only. It never calls API.Bible and never writes
 * anything: the caller decides, against its own budget, whether a miss is
 * worth spending a live fetch on, and fetchChapter still owns every fetch
 * and every write. This is a faster way to ask the same question of the
 * same table, not a second cache.
 *
 * Returns a map of `book.chapter` → text, holding only what was found.
 */
export async function readCachedChapters(
  bibleId: string,
  refs: { book: string; chapter: number }[]
): Promise<Map<string, ChapterText>> {
  const found = new Map<string, ChapterText>();
  if (refs.length === 0) return found;

  // The per-process cache first: a repeated batch in the same lambda, or a
  // chapter already read this invocation, costs nothing.
  const outstanding: { book: string; chapter: number }[] = [];
  for (const ref of refs) {
    const hot = memoryCache.get(cacheKey(bibleId, ref.book, ref.chapter));
    if (hot) found.set(`${ref.book}.${ref.chapter}`, hot);
    else outstanding.push(ref);
  }
  if (outstanding.length === 0 || sharedCacheUnavailable) return found;

  const sb = getServiceClient();
  if (!sb) return found;

  // `in` on both columns rather than a compound filter: PostgREST has no
  // tuple-IN, so this over-fetches the cross product and the check below
  // throws away what wasn't asked for. At twenty-five chapters spanning at
  // most a handful of books that is a small over-read for one round trip
  // instead of twenty-five.
  const books = Array.from(new Set(outstanding.map((r) => r.book)));
  const chapters = Array.from(new Set(outstanding.map((r) => r.chapter)));
  const wanted = new Set(outstanding.map((r) => `${r.book}.${r.chapter}`));

  const { data, error } = await sb
    .from("bible_cache")
    .select("book, chapter, reference, content, fetched_at")
    .eq("bible_id", bibleId)
    .in("book", books)
    .in("chapter", chapters);

  if (error) {
    if (isMissingTable(error.message)) sharedCacheUnavailable = true;
    else console.error("[deep-waters] bible_cache batch read:", error.message);
    return found;
  }

  for (const row of data ?? []) {
    const id = `${row.book}.${row.chapter}`;
    if (!wanted.has(id)) continue;
    const age = Date.now() - new Date(row.fetched_at as string).getTime();
    if (age > CACHE_TTL_MS) continue;
    const text: ChapterText = {
      reference: row.reference as string,
      content: row.content as string
    };
    memoryCache.set(cacheKey(bibleId, row.book as string, row.chapter as number), text);
    found.set(id, text);
  }

  return found;
}

/**
 * How many chapters the whole church has had to fetch live in the last day.
 *
 * This is the budget the offline download spends against, and it is measured
 * rather than tracked: every live fetch writes a row here with a fresh
 * `fetched_at`, so counting recent rows *is* counting recent API.Bible
 * calls. No new table, no counter to keep in step, and it caps the thing
 * that actually matters — the shared key — rather than capping each member
 * separately and letting four of them exhaust it between them.
 *
 * Returns null when it cannot be known, which the caller treats as "do not
 * spend": refusing to start a download is recoverable, and running the
 * church out of scripture for the rest of the day is not.
 */
export async function liveFetchesInLastDay(): Promise<number | null> {
  if (sharedCacheUnavailable) return null;
  const sb = getServiceClient();
  if (!sb) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await sb
    .from("bible_cache")
    .select("*", { count: "exact", head: true })
    .gte("fetched_at", since);
  if (error) {
    if (isMissingTable(error.message)) sharedCacheUnavailable = true;
    else console.error("[deep-waters] bible_cache budget count:", error.message);
    return null;
  }
  return count ?? 0;
}

// ---------------------------------------------------------------- fetching

/**
 * One chapter, in one translation. `book` is an API.Bible abbreviation
 * (GEN, 1CO); `chapter` is 1-based.
 */
export async function fetchChapter(
  book: string,
  chapter: number,
  bibleId: string = DEFAULT_BIBLE_ID
): Promise<ChapterOutcome> {
  const key = cacheKey(bibleId, book, chapter);
  const hot = memoryCache.get(key);
  if (hot) return { ok: true, chapter: hot };

  // Coalesce concurrent misses on the same key onto one fetch. The check
  // here happens synchronously after the memory-cache miss, so two callers
  // arriving in the same tick see the same promise even before either has
  // reached readSharedCache.
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = doFetchChapter(book, chapter, bibleId, key).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
}

async function doFetchChapter(
  book: string,
  chapter: number,
  bibleId: string,
  key: string
): Promise<ChapterOutcome> {
  const shared = await readSharedCache(bibleId, book, chapter);
  if (shared) {
    memoryCache.set(key, shared);
    return { ok: true, chapter: shared };
  }

  const apiKey = process.env.API_BIBLE_KEY;
  if (!apiKey) return { ok: false, kind: "no-key" };

  try {
    const res = await fetchWithTimeout(
      `${BASE}/bibles/${bibleId}/chapters/${book}.${chapter}` +
        `?content-type=html&include-verse-numbers=true&include-titles=false&include-notes=false`,
      { headers: { "api-key": apiKey }, cache: "no-store" },
      API_BIBLE_TIMEOUT_MS
    );

    if (res.status === 429) return { ok: false, kind: "rate-limit" };
    if (res.status === 404) return { ok: false, kind: "missing" };
    if (!res.ok) {
      // 403 on this API means the key isn't licensed for that translation,
      // which reads to the person as "not available here".
      if (res.status === 403) return { ok: false, kind: "missing" };
      console.error(`[deep-waters] API.Bible ${res.status} for ${bibleId} ${book}.${chapter}`);
      return { ok: false, kind: "unavailable" };
    }

    const json = await res.json();
    const text: ChapterText = {
      reference: json?.data?.reference ?? `${book} ${chapter}`,
      content: json?.data?.content ?? ""
    };
    if (!text.content) return { ok: false, kind: "missing" };

    // Shape check before caching. A maintenance page or an ad wrapper the
    // upstream returns with a 200 would sail into bible_cache with the 90-day
    // TTL and be served as scripture to every reader for three months. If the
    // response doesn't carry a single verse-number marker, refuse it —
    // don't cache, don't memoize.
    if (!VERSE_MARKER_RE.test(text.content)) {
      console.error(
        `[deep-waters] API.Bible returned non-scripture for ${bibleId} ${book}.${chapter}: ` +
          `length=${text.content.length}, head=${JSON.stringify(text.content.slice(0, 200))}`
      );
      return { ok: false, kind: "unavailable" };
    }

    memoryCache.set(key, text);
    // Don't make the reader wait on the cache write.
    void writeSharedCache(bibleId, book, chapter, text);
    return { ok: true, chapter: text };
  } catch (err: any) {
    if (isTimeoutError(err)) {
      // Deliberate: don't cache a timeout, and don't stall the reader.
      // Same shape the outer code already handles for a network failure —
      // the /read page renders its empty-state line and offers a retry.
      console.error(
        `[deep-waters] API.Bible timeout after ${API_BIBLE_TIMEOUT_MS}ms for ${bibleId} ${book}.${chapter}`
      );
      return { ok: false, kind: "unavailable" };
    }
    console.error("[deep-waters] API.Bible fetch failed:", err?.message ?? err);
    return { ok: false, kind: "unavailable" };
  }
}

/**
 * Several chapters at once, for the daily plan. Fetched together rather than
 * one after another — three chapters in sequence was three round trips of
 * dead time on every /read render.
 *
 * Returns the chapters that loaded plus the first failure, so the page can
 * show what it has and explain what's missing instead of blanking.
 */
export async function fetchChapters(
  chapterIds: string[],
  bibleId: string = DEFAULT_BIBLE_ID
): Promise<{ chapters: (ChapterText | null)[]; failure: ChapterFailure | null }> {
  const results = await Promise.all(
    chapterIds.map((id) => {
      const [book, ch] = id.split(".");
      return fetchChapter(book, Number(ch), bibleId);
    })
  );
  let failure: ChapterFailure | null = null;
  const chapters = results.map((r) => {
    if (r.ok) return r.chapter;
    // Rate limiting is the one worth reporting over anything else.
    if (!failure || r.kind === "rate-limit") failure = r.kind;
    return null;
  });
  return { chapters, failure };
}

/**
 * How many verses are in one chapter.
 *
 * Deliberately derived from the chapter text rather than API.Bible's
 * /chapters/{id}/verses endpoint. That endpoint would be a smaller payload,
 * but it is a second rate-limited call whose result we have nowhere to keep,
 * whereas the chapter itself is already cached in Supabase and very often
 * already warm — the plan alone touches ~1200 chapters. So the common case
 * costs nothing, and the uncommon case warms the cache for the read that is
 * about to follow anyway, since somebody asking for the verse list is on
 * their way into that chapter.
 *
 * Returns null rather than a guess when the chapter can't be loaded; the
 * caller should fall back to opening the chapter at the top.
 */
export async function fetchVerseCount(
  book: string,
  chapter: number,
  bibleId: string = DEFAULT_BIBLE_ID
): Promise<number | null> {
  const outcome = await fetchChapter(book, chapter, bibleId);
  if (!outcome.ok) return null;
  const count = countVersesInHtml(outcome.chapter.content);
  return count > 0 ? count : null;
}
