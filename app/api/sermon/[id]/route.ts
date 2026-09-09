import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPastoralUser } from "@/lib/auth";
import {
  SERMON_TITLE_MAX,
  SERMON_PASSAGE_MAX,
  SERMON_BLOCK_TEXT_MAX,
  SERMON_BLOCK_REFERENCE_MAX,
  SERMON_BLOCKS_MAX_COUNT,
  capBlocks,
  capText
} from "@/lib/limits";

const STATUSES = ["draft", "preached", "archived"] as const;

/**
 * Update or delete one sermon.
 *
 * Both verbs carry `.eq("user_id", userId)` as well as leaning on RLS.
 * The policy already says own-rows-only; the filter says it again in a
 * place a reader of this file can see, and makes a zero-row update
 * distinguishable from a refused one.
 */
async function gate() {
  try {
    const auth = await getPastoralUser();
    if (!auth) {
      return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
    }
    return { auth };
  } catch (e) {
    return {
      error: NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not load your profile" },
        { status: 500 }
      )
    };
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const g = await gate();
  if (g.error) return g.error;
  const auth = g.auth!;

  const body = await request.json().catch(() => ({}));
  const { title, passage_ref, blocks, status, preached_on } = body ?? {};

  if (typeof title === "string" && title.length > SERMON_TITLE_MAX) {
    return NextResponse.json(
      { error: "too_long", field: "title", max: SERMON_TITLE_MAX },
      { status: 400 }
    );
  }
  if (typeof passage_ref === "string" && passage_ref.length > SERMON_PASSAGE_MAX) {
    return NextResponse.json(
      { error: "too_long", field: "passage_ref", max: SERMON_PASSAGE_MAX },
      { status: 400 }
    );
  }
  if (Array.isArray(blocks)) {
    if (blocks.length > SERMON_BLOCKS_MAX_COUNT) {
      return NextResponse.json(
        { error: "too_long", field: "blocks", max: SERMON_BLOCKS_MAX_COUNT },
        { status: 400 }
      );
    }
    const tooLong = blocks.find(
      (b) =>
        b &&
        typeof b === "object" &&
        typeof (b as { text?: unknown }).text === "string" &&
        ((b as { text: string }).text.length > SERMON_BLOCK_TEXT_MAX ||
          (typeof (b as { reference?: unknown }).reference === "string" &&
            (b as { reference: string }).reference.length > SERMON_BLOCK_REFERENCE_MAX))
    );
    if (tooLong) {
      return NextResponse.json(
        { error: "too_long", field: "block", max: SERMON_BLOCK_TEXT_MAX },
        { status: 400 }
      );
    }
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "unknown status" }, { status: 400 });
  }

  // Only what was actually sent. A PATCH that carries a title and nothing
  // else must not blank the passage.
  const patch: Record<string, unknown> = {};
  if (title !== undefined) patch.title = capText(title, SERMON_TITLE_MAX) ?? "";
  if (passage_ref !== undefined) {
    patch.passage_ref = capText(passage_ref, SERMON_PASSAGE_MAX);
  }
  if (blocks !== undefined) {
    patch.blocks = capBlocks(
      blocks,
      SERMON_BLOCKS_MAX_COUNT,
      SERMON_BLOCK_TEXT_MAX,
      SERMON_BLOCK_REFERENCE_MAX
    );
  }
  if (status !== undefined) patch.status = status;
  if (preached_on !== undefined) {
    patch.preached_on =
      typeof preached_on === "string" && preached_on.trim().length > 0
        ? preached_on.trim()
        : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("sermons")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", auth.userId)
    .select("id");

  if (error) {
    console.error("[deep-waters] sermon update:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Zero rows means the sermon is gone or was never theirs. Postgres does
  // not call that an error, so the honest answer has to be built here —
  // the same shape CohortSettingsForm was given in the hardening pass.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const g = await gate();
  if (g.error) return g.error;
  const auth = g.auth!;

  const supabase = createClient();
  const { error } = await supabase
    .from("sermons")
    .delete()
    .eq("id", params.id)
    .eq("user_id", auth.userId);

  if (error) {
    console.error("[deep-waters] sermon delete:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Idempotent, the way delete-user was made idempotent in the polish
  // pass: a sermon that is already gone is a sermon that is gone.
  return NextResponse.json({ ok: true });
}
