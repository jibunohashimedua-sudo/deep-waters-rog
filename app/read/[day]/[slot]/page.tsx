import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { currentDayNumber, daySlots } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";
import { fetchChapter, chapterErrorMessage } from "@/lib/bible";
import { resolveTranslation } from "@/lib/translations";
import { wrapVersesInHtml, countWordsInHtml } from "@/lib/verseParse";
import { bookByName } from "@/lib/bibleBooks";
import { readingAttrs } from "@/lib/readingAttrs";
import Nav from "@/components/Nav";
import ScriptureReader from "@/components/ScriptureReader";
import ReadingHeader from "@/components/ReadingHeader";
import ChapterPager from "@/components/ChapterPager";
import ChapterPrefetch from "@/components/ChapterPrefetch";

/**
 * One chapter of the day's reading.
 *
 * The daily reading used to be every chapter of a testament in one
 * continuous scroll — thirteen chapters on a heavy day, with no sense of
 * where you were in it and nothing to aim at. It is a sequence of chapters
 * now, one to a screen, each at its own address, so the back button works,
 * a chapter can be shared, and finishing one is a thing that happens
 * rather than a scroll position.
 *
 * The whole day is one numbered run — Old Testament, then New — because
 * "chapter 3 of 14 today" is how the day feels from inside it. The day
 * view still lists the two testaments separately; those rows now land on
 * the right place in the run.
 *
 * The Bible tab is untouched: /bible/[book]/[chapter] browses as it did.
 */
export default async function ReadChapterPage({
  params
}: {
  params: { day: string; slot: string };
}) {
  const day = Number.parseInt(params.day, 10);
  const slot = Number.parseInt(params.slot, 10);
  if (!Number.isFinite(day) || day < 1 || day > 90) notFound();

  const { userId, profile } = await requireProfile();
  const currentDay = currentDayNumber(profile.start_date, todayForCurrentRequest());

  const slots = daySlots(day);
  if (slots.length === 0) notFound();
  // A slot past the end of the day is an old link from when the day was
  // split differently, or a typo. Land them on the last chapter rather
  // than on a 404 they can do nothing with.
  if (!Number.isFinite(slot) || slot < 1) redirect(`/read/${day}/1`);
  if (slot > slots.length) redirect(`/read/${day}/${slots.length}`);

  const here = slots[slot - 1];
  const prev = slot > 1 ? slots[slot - 2] : null;
  const next = slot < slots.length ? slots[slot] : null;

  const resolved = resolveTranslation(
    profile.preferred_bible_id,
    here.abbr,
    here.book
  );

  const supabase = createClient();
  const [outcome, noteResult, tickResult] = await Promise.all([
    fetchChapter(here.abbr, here.chapter, resolved.id),
    // The study note belongs to the day, so it rides on the first chapter
    // of it rather than repeating above all fourteen.
    slot === 1
      ? supabase
          .from("study_notes")
          .select("title, body")
          .eq("day_number", day)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("chapter_reads")
      .select("book")
      .eq("user_id", userId)
      .eq("day_number", day)
      .eq("book", here.book)
      .eq("chapter", here.chapter)
      .maybeSingle()
  ]);

  if (noteResult.error) {
    console.error("[deep-waters] study note lookup:", noteResult.error.message);
  }
  const note = noteResult.data;

  const html = outcome.ok ? wrapVersesInHtml(outcome.chapter.content) : "";
  const words = outcome.ok ? countWordsInHtml(outcome.chapter.content) : 0;
  const reference = `${here.book} ${here.chapter}`;

  const nextHref = next ? `/read/${day}/${slot + 1}` : `/day/${day}`;
  const nextLabel = next ? `Next: ${next.book} ${next.chapter}` : "Finish day";

  return (
    <>
      <Nav profile={profile} />
      <main
        data-surface="reading"
        className="max-w-3xl mx-auto px-6 pt-0 pb-10"
        /* The reader's own size, face and spacing, set here so the
           chapter paints right in the first frame. */
        {...readingAttrs(profile as unknown as Record<string, unknown>)}
      >
        <ReadingHeader
          backHref={`/day/${day}`}
          backLabel={`Back to day ${day}`}
          meta={`Chapter ${slot} of ${slots.length} today`}
          reference={reference}
          userId={userId}
          translationId={resolved.chosen.id}
          bookSlug={bookByName(here.book)?.slug ?? null}
          chapter={here.chapter}
        />

        {resolved.fallbackNote && (
          <p className="mt-6 surface-soft !py-3 !px-4 text-sm text-rog-muted">
            {resolved.fallbackNote}
          </p>
        )}

        {note?.body && (
          <section className="mt-10 border-t border-rog-line pt-6">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-rog-ink leading-snug">
              {note.title?.trim() || "Study note"}
            </h2>
            <p className="selectable mt-3 max-w-[34rem] text-[13.5px] leading-5 text-rog-ink whitespace-pre-wrap">
              {note.body}
            </p>
          </section>
        )}

        {outcome.ok ? (
          <ScriptureReader
            userId={userId}
            dayNumber={day}
            testament={here.testament}
            chapters={[
              { book: here.book, chapter: here.chapter, reference, html }
            ]}
            translationId={resolved.id}
            isPastoral={profile.is_pastoral === true}
          />
        ) : (
          <div className="mt-10 empty">
            <p>{chapterErrorMessage(outcome.kind)}</p>
          </div>
        )}

        <ChapterPager
          dayNumber={day}
          book={here.book}
          chapter={here.chapter}
          words={words}
          alreadyRead={!!tickResult.data}
          position={slot}
          total={slots.length}
          prevHref={prev ? `/read/${day}/${slot - 1}` : null}
          prevLabel={prev ? `${prev.book} ${prev.chapter}` : null}
          nextHref={nextHref}
          nextLabel={nextLabel}
          isLast={!next}
          /* Reading ahead is fine. Marking ahead is refused server-side,
             so the pager doesn't offer it either. */
          canRecord={day <= currentDay}
        />
      </main>

      {/* Warms the next chapter so tapping Next is instant. */}
      <ChapterPrefetch href={next ? `/read/${day}/${slot + 1}` : null} />
    </>
  );
}
