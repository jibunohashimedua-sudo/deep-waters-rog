import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookBySlug } from "@/lib/bibleBooks";
import { fetchVerseCount } from "@/lib/bible";
import { resolveTranslation } from "@/lib/translations";

/**
 * How many verses are in one chapter, for the verse grid on the chapter
 * picker. Asked for on demand — when somebody long-presses a chapter — rather
 * than up front, because a book like Psalms would otherwise mean 150 chapter
 * loads to draw a page nobody has asked to see yet.
 *
 * Answers in the reader's own translation, since that is the text they will
 * land in and translations genuinely disagree about verse boundaries.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const book = bookBySlug(searchParams.get("book") ?? "");
  const chapter = Number.parseInt(searchParams.get("chapter") ?? "", 10);

  if (!book || !Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "No such chapter" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_bible_id")
    .eq("id", user.id)
    .maybeSingle();

  const resolved = resolveTranslation(
    profile?.preferred_bible_id ?? null,
    book.abbr,
    book.name
  );
  const count = await fetchVerseCount(book.abbr, chapter, resolved.id);

  // A miss isn't an error worth shouting about: the picker just sends the
  // reader to the top of the chapter instead, which is where they were
  // headed anyway.
  if (count === null) {
    return NextResponse.json({ count: null }, { status: 200 });
  }

  return NextResponse.json({ count });
}
