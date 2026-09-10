"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { bookBySlug, bookByName } from "@/lib/bibleBooks";
import { currentDayNumber, daySlots } from "@/lib/plan";
import { countWordsInHtml } from "@/lib/verseParse";
import { todayISOForUser } from "@/lib/dates";
import { readingAttrs } from "@/lib/readingAttrs";
import { cachedMe, type CachedMe } from "@/lib/offline/me";
import { cachedChapterAsync } from "@/lib/parallelVerse";
import { hasLocalRead, localReadsForDay } from "@/lib/offline/progress";
import { cachedView, type CachedView } from "@/lib/offline/views";
import { startQueue, subscribeQueue } from "@/lib/offline/queue";
import LoadingRule from "@/components/LoadingRule";
import ScriptureReader from "@/components/ScriptureReader";
import ChapterPager from "@/components/ChapterPager";

/**
 * The app with no network behind it.
 *
 * The service worker hands this document to any navigation that could not
 * reach the server, at the URL the reader actually asked for. So the address
 * bar still says /read/12/3, the back button still works, and tapping Next
 * is a real navigation that falls back here again on the next chapter. The
 * reader walks the day exactly as they would with signal; the pages are just
 * drawn from the phone instead of from London.
 *
 * WHAT THIS IS NOT: a second reading surface. It renders the same
 * ScriptureReader and the same ChapterPager the server-rendered pages
 * render, with the same preference attributes on the same `data-surface`
 * element — so highlighting a verse, writing a note and recording a chapter
 * all work here because they are the same components doing it, not a
 * simplified copy that would drift. What it replaces is only where the data
 * comes from: IndexedDB rather than a server render.
 *
 * The one thing it deliberately does not reproduce is the translation
 * switcher in the reading header. Offering to change translation with no
 * network would be offering something that cannot happen, and the brief is
 * explicit — anything that cannot work offline is disabled with a reason,
 * not left looking tappable.
 */
export default function OfflineShell() {
  const [where, setWhere] = useState<string | null>(null);
  const [me, setMe] = useState<CachedMe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWhere(window.location.pathname);
    void cachedMe().then((m) => {
      setMe(m);
      setReady(true);
    });
  }, []);

  // Nothing at all until the path and the reader are known. A frame of the
  // wrong screen is worse than a frame of nothing, and this resolves inside
  // one turn of the event loop.
  if (!ready || where === null) return <Frame />;

  const read = where.match(/^\/read\/(\d+)\/(\d+)\/?$/);
  if (read) {
    return (
      <OfflineChapter
        me={me}
        day={Number(read[1])}
        slot={Number(read[2])}
      />
    );
  }

  const bible = where.match(/^\/bible\/([^/]+)\/(\d+)(?:\/[\d-]+)?\/?$/);
  if (bible) {
    return <OfflineBibleChapter me={me} bookSlug={bible[1]} chapter={Number(bible[2])} />;
  }

  const day = where.match(/^\/day\/(\d+)\/?$/);
  if (day) return <OfflineDay me={me} day={Number(day[1])} />;
  if (where === "/today" || where === "/read") return <OfflineDay me={me} day={null} />;

  if (where === "/community") return <OfflineList kind="community" title="Community" />;
  if (where === "/prayer") return <OfflineList kind="prayer" title="Prayer" />;
  if (where === "/notifications") return <OfflineList kind="notifications" title="Alerts" />;

  return <OfflineNothing where={where} />;
}

// --------------------------------------------------------------- the frame

/**
 * The shell around every offline screen.
 *
 * No Nav: Nav asks the network who you are, and here nobody can answer. So
 * this carries its own copy of the offline bar — and its own count of what
 * is waiting to sync, because this is the screen a reader is actually
 * looking at while they build that queue up. Walking four chapters in a
 * tunnel and seeing the number go up is the whole of the reassurance.
 */
