import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { longDate } from "@/lib/rhapsody";
import { todayISOForUser } from "@/lib/dates";
import { tzForCurrentRequest } from "@/lib/serverToday";
import Nav from "@/components/Nav";

// A fresh signed link every visit, so this page can never be cached. The
// signed URL itself is minted at click time now — see `/api/rhapsody/pdf`.
export const dynamic = "force-dynamic";

export default async function RhapsodyPage() {
  // requireProfile redirects to /login when signed out, so nothing below
  // this line ever runs for a stranger.
  const { profile } = await requireProfile();
  const supabase = createClient();

  // Reader's own timezone. Without the cookie (first paint of a fresh
  // session) this falls back to UTC — a reader in Asia at 04:00 local can
  // see yesterday's article until the cookie is set on the next request.
  const date = todayISOForUser(tzForCurrentRequest());

  // Two plain queries, merged here. No nested select: this project has been
  // bitten by ambiguous-relationship errors from PostgREST joins.
  const { data: entry, error: entryError } = await supabase
    .from("rhapsody_days")
    .select("edition_id, title, page_number, verse_text, body, prayer, prayer_label")
    .eq("date", date)
    .maybeSingle();

  // We only need to know a PDF exists — the actual signed URL is minted at
  // click time by /api/rhapsody/pdf. A 30-minute signed URL minted at page
  // render meant a reader who lingered got a fresh 403 in a new tab.
  let hasPdf = false;
  let editionError: string | null = null;
  if (entry?.edition_id) {
    const { data, error } = await supabase
      .from("rhapsody_editions")
      .select("id")
      .eq("id", entry.edition_id)
      .maybeSingle();
    hasPdf = !!data;
    editionError = error?.message ?? null;
  }

  const problem = entryError?.message ?? editionError;
  if (problem) console.error("[deep-waters] rhapsody reader:", problem);

  const rawBody: string = entry?.body ?? "";
  const paragraphs = rawBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  // The `page` param lets /api/rhapsody/pdf append `#page=N` to the signed
  // URL's Location header, so the reader lands on the mapped article page
  // rather than the front cover.
  const pdfHref = hasPdf
    ? `/api/rhapsody/pdf?page=${entry?.page_number ?? 1}`
    : null;

  return (
    <>
      <Nav profile={profile} />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
        {/* No "back to day N" link here: the app bar's arrow already goes
            there, and two back controls on one screen is a question the
            screen shouldn't be asking. */}
        <p className="chapter-mark accent-pink">Rhapsody of Realities</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-normal text-rog-ink leading-tight">
          {entry?.title?.trim() || "Today’s article"}
        </h1>
        <p className="mt-2 text-sm text-rog-muted">{longDate(date)}</p>

        {!entry && !problem && (
          <div className="mt-16 card empty">
            <p>No Rhapsody article has been set for today yet.</p>
          </div>
        )}

        {problem && (
          <div className="mt-16 card empty">
            <p>Today&rsquo;s Rhapsody couldn&rsquo;t be opened.</p>
          </div>
        )}

        {/* The opening scripture, set apart from the article the way it is
            in the devotional itself. */}
        {entry?.verse_text?.trim() && (
          <blockquote className="mt-10 surface-soft selectable">
            <p className="scripture-prose text-lg leading-relaxed text-rog-ink">
              {entry.verse_text.trim()}
            </p>
          </blockquote>
        )}

        {/* The article. Same serif, same measure, same rhythm as scripture —
            it's meant to be read, not viewed. */}
        {paragraphs.length > 0 && (
          <div className="mt-10 bible-content selectable">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {entry?.prayer?.trim() && (
          <div className="mt-16 surface-soft selectable">
            <p className="chapter-mark accent-pink">
              {entry.prayer_label?.trim() || "Prayer"}
            </p>
            <p className="mt-3 font-serif text-base leading-relaxed text-rog-ink">
              {entry.prayer.trim()}
            </p>
          </div>
        )}

        {/* Nothing to read means the text hasn't been pulled in yet — the PDF
            is still there, so send them to it rather than to an empty page. */}
        {entry && paragraphs.length === 0 && pdfHref && (
          <div className="mt-10 card empty">
            <p>Today&rsquo;s article hasn&rsquo;t been typed up yet.</p>
          </div>
        )}

        {/* Only the booklet link at the foot. Getting back to Today is the
            app bar's chevron — one back control per page. */}
        {entry && pdfHref && (
          <div className="mt-16">
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center"
            >
              Open the original booklet
            </a>
          </div>
        )}

        <p className="mt-10 text-xs text-rog-muted leading-relaxed max-w-prose">
          Shared with our church members only. Please don&rsquo;t forward or
          redistribute it &mdash; every member can open it here for themselves.
        </p>
      </main>
    </>
  );
}
