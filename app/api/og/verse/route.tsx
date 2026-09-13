import { NextRequest } from "next/server";
import { verseCard, isOrient, isBackground, type Orient, type Background } from "@/lib/og/card";

export const runtime = "edge";

/**
 * "Share as image", from the verse toolbar.
 *
 * Rebuilt in Fathom. The card this replaced was drawn in the old
 * cream-and-purple system — a purple band, a pink rule, Source Serif in
 * italic — and it had its own copy of the font loader beside the one in
 * /api/og. Both now come from lib/og/card.tsx, so the two cards cannot
 * drift apart again and the loader is fixed in one place.
 *
 * Query params:
 *   ref     — the reference, "Psalm 42:7"
 *   text    — the verse itself
 *   day     — the sharer's plan day, so the mark fills to their depth
 *   orient  — square | portrait | story (default: portrait)
 *   bg      — plain | sounding | plumb | tide | random (default: plain)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("ref") ?? "";
  const text = searchParams.get("text") ?? "";

  if (!text.trim()) {
    return new Response("Nothing to put on a card.", { status: 400 });
  }

  const orientParam = searchParams.get("orient");
  const orient: Orient = isOrient(orientParam) ? orientParam : "portrait";

  const bgParam = searchParams.get("bg");
  // "random" is a valid choice too — the card resolves it to a real name.
  const bg: Background | "random" = bgParam === "random"
    ? "random"
    : (isBackground(bgParam) ? bgParam : "plain");

  try {
    return await verseCard(
      reference,
      text,
      Number(searchParams.get("day")) || undefined,
      { orient, bg }
    );
  } catch (err) {
    console.error("[deep-waters] verse card:", err);
    return new Response("Couldn't build that card.", { status: 500 });
  }
}
