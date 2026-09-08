/**
 * A small in-memory cache for list views.
 *
 * The problem it solves: pressing back re-mounts a client component with
 * fresh state, so a feed that starts at `[]` and fetches on mount collapses
 * the page to nothing. The browser then has no height to restore a scroll
 * position into, and you land at the top of a page that visibly rebuilds
 * itself. Server-rendered pages don't have this — their content is in the
 * HTML, the height is right immediately, and restoration just works.
 *
 * Seeding a view from its last known data makes a client-rendered list
 * behave the same way: full height on the first frame, browser restores the
 * scroll, fresh data lands underneath a moment later.
 *
 * Deliberately module scope, not sessionStorage: this is for the life of the
 * tab. A reload should fetch afresh, and none of it is worth persisting.
 */

type Entry = { data: unknown; at: number };

const store = new Map<string, Entry>();

/** Anything older than this is treated as absent, so a long-idle tab refetches. */
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export function readCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > maxAgeMs) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function writeCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}
