import { NextRequest } from "next/server";
import { dayCard } from "@/lib/og/card";

export const runtime = "edge";

/**
 * The card offered when someone keeps a day, from the reflection form.
 * Rebuilt in Fathom — the cream-and-purple version predated the system.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    return await dayCard({
      day: searchParams.get("day") ?? "1",
      name: searchParams.get("name") ?? "Reader",
      reference: searchParams.get("verse") ?? "",
      text: searchParams.get("text") ?? "",
      photo: searchParams.get("photo") ?? ""
    });
  } catch (err) {
    // Surfaced rather than swallowed: a card that silently 500s looks
    // exactly like a card that is still loading.
    console.error("[deep-waters] day card:", err);
    return new Response("Couldn't build that card.", { status: 500 });
  }
}
