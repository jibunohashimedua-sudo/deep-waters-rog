"use client";
import { kvGet, kvSet } from "./db";

/**
 * The last thing the community screens showed, kept so they can be read
 * again with no signal.
 *
 * This is the one part of offline that trades something away, and it is
 * worth being exact about what.
 *
 * THE PROMISE THAT CANNOT BE FULLY KEPT. Private access is enforced in the
 * database: `community_feed` and `leaderboard` run through `can_see_user()`,
 * so what arrives here has already been filtered for this reader. A cached
 * copy therefore contains only people the server was willing to show them at
 * the moment it was written. What a cache cannot do is find out that
 * somebody went private *afterwards* — a phone with no connection cannot be
 * told anything. So there is a window, and these four things close it as far
 * as it can be closed:
 *
 *   1. REPLACED WHOLE, never merged. Every successful load overwrites the
 *      stored copy entirely. A member who has gone private is gone from the
 *      cache the first moment the app has any signal at all — not patched
 *      out, not filtered on the way out, simply not in the new copy.
 *   2. EXPIRED AT 24 HOURS. Older than that and it is treated as absent, so
 *      the window has a hard ceiling rather than lasting as long as the
 *      phone does.
 *   3. DISPLAY TEXT ONLY. What is stored is the handful of strings that
 *      were on the screen — a name and a body. No user ids, no profile
 *      rows, no avatars, no cohort membership, nothing joinable. A stale
 *      copy can show an out-of-date sentence; it cannot be a directory.
 *   4. DELETED ON SIGN OUT, and when the store turns out to belong to
 *      somebody else.
 *
 * The alternative was not caching these screens at all, which keeps the
 * promise absolutely and costs the read-only offline feed. That was put to
 * the pastor and this is the option he chose, knowing the residual risk.
 *
 * Nothing here is ever used while there is a connection. Online, every one
 * of these screens queries as it always has.
 */

/** Older than this and the stored copy is treated as though it were not
    there. A day is long enough to cover a commute, a flight and a night,
    and short enough that a stale name cannot follow somebody around. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ViewKind = "community" | "prayer" | "notifications";

/** One row, reduced to what was on the screen. See point 3 above: the
    shape is this narrow on purpose. */
export type CachedLine = { who?: string; text: string };

export type CachedView = { lines: CachedLine[]; at: number };

const keyOf = (kind: ViewKind) => `view:${kind}`;

/** How many rows to keep. The screens themselves cap at 100; this is the
    same ceiling, so the cache can never be larger than the thing it is a
    copy of. */
const MAX_LINES = 100;

/**
 * Keep what is on screen now.
 *
 * Called only after a query that actually succeeded — a failed load must
 * never be allowed to write an empty list over a good copy, which would turn
 * one moment of bad signal into a permanently blank offline feed.
 */
export async function rememberView(kind: ViewKind, lines: CachedLine[]): Promise<void> {
  await kvSet<CachedView>(keyOf(kind), {
    lines: lines.slice(0, MAX_LINES).map((l) => ({
      // Trimmed on the way in as well as the way out. A reflection is capped
      // server-side, but the cache should not be the place that assumption
      // is load-bearing.
      who: l.who ? String(l.who).slice(0, 80) : undefined,
      text: String(l.text ?? "").slice(0, 2000)
    })),
    at: Date.now()
  });
}

export async function cachedView(kind: ViewKind): Promise<CachedView | null> {
  const hit = await kvGet<CachedView>(keyOf(kind));
  if (!hit) return null;
  if (Date.now() - hit.at > MAX_AGE_MS) return null;
  return hit;
}
