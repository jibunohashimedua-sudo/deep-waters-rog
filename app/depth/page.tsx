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
import { currentDayNumber } from "@/lib/plan";
import { bookByName } from "@/lib/bibleBooks";
import { isHighlightColour, type Highlight, type VerseNote } from "@/lib/highlights";
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
    notesResult
  ] = await Promise.all([
    supabase
      .from("completions")
      .select("id, day_number, verse_reference, verse_text, reflection, completed_at")
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
      .select("id, book, chapter, verse_start, verse_end, body, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
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
    ["verse_notes", notesResult]
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

  const day = currentDayNumber(profile.start_date);
  const earned = new Map(badges.map((b) => [b.badge, b.earned_at]));
  const doneDays = new Set(completions.map((c) => c.day_number));

  // Rows written by an older build, or by hand, could carry a colour the
  // palette doesn't know. They are kept and shown in the neutral, rather
  // than dropped — a highlight nobody can see is a highlight that's gone.
  const usable = rawHighlights.filter((h) => isHighlightColour(h.colour));

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
    updatedAt: n.updated_at,
    href: hrefOf(n.book, n.chapter, n.verse_start, n.verse_end)
  }));

  const progress = (
    <>
      {/* The ninety days. Kept days carry the accent, today carries sonar
          because it is a position, and the days still to come are the page
          ground with a hairline round them. */}
      <section className="mt-10">
        <h2 className="kicker kicker-strong">The ninety days</h2>
        <div className="mt-4 grid grid-cols-10 gap-px bg-rog-line">
          {Array.from({ length: 90 }, (_, i) => i + 1).map((d) => {
            const done = doneDays.has(d);
            const isToday = d === day;
            return (
              <div
                key={d}
                title={`Day ${d}`}
                className="aspect-square flex items-center justify-center font-mono text-[9.5px] tabular-nums"
                style={{
                  background: done
                    ? "var(--accent)"
                    : isToday
                    ? "var(--sonar)"
                    : d < day
                    ? "var(--soft-bg)"
                    : "var(--bg)",
                  color:
                    done || isToday ? "var(--on-accent)" : "var(--muted)",
                  boxShadow: isToday ? "inset 0 0 0 1px var(--sonar)" : undefined
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
        <p className="kicker mt-3">
          {doneDays.size} kept &middot; {Math.max(0, 90 - day)} to go
        </p>
      </section>

      {/* Milestones. Rows, not a grid of little cards — an unearned badge
          in a card is an empty box asking to be filled. */}
      <section className="mt-10">
        <h2 className="kicker kicker-strong">Milestones</h2>
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
                <p className="kicker mt-2">
                  {at ? new Date(at).toLocaleDateString("en-GB") : "Not yet"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {cohorts.length > 0 && (
        <section className="mt-10">
          <h2 className="kicker kicker-strong">Your cohorts</h2>
          <ul className="mark-list mt-4">
            {cohorts.map((cm: any) => (
              <li key={cm.cohorts.id} className="mark-row">
                <Link href={`/c/${cm.cohorts.slug}`} className="block">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {cm.cohorts.name}
                  </span>
                  <span className="kicker block mt-1">
                    {cm.role === "leader" ? "Leader" : "Member"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="kicker kicker-strong">Your reflections</h2>
        {completions.length === 0 ? (
          <p className="mt-4 font-serif text-[17px] text-rog-muted">
            Your reflections will collect here once you save your first day.
          </p>
        ) : (
          <ul className="mark-list mt-4">
            {completions.map((c) => (
              <li key={c.id} className="mark-row">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="kicker kicker-strong">Day {c.day_number}</span>
                  <span className="kicker">
                    {new Date(c.completed_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                {c.verse_text && (
                  <p className="mark-text selectable mt-2">{c.verse_text}</p>
                )}
                {c.verse_reference && (
                  <p className="kicker mt-1.5">{c.verse_reference}</p>
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
        <h2 className="kicker kicker-strong">Danger zone</h2>
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
            <p className="kicker mt-2">
              Day {day} &middot; {lb?.days_completed ?? doneDays.size} completed
              &middot; {lb?.current_streak ?? 0} day streak
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
