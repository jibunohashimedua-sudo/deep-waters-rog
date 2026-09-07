import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { currentDayNumber } from "@/lib/plan";
import { todayISO, longDate } from "@/lib/rhapsody";
import Nav from "@/components/Nav";

// A fresh signed link every visit, so this page can never be cached.
export const dynamic = "force-dynamic";

/** How long the link to the original PDF stays good. */
const LINK_TTL_SECONDS = 30 * 60;

export default async function RhapsodyPage() {
  // requireProfile redirects to /login when signed out, so nothing below
  // this line ever runs for a stranger.
  const { profile } = await requireProfile();
  const supabase = createClient();

  const day = currentDayNumber(profile.start_date);
  const date = todayISO();

  // Two plain queries, merged here. No nested select: this project has been
  // bitten by ambiguous-relationship errors from PostgREST joins.
  const { data: entry, error: entryError } = await supabase
    .from("rhapsody_days")
    .select("edition_id, title, page_number, verse_text, body, prayer, prayer_label")
    .eq("date", date)
    .maybeSingle();

  let edition: { title: string; file_path: string } | null = null;
  let editionError: string | null = null;
  if (entry?.edition_id) {
    const { data, error } = await supabase
      .from("rhapsody_editions")
      .select("title, file_path")
      .eq("id", entry.edition_id)
      .maybeSingle();
    edition = data ?? null;
    editionError = error?.message ?? null;
  }

  // The link to the original PDF is signed with the service role, so the
  // bucket needs no read policy at all and the storage path never reaches
  // the browser. Only made when there's an article to go with it.
  let signedUrl: string | null = null;
  let signError: string | null = null;
  if (entry && edition?.file_path) {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await service.storage
      .from("rhapsody")
      .createSignedUrl(edition.file_path, LINK_TTL_SECONDS);
    signedUrl = data?.signedUrl ?? null;
    signError = error?.message ?? null;
  }

  const problem = entryError?.message ?? editionError ?? signError;
  if (problem) console.error("[deep-waters] rhapsody reader:", problem);

  const rawBody: string = entry?.body ?? "";
  const paragraphs = rawBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pdfUrl = signedUrl ? `${signedUrl}#page=${entry?.page_number ?? 1}` : null;

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/today" className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; Back to Day {day}
        </Link>

        <p className="mt-10 chapter-mark accent-pink">Rhapsody of Realities</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-normal text-rog-ink leading-tight">
          {entry?.title?.trim() || "Today’s article"}
        </h1>
        <p className="mt-2 text-sm text-rog-muted">{longDate(date)}</p>

        {!entry && !problem && (
          <div className="mt-16 card empty-state">
            <p className="empty-body">No Rhapsody article has been set for today yet.</p>
            <p className="empty-hint">
              Your Old and New Testament readings are waiting on the Today page.
            </p>
          </div>
        )}

        {problem && (
          <div className="mt-16 card empty-state">
            <p className="empty-body">Today&rsquo;s Rhapsody couldn&rsquo;t be opened.</p>
            <p className="empty-hint">
              Try again in a moment. If it keeps happening, tell an admin.
            </p>
          </div>
        )}

        {/* The opening scripture, set apart from the article the way it is
            in the devotional itself. */}
        {entry?.verse_text?.trim() && (
          <blockquote className="mt-10 surface-soft selectable">
            <p className="font-serif text-lg leading-relaxed text-rog-ink italic">
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
        {entry && paragraphs.length === 0 && pdfUrl && (
          <div className="mt-10 card empty-state">
            <p className="empty-body">Today&rsquo;s article hasn&rsquo;t been typed up yet.</p>
            <p className="empty-hint">You can still read it in the original booklet below.</p>
          </div>
        )}

        {entry && (
          <div className="mt-16 flex flex-col sm:flex-row gap-3">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 text-center"
              >
                Open the original booklet
              </a>
            )}
            <Link href="/today" className="btn-primary flex-1 text-center">
              Back to today
            </Link>
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
