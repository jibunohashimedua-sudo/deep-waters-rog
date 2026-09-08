/**
 * How long a chapter should take before it counts as read.
 *
 * Ticking chapters by hand is friction, and friction in the wrong place
 * turns a reading plan into an admin task. A chapter records itself
 * instead, on two conditions together: the last verse has been on screen,
 * and the reader has spent a sensible amount of time in the chapter. Each
 * alone is easy to fake by accident — a flick to the bottom is not
 * reading, and neither is leaving a tab open on Genesis 1 all afternoon.
 *
 * The time comes from the chapter's own word count, because Psalm 119 is
 * not Psalm 117 and a single number would be absurd for one of them. It
 * is deliberately a fraction of a full reading: the question is "was this
 * person actually here", not "did they read every word", which is between
 * them and God and not something a web page gets to audit.
 *
 * Every number is named, and nothing else in the app reads them, so they
 * can be tuned here on their own.
 */

/** Average adult reading speed for prose, words per minute. */
export const WORDS_PER_MINUTE = 220;

/** The share of a full read that counts as having been in the chapter. */
export const DWELL_FRACTION = 0.4;

/** Never ask for less than this, however short the chapter. */
export const MIN_DWELL_MS = 15_000;

/** Never ask for more than this, however long it is. */
export const MAX_DWELL_MS = 90_000;

/** Stop counting after this long with no scroll and no touch. */
export const IDLE_AFTER_MS = 60_000;

/**
 * The dwell a chapter of `words` words asks for, in milliseconds.
 *
 * Clamped at both ends: a two-verse chapter still asks for a moment, and
 * Psalm 119 asks for a minute and a half rather than eleven minutes.
 */
export function requiredDwellMs(words: number): number {
  const full = (words / WORDS_PER_MINUTE) * 60_000;
  const asked = full * DWELL_FRACTION;
  return Math.round(Math.min(MAX_DWELL_MS, Math.max(MIN_DWELL_MS, asked)));
}

/**
 * Chapters the reader has un-ticked by hand this session.
 *
 * Unticking is a correction — "no, I haven't read that" — and the tracker
 * marking it again a minute later would be the app arguing with them. It
 * is sessionStorage rather than state because the untick happens on the
 * day view and the tracker runs on the reading screen, and it is
 * deliberately not persisted beyond the session: tomorrow is a fresh
 * start, and a permanent refusal would be a second kind of progress
 * record nobody asked for.
 */
const OVERRIDE_KEY = "dw:unticked";

function readOverrides(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private mode, a quota, a value someone else wrote — none of which
    // is worth failing a reading screen over.
    return [];
  }
}

export const untickKey = (day: number, book: string, chapter: number) =>
  `${day}|${book}|${chapter}`;

export function rememberUntick(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const all = new Set(readOverrides());
    all.add(key);
    sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify([...all]));
  } catch {
    /* see readOverrides */
  }
}

export function forgetUntick(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const all = readOverrides().filter((k) => k !== key);
    sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(all));
  } catch {
    /* see readOverrides */
  }
}

export function wasUnticked(key: string): boolean {
  return readOverrides().includes(key);
}
