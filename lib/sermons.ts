/** A sermon's shape, shared by the list, the read view, the editor and
    the Bench. */

/**
 * The three things a sermon is made of.
 *
 *   heading    a short line the preacher writes, to break the flow
 *   scripture  a reference and the words behind it
 *   note       free text
 *
 * The old model had two kinds, `verse` and `text`, and the sermon itself
 * carried one passage with blocks hung off it. That is not what a sermon
 * is: a sermon has a title and gathers many scriptures, and the passage
 * on the row was only ever the first one anybody happened to send.
 * `passage_ref` survives as an optional main text — the one the sermon is
 * *on* — and any number of scripture blocks sit in the body.
 *
 * The old names are still read (see normaliseKind): rows written before
 * 2026_09_20 carry them, and a deploy that lands before its migration
 * must not turn somebody's sermon into a blank page.
 */
export type SermonBlockKind = "heading" | "scripture" | "note";

export type SermonBlock = {
  id: string;
  kind: SermonBlockKind;
  /** Set on a scripture block — the passage the words came from. */
  reference?: string;
  text: string;
};

export type SermonStatus = "draft" | "preached" | "archived";

export type Sermon = {
  id: string;
  user_id: string;
  title: string;
  /** The sermon's main text, if it has one. Optional, and not the only
      passage it may contain — that is what scripture blocks are for. */
  passage_ref: string | null;
  blocks: SermonBlock[];
  status: SermonStatus;
  preached_on: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * One block kind, whatever it was called when it was written.
 *
 * `verse` and `text` are the pre-2026_09_20 names. They are mapped rather
 * than rejected, so an unmigrated row opens correctly and is written back
 * under the new name the next time it is saved.
 */
export function normaliseKind(value: unknown): SermonBlockKind {
  switch (value) {
    case "heading":
      return "heading";
    case "scripture":
    case "verse":
      return "scripture";
    case "note":
    case "text":
      return "note";
    default:
      // A block with no kind at all is prose. It is the only guess that
      // cannot lose anything: a note renders its text and nothing else.
      return "note";
  }
}

export function newBlockId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Blocks come back as jsonb, which is `unknown` until it is checked. */
export function readBlocks(value: unknown): SermonBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const row = b as Record<string, unknown>;
    if (typeof row.text !== "string") return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : newBlockId(),
        kind: normaliseKind(row.kind),
        reference:
          typeof row.reference === "string" && row.reference.trim()
            ? row.reference.trim()
            : undefined,
        text: row.text
      }
    ];
  });
}

/** What to call a sermon with no title yet. One word, in one place. */
export const UNTITLED = "Untitled";

export function sermonTitle(title: string | null | undefined): string {
  return title?.trim() || UNTITLED;
}

/**
 * The order sermons are offered in when picking one.
 *
 * Drafts above preached, and within each, most recently touched first.
 * Somebody sending a verse to a sermon is almost always working on a
 * draft; a preached sermon is a record, and reaching for one is the rarer
 * thing. Archived sits at the bottom for the same reason.
 */
const STATUS_RANK: Record<string, number> = { draft: 0, preached: 1, archived: 2 };

export function comparePickOrder(
  a: { status: string | null; updated_at: string },
  b: { status: string | null; updated_at: string }
): number {
  const ra = STATUS_RANK[a.status ?? "draft"] ?? 0;
  const rb = STATUS_RANK[b.status ?? "draft"] ?? 0;
  if (ra !== rb) return ra - rb;
  return b.updated_at.localeCompare(a.updated_at);
}
