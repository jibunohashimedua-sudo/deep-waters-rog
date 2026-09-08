import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookBySlug } from "@/lib/bibleBooks";
import { fetchChapter, chapterErrorMessage } from "@/lib/bible";
import { verseTextsFromHtml, joinVerseRange } from "@/lib/verseParse";
import { resolveTranslation, translationById, TRANSLATIONS } from "@/lib/translations";

/** The most verses one Compare request will read out. Past this it stops
    being a comparison and becomes a second copy of the chapter. */
const MAX_SPAN = 20;

/**
 * One verse range, in one translation, as plain text.
 *
 * Compare asks for this once per translation rather than in a single batched
 * call, so a translation that fails fails on its own line and the rest of the
 * sheet still fills in. They go out together from the browser, so the parallel
 * is the same either way — the difference is only in what breaks.
 *
 * Chapters come through lib/bible's cache, so the second and later
 * comparisons of a passage cost nothing, and the first warms the cache for
 * everyone else too.
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
  const start = Number.parseInt(searchParams.get("start") ?? "", 10);
  const end = Number.parseInt(searchParams.get("end") ?? "", 10);
  const bibleId = searchParams.get("bible") ?? "";

  if (
    !book ||
    !Number.isFinite(chapter) ||
    chapter < 1 ||
    chapter > book.chapters ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 1 ||
    end < start ||
    end - start + 1 > MAX_SPAN
  ) {
    return NextResponse.json({ error: "No such passage" }, { status: 400 });
  }

  // Only translations we actually offer. An arbitrary id here would be a
  // free proxy onto API.Bible with our key on it.
  if (!TRANSLATIONS.some((t) => t.id === bibleId)) {
    return NextResponse.json({ error: "No such translation" }, { status: 400 });
  }
  const translation = translationById(bibleId);

  // Compare must never label the King James as something else. Where a
  // translation genuinely doesn't carry this book — or numbers it on another
  // tradition — the reading screen quietly falls back to the KJV; Compare
  // cannot, because a comparison of a text with itself is a lie. So it says
  // what happened, in its own words: the reading screen's line ends "so this
  // is the King James", and here there is no King James to show.
  const resolved = resolveTranslation(bibleId, book.abbr, book.name);
  if (resolved.id !== translation.id) {
    const message = translation.diverges?.includes(book.abbr)
      ? `The ${translation.abbr} numbers ${book.name} on a different tradition, so its verses don’t line up with this one.`
      : `The ${translation.abbr} doesn’t include ${book.name}.`;
    return NextResponse.json({ ok: false, message });
  }

  const outcome = await fetchChapter(book.abbr, chapter, translation.id);
  if (!outcome.ok) {
    return NextResponse.json({
      ok: false,
      message: chapterErrorMessage(outcome.kind)
    });
  }

  const text = joinVerseRange(verseTextsFromHtml(outcome.chapter.content), start, end);
  if (!text) {
    // A verse number past the end of this chapter in this edition. Real, and
    // worth saying plainly: translations disagree about verse boundaries.
    return NextResponse.json({
      ok: false,
      message: `The ${translation.abbr} doesn’t number that verse in ${book.name} ${chapter}.`
    });
  }

  return NextResponse.json({ ok: true, text });
}
