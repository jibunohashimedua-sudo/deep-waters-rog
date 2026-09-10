import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookBySlug } from "@/lib/bibleBooks";
import { fetchChapter, chapterErrorMessage } from "@/lib/bible";
import { wrapVersesInHtml } from "@/lib/verseParse";
import { resolveTranslation, TRANSLATIONS } from "@/lib/translations";

/**
 * One whole chapter, in one translation, as verse-wrapped HTML.
 *
 * The sibling of /api/bible/verse-text, and deliberately nothing more than
 * that: same auth, same book and translation guards, same chapter cache,
 * same reader-facing failure copy. The only difference is the size of the
 * answer — verse-text hands back a run of up to twenty verses as plain
 * text for Compare and the Bench's second-text lens, and this hands back
 * the chapter, marked up exactly as the reading page's own server render
 * marks it up, because a pane of scripture needs the verse numbers, the
 * poetry indents and the paragraph breaks that plain text has thrown away.
 *
 * It exists for the second pane of parallel reading, which is client-side
 * and therefore cannot call fetchChapter directly. Everything it calls is
 * the same function the server render calls, so a chapter opened in a pane
 * and the same chapter opened on its own can never disagree.
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
  const bibleId = searchParams.get("bible") ?? "";

  if (
    !book ||
    !Number.isFinite(chapter) ||
    chapter < 1 ||
    chapter > book.chapters
  ) {
    return NextResponse.json({ error: "No such chapter" }, { status: 400 });
  }

  // Only translations we actually offer. An arbitrary id here would be a
  // free proxy onto API.Bible with our key on it.
  if (!TRANSLATIONS.some((t) => t.id === bibleId)) {
    return NextResponse.json({ error: "No such translation" }, { status: 400 });
  }

  // A pane falls back exactly as the reading page falls back — to the King
  // James, with a line saying why. Compare refuses to fall back because a
  // comparison of a text with itself is a lie; a pane is a reading surface
  // rather than a comparison, so the honest thing here is the chapter plus
  // the explanation, which is what the single pane has always done.
  const resolved = resolveTranslation(bibleId, book.abbr, book.name);
  const outcome = await fetchChapter(book.abbr, chapter, resolved.id);
  if (!outcome.ok) {
    return NextResponse.json({
      ok: false,
      message: chapterErrorMessage(outcome.kind)
    });
  }

  return NextResponse.json({
    ok: true,
    reference: outcome.chapter.reference,
    html: wrapVersesInHtml(outcome.chapter.content),
    resolvedId: resolved.id,
    fallbackNote: resolved.fallbackNote
  });
}
