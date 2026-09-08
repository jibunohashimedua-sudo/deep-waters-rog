/**
 * One place where every user-input length cap lives.
 *
 * Postgres text columns are unbounded, so every write path has to hold the
 * line itself. Every API route and every client insert that touches user
 * input reaches in here rather than sprinkling magic numbers across the
 * codebase — a limit that lives in one file can be argued with; a limit
 * duplicated in nine spots can only rot.
 *
 * Values were picked in the stress audit (STRESS_AUDIT.md) — long enough
 * for real writing, short enough that a paste doesn't blow up a card.
 */

export const REFLECTION_MAX = 5000;
export const VERSE_REF_MAX = 120;
export const VERSE_TEXT_MAX = 2000;
export const PRAYER_BODY_MAX = 2000;
export const PRAYER_NOTE_MAX = 1000;
export const COMMENT_MAX = 1000;
export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 2000;
export const COHORT_NAME_MAX = 60;
export const COHORT_DESCRIPTION_MAX = 240;
export const COHORT_WELCOME_MAX = 500;
export const VERSE_NOTE_MAX = 2000;
export const PROFILE_NAME_MAX = 60;
export const PROFILE_BIO_MAX = 160;
export const TESTIMONY_MAX = 1500;
/** A pastoral care note. Long enough for what was said on a phone call,
    short enough that the log stays scannable. */
export const CARE_NOTE_MAX = 2000;

/**
 * Trim whitespace and truncate to `max` characters. Returns `null` when the
 * result is empty, so callers can distinguish "not provided" from "actually
 * blank". `undefined` and `null` inputs come back as `null`.
 */
export function capText(
  s: string | null | undefined,
  max: number
): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
