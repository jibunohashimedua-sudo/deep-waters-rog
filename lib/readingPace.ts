/**
 * How long a chapter should take before it counts as read.
 *
 * Ticking chapters by hand is friction, and friction in the wrong place
 * turns a reading plan into an admin task. A chapter records itself
 * instead, on three things together: the last verse has been on screen,
 * the reader has spent a sensible amount of time in the chapter, and they
 * have tapped on to the next one. The first two alone are easy to satisfy
 * by accident — a flick to the bottom is not reading, and neither is
 * leaving a tab open on Genesis 1 all afternoon — and the tap alone would
 * be a tick box wearing an arrow. See components/ChapterPager.
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
