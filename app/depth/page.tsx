import Link from "next/link";
import Nav from "@/components/Nav";
import Avatar from "@/components/Avatar";
import DepthTabs from "@/components/DepthTabs";
import HighlightsView, { type HighlightRow } from "@/components/HighlightsView";
import NotesView, { type NoteRow } from "@/components/NotesView";
import ResetMyData from "@/components/ResetMyData";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BADGES, BADGE_ORDER } from "@/lib/badges";
import { READING_PLAN, currentDayNumber } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";
import { bookByName } from "@/lib/bibleBooks";
import {
  normaliseHighlightColour,
  type Highlight,
  type VerseNote
} from "@/lib/highlights";
import { fetchVerseText, spanKey } from "@/lib/verseText";

export const metadata = { title: "Depth · Deep Waters" };

/** "PSALM 42:7" / "PSALM 42:7–9" — the mono line on a row. */
function referenceOf(book: string, chapter: number, start: number, end: number) {
  const verses = end > start ? `${start}–${end}` : `${start}`;
  return `${book} ${chapter}:${verses}`.toUpperCase();
}

/** A link that opens the chapter at the verse. */
function hrefOf(book: string, chapter: number, start: number, end: number) {
  const slug = bookByName(book)?.slug;
  if (!slug) return "/bible";
  const segment = end > start ? `${start}-${end}` : `${start}`;
  return `/bible/${slug}/${chapter}/${segment}`;
}

/**
 * Depth — the profile.
 *
 * It already held progress, badges and history; what it never did was read
 * as *yours*, and there was no way to reach it that said so. Now it opens
 * with your portrait and your name, and it holds three views: where you are
 * in the ninety days, every verse you have marked, and everything you have
 * written.
 *
 * /me still works — it redirects here, so old links and anything anyone has
 * bookmarked still land in the right place.
 */