function Frame({ children }: { children?: React.ReactNode }) {
  const [pending, setPending] = useState(0);

  useEffect(() => subscribeQueue((s) => setPending(s.pending)), []);
  // The queue also has to be watching for the signal coming back, and on
  // this screen nothing else is doing it: Nav, which normally starts it,
  // is not rendered here.
  useEffect(() => startQueue(), []);

  return (
    <>
      <div className="offline-bar" role="status" aria-live="polite">
        <span className="offline-bar-dot" aria-hidden />
        <span>
          Offline — showing what&rsquo;s saved on this device
          {pending > 0 && (
            <>
              {" · "}
              <span className="offline-bar-count">{pending}</span> waiting to sync
            </>
          )}
        </span>
      </div>
      {children}
    </>
  );
}

function BackToPlan() {
  return (
    <p className="mt-10">
      <Link href="/today" className="btn-secondary">
        Back to today
      </Link>
    </p>
  );
}

// ------------------------------------------------------------ one chapter

function useChapter(bibleId: string | null, bookSlug: string | null, chapter: number) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "none" }
    /** No cached profile, so we do not even know which translation to look
        for. A different sentence from "we looked and it wasn't there". */
    | { status: "unknown" }
    | { status: "ready"; html: string; reference: string }
  >({ status: "loading" });

  useEffect(() => {
    // Nothing to look up — this device has never been signed in with a
    // connection, so there is no preferred translation to look under. It
    // must NOT sit on "loading" for ever: that renders as a blank page,
    // which is the one outcome this whole feature exists to prevent.
    if (!bibleId || !bookSlug) {
      setState({ status: "unknown" });
      return;
    }
    let cancelled = false;
    void cachedChapterAsync(bookSlug, chapter, bibleId).then((hit) => {
      if (cancelled) return;
      setState(
        hit
          ? { status: "ready", html: hit.html, reference: hit.reference }
          : { status: "none" }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [bibleId, bookSlug, chapter]);

  return state;
}

/** Never a bare empty box. A screen with nothing on it and no explanation is
    indistinguishable from a broken one. */
function NotSaved({ what, hint }: { what: string; hint?: string }) {
  return (
    <div className="mt-10 empty">
      <p>{what}</p>
      {hint && <p className="mt-2">{hint}</p>}
    </div>
  );
}

function NeverSignedIn() {
  return (
    <NotSaved
      what="This device hasn’t saved your reading yet."
      hint="Open Deep Waters once with a connection and your chapters, notes and settings will be here the next time you’re without one."
    />
  );
}

/** One chapter of the day's reading, with the pager under it. */
function OfflineChapter({
  me,
  day,
  slot
}: {
  me: CachedMe | null;
  day: number;
  slot: number;
}) {
  const slots = daySlots(day);
  const here = slots[slot - 1] ?? null;
  const book = here ? bookByName(here.book) : null;
  const chapter = useChapter(me?.bibleId ?? null, book?.slug ?? null, here?.chapter ?? 0);
  const [alreadyRead, setAlreadyRead] = useState(false);

  useEffect(() => {
    if (!here) return;
    void hasLocalRead({ day_number: day, book: here.book, chapter: here.chapter }).then(
      setAlreadyRead
    );
  }, [day, here]);

  if (!here || !book) return <OfflineNothing where={`/read/${day}/${slot}`} />;

  const prev = slot > 1 ? slots[slot - 2] : null;
  const next = slot < slots.length ? slots[slot] : null;

  // The same rule the server applies: reading ahead is fine, recording ahead
  // is refused. Without a start date we cannot know which day is today, so
  // we do not record — a chapter wrongly recorded is worse than one recorded
  // late, and the queue would only be refused at the far end anyway.
  const today = me?.startDate ? currentDayNumber(me.startDate, todayISOForUser()) : 0;
  const canRecord = today > 0 && day <= today;

  return (
    <Frame>
      <main
        data-surface="reading"
        className="max-w-3xl mx-auto px-6 pt-0 pb-10"
        {...readingAttrs(me?.prefs as unknown as Record<string, unknown>)}
      >
        <header className="pt-6">
          <Link href={`/day/${day}`} className="meta">
            &larr; Day {day}
          </Link>
          <p className="meta mt-3">
            Chapter {slot} of {slots.length} today
          </p>
          <h1 className="reading-title mt-1">
            {here.book} {here.chapter}
          </h1>
        </header>

        {chapter.status === "loading" && <LoadingRule label="Loading the chapter saved on this device" />}

        {chapter.status === "unknown" && <NeverSignedIn />}

        {chapter.status === "none" && (
          <NotSaved
            what={`${here.book} ${here.chapter} isn’t saved on this device yet, and there’s no connection to fetch it.`}
            hint="It’ll be here as soon as you have signal. To have the whole Bible ready next time, turn on “Download for offline reading” in Preferences."
          />
        )}

        {chapter.status === "ready" && me && (
          <>
            <ScriptureReader
              userId={me.userId}
              dayNumber={day}
              testament={here.testament}
              translationId={me.bibleId}
              isPastoral={me.isPastoral}
              chapters={[
                {
                  book: here.book,
                  chapter: here.chapter,
                  reference: chapter.reference,
                  html: chapter.html
                }
              ]}
            />
            <ChapterPager
              dayNumber={day}
              book={here.book}
              chapter={here.chapter}
              words={countWordsInHtml(chapter.html)}
              alreadyRead={alreadyRead}
              position={slot}
              total={slots.length}
              prevHref={prev ? `/read/${day}/${slot - 1}` : null}
              prevLabel={prev ? `${prev.book} ${prev.chapter}` : null}
              nextHref={next ? `/read/${day}/${slot + 1}` : `/day/${day}`}
              nextLabel={next ? `Next: ${next.book} ${next.chapter}` : "Finish day"}
              isLast={!next}
              canRecord={canRecord}
            />
          </>
        )}
      </main>
    </Frame>
  );
}

/** One chapter of the Bible tab. No pager, no plan day, exactly as online. */
function OfflineBibleChapter({
  me,
  bookSlug,
  chapter
}: {
  me: CachedMe | null;
  bookSlug: string;
  chapter: number;
}) {
  const book = bookBySlug(bookSlug);
  const state = useChapter(me?.bibleId ?? null, book?.slug ?? null, chapter);

  if (!book) return <OfflineNothing where={`/bible/${bookSlug}/${chapter}`} />;

  return (
    <Frame>
      <main
        data-surface="reading"
        className="max-w-3xl mx-auto px-6 pt-0 pb-10"
        {...readingAttrs(me?.prefs as unknown as Record<string, unknown>)}
      >
        <header className="pt-6">
          <Link href="/bible" className="meta">
            &larr; Bible
          </Link>
          <h1 className="reading-title mt-1">
            {book.name} {chapter}
          </h1>
        </header>

        {state.status === "loading" && <LoadingRule label="Loading the chapter saved on this device" />}

        {state.status === "unknown" && <NeverSignedIn />}

        {state.status === "none" && (
          <>
            <NotSaved
              what={`You haven’t opened ${book.name} ${chapter} on this device, and there’s no connection to fetch it.`}
            />
            <BackToPlan />
          </>
        )}

        {state.status === "ready" && me && (
          <ScriptureReader
            userId={me.userId}
            dayNumber={1}
            testament={book.testament}
            translationId={me.bibleId}
            isPastoral={me.isPastoral}
            chapters={[
              { book: book.name, chapter, reference: state.reference, html: state.html }
            ]}
          />
        )}
      </main>
    </Frame>
  );
}

// ------------------------------------------------------------------ a day

/** The day's passages. The plan is pure arithmetic in the bundle — no
    network was ever involved in knowing what day 47 is — so this is
    complete rather than a degraded copy. */
function OfflineDay({ me, day }: { me: CachedMe | null; day: number | null }) {
  const [readHere, setReadHere] = useState<Set<string>>(new Set());

  const today = me?.startDate ? currentDayNumber(me.startDate, todayISOForUser()) : null;
  const n = day ?? today;

  useEffect(() => {
    if (!n) return;
    void localReadsForDay(n).then((rows) =>
      setReadHere(new Set(rows.map((r) => `${r.book}|${r.chapter}`)))
    );
  }, [n]);

  if (!n) {
    return (
      <Frame>
        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="empty">
            <p>
              Deep Waters is offline, and this device hasn&rsquo;t saved which day
              you&rsquo;re on yet.
            </p>
            <p className="mt-2">Open the app once with a connection and it&rsquo;ll be here.</p>
          </div>
        </main>
      </Frame>
    );
  }

  const slots = daySlots(n);

  return (
    <Frame>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="meta">Day {n} of 90</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-rog-ink">
          Today&rsquo;s reading
        </h1>

        <ul className="mt-8">
          {slots.map((s) => {
            const done = readHere.has(`${s.book}|${s.chapter}`);
            return (
              <li key={s.position} className="border-t border-rog-line">
                <Link
                  href={`/read/${n}/${s.position}`}
                  className="flex items-baseline justify-between gap-3 py-4 tap-target"
                >
                  <span className="font-serif text-[17px] text-rog-ink">
                    {s.book} {s.chapter}
                  </span>
                  <span className="meta">{done ? "Read" : s.testament === "ot" ? "OT" : "NT"}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="offline-stamp mt-8">
          Anything you record now is kept on this device and sent when you&rsquo;re
          back online.
        </p>
      </main>
    </Frame>
  );
}

// ------------------------------------------------------- the cached lists

/**
 * A list that was last seen with signal.
 *
 * Read-only, always stamped with when it was fetched, and with nothing on it
 * that could be tapped to post. The composer is not disabled here — it is
 * simply not rendered, because a greyed-out box for something that cannot
 * happen is furniture asking to be pressed.
 */
function OfflineList({
  kind,
  title
}: {
  kind: "community" | "prayer" | "notifications";
  title: string;
}) {
  const [view, setView] = useState<CachedView | null | "loading">("loading");

  useEffect(() => {
    void cachedView(kind).then((v) => setView(v));
  }, [kind]);

  return (
    <Frame>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-rog-ink">{title}</h1>

        {view === "loading" && <LoadingRule label="Loading what was last saved" />}

        {view === null && (
          <div className="mt-10 empty">
            <p>Nothing saved from {title} on this device yet.</p>
            <p className="mt-2">It&rsquo;ll be here once you&rsquo;ve opened it with a connection.</p>
            <BackToPlan />
          </div>
        )}

        {view && view !== "loading" && (
          <>
            <p className="offline-stamp">
              Last updated {stamp(view.at)}. You can read this, but not post until
              you&rsquo;re back online.
            </p>
            <ul className="mt-6">
              {view.lines.map((line, i) => (
                <li key={i} className="border-t border-rog-line py-4">
                  {line.who && <p className="meta">{line.who}</p>}
                  <p className="mt-1 text-[15px] leading-6 text-rog-ink whitespace-pre-wrap">
                    {line.text}
                  </p>
                </li>
              ))}
            </ul>
            {view.lines.length === 0 && (
              <p className="mt-6 text-sm text-rog-muted">
                There was nothing here the last time this loaded.
              </p>
            )}
          </>
        )}
      </main>
    </Frame>
  );
}

function stamp(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

// ----------------------------------------------------- everything else

/** The honest answer for a screen that has nothing to show without a
    connection. Names what does work rather than only what does not. */
function OfflineNothing({ where }: { where: string }) {
  const rhapsody = where.startsWith("/rhapsody");

  return (
    <Frame>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="empty">
          {rhapsody ? (
            <>
              <p>Rhapsody needs a connection.</p>
              <p className="mt-2">
                The booklet is fetched fresh each time and the link to it expires
                after half an hour, so it can&rsquo;t be kept on the device.
              </p>
            </>
          ) : (
            <>
              <p>This screen needs a connection.</p>
              <p className="mt-2">
                Your reading, your highlights and your notes all work offline.
              </p>
            </>
          )}
          <p className="mt-6 flex gap-3">
            <Link href="/today" className="btn-primary">
              Today&rsquo;s reading
            </Link>
            <Link href="/bible" className="btn-secondary">
              Bible
            </Link>
          </p>
        </div>
      </main>
    </Frame>
  );
}
