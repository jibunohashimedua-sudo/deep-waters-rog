import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookBySlug } from "@/lib/bibleBooks";
import {
  fetchChapter,
  readCachedChapters,
  liveFetchesInLastDay
} from "@/lib/bible";
import { wrapVersesInHtml } from "@/lib/verseParse";
import { resolveTranslation, TRANSLATIONS } from "@/lib/translations";

/**
 * Many chapters at once, for the offline download.
 *
 * The sibling of /api/bible/chapter, and the reason it exists is arithmetic.
 * A whole Bible is 1,189 chapters. Asking for them one at a time down the
 * single-chapter endpoint would be 1,189 auth round trips and 1,189
 * `bible_cache` queries to answer a request the reader made once, and the
 * auth check alone would be most of the wall-clock time. Twenty-five to a
 * request makes it forty-eight round trips.
 *
 * THE BUDGET, AND WHY THERE IS ONE.
 *
 * API.Bible's key is rate limited and there is one of it for the whole
 * church. Chapters already in `bible_cache` cost nothing upstream — one
 * member warming a chapter warms it for everybody, which is the whole design
 * of that table. But a chapter nobody has ever opened has to be fetched, and
 * a cold full-Bible download is over a thousand of those. Two or three
 * members starting one on the same evening could spend the day's whole quota
 * between them, and every other member would open their reading to "We've
 * hit today's limit for loading scripture" — a feature almost nobody uses
 * taking the app away from everybody who does.
 *
 * So this endpoint will spend cache hits freely and live fetches only up to
 * a ceiling, measured across the whole church over a rolling day. Above it,
 * the batch returns what is cached, says `paused`, and the download stops
 * and picks up tomorrow. Nobody is refused scripture so that somebody else
 * can have it in advance.
 */

/** Chapters per request. Small enough that a batch is quick on a phone's
    connection and a cancel takes effect promptly; large enough that the
    auth check is amortised over real work. */
const MAX_PER_REQUEST = 25;

/**
 * Live API.Bible fetches allowed across the church in a rolling 24 hours,
 * from the download and from ordinary reading together.
 *
 * Set below the key's daily allowance on purpose, so that reaching it slows
 * a download rather than breaking the app. Overridable per deployment
 * because the allowance depends on the plan the key is on.
 */
const DAILY_LIVE_BUDGET = Number(process.env.BIBLE_DAILY_FETCH_BUDGET ?? 3000);

type Ask = { book: string; chapter: number };

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You are not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bibleId = typeof body?.bible === "string" ? body.bible : "";
  const asked: unknown = body?.chapters;

  // Same guard as the single-chapter endpoint: an arbitrary id here would
  // be a free proxy onto API.Bible with our key on it.
  if (!TRANSLATIONS.some((t) => t.id === bibleId)) {
    return NextResponse.json({ error: "No such translation" }, { status: 400 });
  }
  if (!Array.isArray(asked) || asked.length === 0) {
    return NextResponse.json({ error: "Nothing asked for" }, { status: 400 });
  }
  if (asked.length > MAX_PER_REQUEST) {
    return NextResponse.json(
      { error: `At most ${MAX_PER_REQUEST} chapters at a time` },
      { status: 400 }
    );
  }

  // Every reference checked against the real book list before anything is
  // fetched, so a malformed batch is refused rather than half-served.
  const refs: { slug: string; abbr: string; name: string; chapter: number; resolved: string }[] = [];
  for (const raw of asked as Ask[]) {
    const book = bookBySlug(typeof raw?.book === "string" ? raw.book : "");
    const chapter = Number(raw?.chapter);
    if (!book || !Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
      return NextResponse.json({ error: "No such chapter" }, { status: 400 });
    }
    refs.push({
      slug: book.slug,
      abbr: book.abbr,
      name: book.name,
      chapter,
      // Per-book fallback, exactly as every other reading surface resolves
      // it: a translation that doesn't carry this book falls back to the
      // King James rather than leaving a hole in the download.
      resolved: resolveTranslation(bibleId, book.abbr, book.name).id
    });
  }

  // One query for the whole batch, grouped by whichever translation each
  // reference actually resolved to.
  const byTranslation = new Map<string, typeof refs>();
  for (const ref of refs) {
    const list = byTranslation.get(ref.resolved) ?? [];
    list.push(ref);
    byTranslation.set(ref.resolved, list);
  }

  const cached = new Map<string, { reference: string; content: string }>();
  await Promise.all(
    Array.from(byTranslation.entries()).map(async ([id, list]) => {
      const hits = await readCachedChapters(
        id,
        list.map((r) => ({ book: r.abbr, chapter: r.chapter }))
      );
      for (const [key, text] of hits) cached.set(`${id}|${key}`, text);
    })
  );

  const misses = refs.filter((r) => !cached.has(`${r.resolved}|${r.abbr}.${r.chapter}`));

  // What the church has spent today, and therefore how many of this batch's
  // misses may be fetched live. Unknown counts as none — see the note on
  // liveFetchesInLastDay.
  let allowance = 0;
  if (misses.length > 0) {
    const spent = await liveFetchesInLastDay();
    allowance = spent === null ? 0 : Math.max(0, DAILY_LIVE_BUDGET - spent);
  }
  const toFetch = misses.slice(0, allowance);
  const paused = misses.length > toFetch.length;

  // Sequential, not parallel. Twenty-five simultaneous requests at a
  // rate-limited key is how a download turns into a 429 for the whole
  // church; and the reader is not watching this, so it does not need to be
  // quick, only steady.
  const fetched = new Map<string, { reference: string; content: string }>();
  for (const ref of toFetch) {
    const outcome = await fetchChapter(ref.abbr, ref.chapter, ref.resolved);
    if (!outcome.ok) {
      // Rate limited upstream despite our own budget — stop the whole batch
      // rather than push through the remaining twenty-four.
      if (outcome.kind === "rate-limit") {
        return NextResponse.json({
          ok: true,
          paused: true,
          reason: "rate-limit",
          chapters: serialise(refs, cached, fetched)
        });
      }
      // A chapter this translation doesn't carry, or a bad moment upstream.
      // Skipped: one absent chapter is not a reason to fail the batch.
      continue;
    }
    fetched.set(`${ref.resolved}|${ref.abbr}.${ref.chapter}`, outcome.chapter);
  }

  return NextResponse.json({
    ok: true,
    paused,
    reason: paused ? "budget" : null,
    chapters: serialise(refs, cached, fetched)
  });
}

/** Marked up exactly as the reading page's own server render marks it up,
    so a chapter that arrives here and the same chapter opened on its own
    can never disagree. Same call, same function, as /api/bible/chapter. */
function serialise(
  refs: { slug: string; abbr: string; chapter: number; resolved: string }[],
  cached: Map<string, { reference: string; content: string }>,
  fetched: Map<string, { reference: string; content: string }>
) {
  const out: {
    book: string;
    chapter: number;
    reference: string;
    html: string;
    resolvedId: string;
  }[] = [];
  for (const ref of refs) {
    const key = `${ref.resolved}|${ref.abbr}.${ref.chapter}`;
    const text = cached.get(key) ?? fetched.get(key);
    if (!text) continue;
    out.push({
      book: ref.slug,
      chapter: ref.chapter,
      reference: text.reference,
      html: wrapVersesInHtml(text.content),
      resolvedId: ref.resolved
    });
  }
  return out;
}
