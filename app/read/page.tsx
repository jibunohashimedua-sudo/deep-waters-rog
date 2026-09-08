import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  READING_PLAN,
  currentDayNumber,
  formatReading
} from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";
import { fetchChapter, chapterErrorMessage, type ChapterFailure } from "@/lib/bible";
import { resolveTranslation } from "@/lib/translations";
import { wrapVersesInHtml } from "@/lib/verseParse";
import Nav from "@/components/Nav";
import ScriptureReader from "@/components/ScriptureReader";
import ReadingHeader from "@/components/ReadingHeader";

export default async function ReadPage({
  searchParams
}: {
  searchParams: { t?: string; d?: string };
}) {
  const { userId, profile } = await requireProfile();

  // ?d= overrides the current day so links from /me's verse-notes land
  // on the correct chapter regardless of where the reader is today.
  const currentDay = currentDayNumber(profile.start_date, todayForCurrentRequest());
  const requestedDay = Number.parseInt(searchParams.d ?? "", 10);
  const day =
    Number.isFinite(requestedDay) && requestedDay >= 1 && requestedDay <= 90
      ? requestedDay
      : currentDay;
  const reading = READING_PLAN[day - 1];
  const testament = searchParams.t === "nt" ? "nt" : "ot";
  const chapters = testament === "ot" ? reading.ot : reading.nt;
  const label = testament === "ot" ? "Old Testament" : "New Testament";
  const reference = formatReading(chapters);

  // The plan is identical in every translation — same books, same chapters,
  // same days. Only the wording changes.
  const resolved = chapters.map((c) =>
    resolveTranslation(profile.preferred_bible_id, c.abbr, c.book)
  );

  // The chapters and the study note don't depend on each other, so they go
  // out together. Fetching them in sequence was a round trip of dead time
  // on every render of this page.
  const supabase = createClient();
  const [chapterOutcomes, noteResult] = await Promise.all([
    Promise.all(
      chapters.map((c, i) => fetchChapter(c.abbr, c.chapter, resolved[i].id))
    ),
    supabase.from("study_notes").select("title, body").eq("day_number", day).maybeSingle()
  ]);

  if (noteResult.error) {
    console.error("[deep-waters] study note lookup:", noteResult.error.message);
  }
  const note = noteResult.data;

  // Keep the chapters that loaded, and remember the first real problem so we
  // can explain a gap instead of silently showing less scripture.
  const loaded: { book: string; chapter: number; reference: string; html: string }[] = [];
  let failure: ChapterFailure | null = null;
  chapterOutcomes.forEach((o, i) => {
    if (o.ok) {
      loaded.push({
        book: chapters[i].book,
        chapter: chapters[i].chapter,
        reference: o.chapter.reference,
        html: wrapVersesInHtml(o.chapter.content)
      });
    } else if (!failure || o.kind === "rate-limit") {
      failure = o.kind;
    }
  });

  // One line at most, however many chapters fell back.
  const fallbackNote = resolved.find((r) => r.fallbackNote)?.fallbackNote ?? null;

  const otherT = testament === "ot" ? "nt" : "ot";
  const otherLabel = testament === "ot" ? "New Testament" : "Old Testament";

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 pt-0 pb-10">
        {/* The tab bar is hidden on this screen, so this bar is the only
            chrome on it: the way out, where you are, and the translation
            you're in — the last of which now travels with you down the
            chapter instead of waiting at the top of it. */}
        <ReadingHeader
          backHref="/today"
          backLabel={`Back to day ${day}`}
          kicker={`Day ${day} · ${label}`}
          reference={reference}
          userId={userId}
          translationId={
            resolved[0]?.chosen.id ?? profile.preferred_bible_id ?? ""
          }
        />

        {fallbackNote && (
          <p className="mt-6 surface-soft !py-3 !px-4 text-sm text-rog-muted">
            {fallbackNote}
          </p>
        )}

        {note?.body && testament === "ot" && (
          /* Someone's note about today, above the reading.
             
             It was a card with "Study note" set in mono above it — a label
             naming the one thing directly beneath it, which is the single
             job this system asks a label never to take. There is no label
             now: when the note has a title, the title is the heading; when
             it hasn't, "Study note" is the heading rather than a caption
             sitting over one.

             It doesn't need a plate round it either. It is the interface
             sans at 13.5/20 and the scripture below is Literata at 18/1.74,
             so family and size do the separating, which is how this system
             is supposed to tell two kinds of writing apart. */
          <section className="mt-10 border-t border-rog-line pt-6">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-rog-ink leading-snug">
              {note.title?.trim() || "Study note"}
            </h2>
            <p className="selectable mt-3 max-w-[34rem] text-[13.5px] leading-5 text-rog-ink whitespace-pre-wrap">
              {note.body}
            </p>
          </section>
        )}

        {failure && (
          <div className="mt-10 empty-state">
            <p className="empty-body">{chapterErrorMessage(failure)}</p>
            <p className="empty-hint">
              {loaded.length > 0
                ? "Some of today’s reading is below. The rest will load once it clears."
                : "Nothing you’ve saved is affected — your highlights, notes and progress are all still here."}
            </p>
          </div>
        )}

        {/* Scripture. ScriptureReader owns per-verse wrapping (via html
            already pre-processed here), highlight painting, the custom
            selection toolbar, and the notes sheet. */}
        {loaded.length > 0 && (
          <ScriptureReader
            userId={userId}
            dayNumber={day}
            testament={testament}
            chapters={loaded}
            translationId={resolved[0]?.id}
          />
        )}

        <div className="mt-16 flex gap-3">
          <Link href={`/read?t=${otherT}`} className="btn-secondary flex-1 text-center">
            Read {otherLabel}
          </Link>
          <Link href="/today" className="btn-primary flex-1 text-center">
            Mark day complete
          </Link>
        </div>
      </main>
    </>
  );
}