export default async function DepthPage() {
  const { userId, profile } = await requireProfile();
  const supabase = createClient();

  // Six plain queries, in parallel, no nested joins. This project has had
  // HTTP 300s out of ambiguous relationships; everything here is merged in
  // code instead. Cohorts is the one exception and it was already written
  // that way, against a single unambiguous foreign key.
  const [
    completionsResult,
    badgesResult,
    leaderboardResult,
    cohortsResult,
    highlightsResult,
    notesResult,
    chapterReadsResult
  ] = await Promise.all([
    supabase
      .from("completions")
      .select("id, day_number, verse_reference, verse_text, reflection, completed_at, is_full")
      .eq("user_id", userId)
      .order("day_number", { ascending: false }),
    supabase.from("badges").select("badge, earned_at").eq("user_id", userId),
    supabase.from("leaderboard").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cohort_members")
      .select("role, cohorts(id, slug, name, start_date)")
      .eq("user_id", userId),
    supabase
      .from("highlights")
      .select("id, book, chapter, verse_start, verse_end, colour, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("verse_notes")
      .select("id, book, chapter, verse_start, verse_end, body, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    // Chapter tick counts per day, so a partly-read day shows a partial
    // fill on the grid rather than reading as untouched.
    supabase
      .from("chapter_reads")
      .select("day_number")
      .eq("user_id", userId)
  ]);

  // Errors are logged rather than dropped. A page that renders an empty
  // list on a failed query tells the reader they have nothing, which is a
  // far worse lie than saying the list wouldn't load.
  for (const [label, result] of [
    ["completions", completionsResult],
    ["badges", badgesResult],
    ["leaderboard", leaderboardResult],
    ["cohorts", cohortsResult],
    ["highlights", highlightsResult],
    ["verse_notes", notesResult],
    ["chapter_reads", chapterReadsResult]
  ] as const) {
    if (result.error) {
      console.error(`[deep-waters] depth ${label}:`, result.error.message);
    }
  }

  const completions = completionsResult.data ?? [];
  const badges = badgesResult.data ?? [];
  const lb = leaderboardResult.data;
  const cohorts = cohortsResult.data ?? [];
  const rawHighlights = (highlightsResult.data ?? []) as Highlight[];
  const rawNotes = (notesResult.data ?? []) as VerseNote[];
  const chapterReadRows = chapterReadsResult.data ?? [];

  const day = currentDayNumber(profile.start_date, todayForCurrentRequest());
  const earned = new Map(badges.map((b) => [b.badge, b.earned_at]));
  // "Done" is now the fully-kept days only — partial days show separately
  // on the grid rather than counting here.
  const doneDays = new Set(
    completions.filter((c) => (c as any).is_full !== false).map((c) => c.day_number)
  );

  // Partial ticks per day, for the fractional fill on the grid.
  const ticksByDay = new Map<number, number>();
  for (const r of chapterReadRows) {
    const d = r.day_number as number;
    ticksByDay.set(d, (ticksByDay.get(d) ?? 0) + 1);
  }
  const chaptersPerDay = (d: number) => {
    const p = READING_PLAN[d - 1];
    return p ? p.ot.length + p.nt.length : 0;
  };

  // A highlight written by the previous build, in the minutes between the
  // colour migration running and this deploy going live, arrives carrying a
  // retired name. It is translated rather than dropped: the reader chose a
  // colour, and a mark nobody can see is a mark that has gone.
  //
  // Anything the palette has never known at all is counted and reported,
  // not silently painted the wrong colour.
  const usable = rawHighlights
    .map((h) => ({ ...h, colour: normaliseHighlightColour(h.colour) }))
    .filter((h): h is Highlight => h.colour !== null);

  const unknown = rawHighlights.length - usable.length;
  if (unknown > 0) {
    console.error(
      `[deep-waters] depth: ${unknown} highlight(s) carry a colour the palette doesn't know`
    );
  }

  const { text: verseText, error: verseTextError } = await fetchVerseText(
    usable,
    profile.preferred_bible_id
  );
  if (verseTextError) {
    console.error("[deep-waters] depth verse text:", verseTextError);
  }

  const highlightRows: HighlightRow[] = usable.map((h) => ({
    id: h.id,
    book: h.book,
    colour: h.colour,
    reference: referenceOf(h.book, h.chapter, h.verse_start, h.verse_end),
    text: verseText.get(spanKey(h)) ?? "",
    createdAt: h.created_at,
    href: hrefOf(h.book, h.chapter, h.verse_start, h.verse_end),
    verses: h.verse_end - h.verse_start + 1
  }));

  const noteRows: NoteRow[] = rawNotes.map((n) => ({
    id: n.id,
    book: n.book,
    reference: referenceOf(n.book, n.chapter, n.verse_start, n.verse_end),
    body: n.body,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    href: hrefOf(n.book, n.chapter, n.verse_start, n.verse_end)
  }));

  const progress = (
    <>
      {/* The ninety days. Kept days carry the accent, today carries sonar
          because it is a position, and the days still to come are the page
          ground with a hairline round them. */}
      <section className="mt-10">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">The ninety days</h2>
        <div className="mt-4 grid grid-cols-10 gap-px bg-rog-line">
          {Array.from({ length: 90 }, (_, i) => i + 1).map((d) => {
            const done = doneDays.has(d);
            const isToday = d === day;
            const ticks = ticksByDay.get(d) ?? 0;
            const total = chaptersPerDay(d);
            // Partial only when the day isn't already fully kept and has
            // at least one tick. A day that's fully ticked lands as done
            // through the API's is_full path — partial is by definition
            // < 100%.
            const partial = !done && total > 0 && ticks > 0;
            const pct = partial ? Math.min(100, Math.round((ticks / total) * 100)) : 0;
            const label = done
              ? "kept"
              : isToday
                ? "today"
                : partial
                  ? `${ticks} of ${total} chapters read`
                  : d < day
                    ? "not kept"
                    : "upcoming";
            return (
              <Link
                key={d}
                href={`/day/${d}`}
                title={`Day ${d} — ${label}`}
                aria-label={`Open day ${d}, ${label}`}
                className="relative aspect-square flex items-center justify-center font-mono text-[9.5px] tabular-nums transition-opacity hover:opacity-80"
                style={{
                  background: done
                    ? "var(--accent)"
                    : isToday
                      ? "var(--sonar)"
                      : d < day
                        ? "var(--soft-bg)"
                        : "var(--bg)",
                  color: done || isToday ? "var(--on-accent)" : "var(--ink-data)",
                  outline: isToday ? "var(--rule-hairline) solid var(--sonar)" : undefined,
                  outlineOffset: isToday ? "calc(var(--rule-hairline) * -1)" : undefined
                }}
              >
                {/* Partial fill from the bottom of the cell, proportional
                    to chapters read. Absolutely positioned under the
                    number so a half-read day reads as half-violet. */}
                {partial && (
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 bottom-0 pointer-events-none"
                    style={{
                      height: `${pct}%`,
                      background: "var(--accent)",
                      opacity: 0.55
                    }}
                  />
                )}
                <span className="relative">{d}</span>
              </Link>
            );
          })}
        </div>
        <p className="meta mt-3">{doneDays.size} kept</p>
      </section>

      {/* Milestones. Rows, not a grid of little cards — an unearned badge
          in a card is an empty box asking to be filled. */}
      <section className="mt-10">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Milestones</h2>
        <ul className="mark-list mt-4">
          {BADGE_ORDER.map((key) => {
            const b = BADGES[key];
            const at = earned.get(key);
            return (
              <li
                key={key}
                className="mark-row"
                style={{ opacity: at ? 1 : 0.55 }}
              >
                <p className="text-[13.5px] leading-5 font-medium text-rog-ink">
                  {b.label}
                </p>
                <p className="mt-1 text-[13.5px] leading-5 text-rog-muted">
                  {b.description}
                </p>
                <p className="meta mt-2">
                  {at ? new Date(at).toLocaleDateString("en-GB") : "Not yet"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {cohorts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Your cohorts</h2>
          <ul className="mark-list mt-4">
            {cohorts.map((cm: any) => (
              <li key={cm.cohorts.id} className="mark-row">
                <Link href={`/c/${cm.cohorts.slug}`} className="block">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {cm.cohorts.name}
                  </span>
                  <span className="meta block mt-1">
                    {cm.role === "leader" ? "Leader" : "Member"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Your reflections</h2>
        {completions.length === 0 ? (
          <p className="mt-4 font-serif text-[17px] text-rog-muted">
            Your reflections will collect here once you save your first day.
          </p>
        ) : (
          <ul className="mark-list mt-4">
            {completions.map((c) => (
              <li key={c.id} className="mark-row">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="meta meta-strong">Day {c.day_number}</span>
                  <span className="meta">
                    {new Date(c.completed_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                {c.verse_text && (
                  <p className="mark-text selectable mt-2">{c.verse_text}</p>
                )}
                {c.verse_reference && (
                  <p className="meta mt-1.5">{c.verse_reference}</p>
                )}
                {c.reflection && (
                  <p className="mark-note selectable mt-2">{c.reflection}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Danger zone</h2>
        <div className="mt-4">
          <ResetMyData />
        </div>
      </section>
    </>
  );

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* This is you. Portrait, name, and one mono line of where you are
            — no card round it, no label above it. */}
        <header className="flex items-start gap-4">
          <Avatar name={profile.name} photoUrl={profile.photo_url} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-[26px] leading-tight text-rog-ink break-words">
              {profile.name}
            </h1>
            {/* One fact. It was "Day 34 · 30 kept · Streak 12" — three
                readings given equal weight, so none of them landed, and
                the streak is a number this app no longer puts on screen
                anywhere. Days kept is the one that describes the reader. */}
            <p className="meta mt-2">
              {lb?.days_completed ?? doneDays.size} kept
            </p>
            {profile.bio && (
              <p className="selectable mt-3 text-[13.5px] leading-5 text-rog-muted break-words">
                {profile.bio}
              </p>
            )}
            <Link href="/me/edit" className="btn-secondary !py-2 !px-5 mt-4 text-[13.5px]">
              Edit profile
            </Link>
          </div>
        </header>

        <div className="mt-10">
          <DepthTabs
            progress={progress}
            highlights={
              <HighlightsView rows={highlightRows} textError={verseTextError} />
            }
            notes={<NotesView rows={noteRows} />}
          />
        </div>
      </main>
    </>
  );
}
