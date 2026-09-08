/** A sermon's shape, shared by the list, the editor and the Bench. */

export type SermonBlock = {
  id: string;
  kind: "verse" | "text";
  /** Set on a verse block — the passage it came from. */
  reference?: string;
  text: string;
};

export type Sermon = {
  id: string;
  user_id: string;
  title: string;
  passage_ref: string | null;
  blocks: SermonBlock[];
  status: "draft" | "preached" | "archived";
  preached_on: string | null;
  created_at: string;
  updated_at: string;
};

/** Blocks come back as jsonb, which is `unknown` until it is checked. */
export function readBlocks(value: unknown): SermonBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const row = b as Record<string, unknown>;
    if (typeof row.text !== "string") return [];
    return [
      {
        id: typeof row.id === "string" ? row.id : `b-${Math.random().toString(36).slice(2)}`,
        kind: row.kind === "verse" ? "verse" : "text",
        reference: typeof row.reference === "string" ? row.reference : undefined,
        text: row.text
      }
    ];
  });
}
