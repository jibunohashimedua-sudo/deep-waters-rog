import { normaliseKind, type SermonBlockKind } from "@/lib/sermons";
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
 * The sermon workspace.
 *
 * A sermon is longer than anything else a member writes, so these caps are
 * generous — but they exist, which is the point. Every one of them is
 * enforced in app/api/sermon, the way every other write path in this app
 * has been since the hardening pass.
 *
 * SERMON_BLOCK_TEXT_MAX is 20 000 because a block can hold a whole passage
 * plus the notes under it, and a preacher who writes long should not be
 * refused at the point they are actually working. The count cap is what
 * stops the jsonb growing without limit.
 */
export const SERMON_TITLE_MAX = 200;
export const SERMON_PASSAGE_MAX = 200;
export const SERMON_BLOCK_TEXT_MAX = 20000;
export const SERMON_BLOCK_REFERENCE_MAX = 200;
export const SERMON_BLOCKS_MAX_COUNT = 200;

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

/**
 * Trim a sermon's blocks to size: the count first, then each block's text
 * and reference.
 *
 * Shaped like capText — it takes whatever the client sent, including
 * nothing recognisable, and returns something safe to write. A value that
 * is not an array is an empty list; a block without a string body is
 * dropped, because a block with no text is not a block.
 *
 * Ids are preserved when they are strings and minted when they are not, so
 * the editor's React keys survive a round trip through here.
 */
export type CappedBlock = {
  id: string;
  kind: SermonBlockKind;
  reference?: string;
  text: string;
};

export function capBlocks(
  blocks: unknown,
  maxCount: number,
  textMax: number,
  refMax: number
): CappedBlock[] {
  if (!Array.isArray(blocks)) return [];
  const out: CappedBlock[] = [];
  for (const raw of blocks.slice(0, Math.max(0, maxCount))) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.text !== "string") continue;

    const text = row.text.slice(0, textMax);
    const reference =
      typeof row.reference === "string" && row.reference.trim().length > 0
        ? row.reference.trim().slice(0, refMax)
        : undefined;

    out.push({
      id:
        typeof row.id === "string" && row.id.length > 0
          ? row.id.slice(0, 64)
          : `b-${out.length}-${Date.now().toString(36)}`,
      // heading | scripture | note, with the pre-2026_09_20 names still
      // accepted — lib/sermons.ts owns that mapping and this mirrors it
      // rather than inventing a second opinion.
      kind: normaliseKind(row.kind),
      ...(reference ? { reference } : {}),
      text
    });
  }
  return out;
}
