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

/**
 * Create a sermon.
 *
 * Sermons used to be written straight from the browser — the editor, the
 * New sermon button and the Bench's "To sermon" all called
 * supabase.from("sermons") directly. That is the pattern the hardening
 * pass spent a whole group removing everywhere else (STRESS_AUDIT T1-A),
 * and the sermon workspace was written after that pass and never got the
 * same treatment. ELITE_EXCELLENCE_AUDIT P2-G.
 *
 * So: one route, every cap from lib/limits.ts, and RLS underneath as the
 * hard edge. Nothing in the client decides how long a sermon may be.
 */
export async function POST(request: Request) {
  let auth;
  try {
    auth = await getPastoralUser();
  } catch (e) {
    // The lookup failed rather than came back empty. Say so — and say it
    // in JSON, because the caller is an XHR reading .json().
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load your profile" },
      { status: 500 }
    );
  }
  if (!auth) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { title, passage_ref, blocks } = body ?? {};

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
  if (Array.isArray(blocks) && blocks.length > SERMON_BLOCKS_MAX_COUNT) {
    return NextResponse.json(
      { error: "too_long", field: "blocks", max: SERMON_BLOCKS_MAX_COUNT },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("sermons")
    .insert({
      user_id: auth.userId,
      // An empty title is a real state — "Untitled" is the editor's word
      // for it, not the database's — so capText's null is coerced back.
      title: capText(title, SERMON_TITLE_MAX) ?? "",
      passage_ref: capText(passage_ref, SERMON_PASSAGE_MAX),
      blocks: capBlocks(
        blocks,
        SERMON_BLOCKS_MAX_COUNT,
        SERMON_BLOCK_TEXT_MAX,
        SERMON_BLOCK_REFERENCE_MAX
      ),
      status: "draft"
    })
    .select("id")
    .single();

  if (error) {
    console.error("[deep-waters] sermon create:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
