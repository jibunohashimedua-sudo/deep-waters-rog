import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { bookBySlug, stepChapter } from "@/lib/bibleBooks";
import { planDayForChapter } from "@/lib/plan";
import { fetchChapter, chapterErrorMessage } from "@/lib/bible";
import { resolveTranslation } from "@/lib/translations";
import { wrapVersesInHtml } from "@/lib/verseParse";
import ScriptureReader from "@/components/ScriptureReader";
import ReadingHeader from "@/components/ReadingHeader";
import ChapterPrefetch from "@/components/ChapterPrefetch";

type Props = {
  bookSlug: string;
  chapter: number;
  /** Set when the URL named a verse, so the reader lands on it. */
  focus?: { start: number; end: number };
};

/**
 * One chapter, read freely — shared by /bible/[book]/[chapter] and
 * /bible/[book]/[chapter]/[verse] so the two routes can never drift apart.
 * The only difference between them is whether a verse is brought into view
 * on arrival; everything else about the page is identical, and a verse link
 * is emphatically not a verse-only view.
 *
 * This page never writes a completion and never marks a plan day done — the
 * only thing it shares with /read is the reading surface itself, so scripture
 * looks and behaves identically wherever you meet it. Highlights and verse
 * notes still work, filed under the plan day that chapter belongs to, which
 * is how a highlight made here shows up on /read and the other way round.
 */
export default async function ChapterView({ bookSlug, chapter, focus }: Props) {
  const book = bookBySlug(bookSlug);
  if (!book) notFound();
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
    notFound();
  }

  const { userId, profile } = await requireProfile();

  // Honour the reader's translation unless this book isn't in it, or is
  // numbered on a different tradition — then fall back and say so.
  const resolved = resolveTranslation(profile.preferred_bible_id, book.abbr, book.name);
  const outcome = await fetchChapter(book.abbr, chapter, resolved.id);

  const planDay = planDayForChapter(book.name, chapter);
  const prev = stepChapter(book, chapter, -1);
  const next = stepChapter(book, chapter, 1);
  const href = (t: { book: { slug: string }; chapter: number } | null) =>
    t ? `/bible/${t.book.slug}/${t.chapter}` : null;

  return (
    <>
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 pt-0 pb-10">
        {/* The same header as the daily reading, so scripture looks and
            behaves identically wherever you meet it — including the
            translation switcher travelling down the chapter with you. */}
        <ReadingHeader
          backHref={`/bible/${book.slug}`}
          backLabel={`Back to ${book.name}`}
          kicker={book.group}
          reference={`${book.name} ${chapter}`}
          userId={userId}
          translationId={resolved.chosen.id}
        />

        {resolved.fallbackNote && (
          <p className="mt-6 surface-soft !py-3 !px-4 text-sm text-rog-muted">
            {resolved.fallbackNote}
          </p>
        )}

        {outcome.ok ? (
          <ScriptureReader
            userId={userId}
            dayNumber={planDay?.day ?? 1}
            testament={planDay?.testament ?? book.testament}
            focusVerse={focus}
            chapters={[
              {
                book: book.name,
                chapter,
                reference: outcome.chapter.reference,
                html: wrapVersesInHtml(outcome.chapter.content)
              }
            ]}
          />
        ) : (
          <div className="mt-16 card empty-state">
            <p className="empty-body">{chapterErrorMessage(outcome.kind)}</p>
            <p className="empty-hint">
              Nothing you&rsquo;ve saved is affected — your highlights, notes and
              progress are all still here.
            </p>
            <Link href={`/bible/${book.slug}`} className="btn-secondary mt-2">
              Pick another chapter
            </Link>
          </div>
        )}

        {/* Previous / next, rolling across books: Genesis 50 goes to Exodus 1. */}
        <nav className="mt-16 flex gap-3" aria-label="Chapter navigation">
          {prev ? (
            <Link href={href(prev)!} className="btn-secondary flex-1 text-center">
              &larr; {prev.book.name} {prev.chapter}
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link href={href(next)!} className="btn-primary flex-1 text-center">
              {next.book.name} {next.chapter} &rarr;
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>

        <p className="mt-10 text-xs text-rog-muted">
          Reading here doesn&rsquo;t change your 90-day plan.
        </p>
      </main>

      {/* Warms the next chapter in the background so tapping Next is instant. */}
      <ChapterPrefetch href={href(next)} />
    </>
  );
}
