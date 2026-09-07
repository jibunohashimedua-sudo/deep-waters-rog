import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { currentDayNumber } from "@/lib/plan";
import { todayISO, longDate } from "@/lib/rhapsody";
import Nav from "@/components/Nav";

// The signed link is minted per request, so this page can never be cached.
export const dynamic = "force-dynamic";

/** How long a signed link stays good. Long enough to read the article,
 *  short enough that a copied URL is worthless by the time it travels. */
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
    .select("edition_id, title, page_number")
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

  // The signed link is made with the service role, so the bucket needs no
  // read policy at all and the storage path never reaches the browser.
  let signedUrl: string | null = null;
  let signError: string | null = null;
  if (edition?.file_path) {
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

  const page = entry?.page_number ?? 1;
  // #page= is understood by the built-in PDF viewers in Chrome, Edge, Firefox
  // and desktop Safari. Where it isn't (iOS Safari), the page number is
  // printed under the heading so it can be turned to by hand.
  const viewerUrl = signedUrl ? `${signedUrl}#page=${page}&view=FitH` : null;

  return (
    <>
      <Nav />
      <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/today" className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; Back to Day {day}
        </Link>

        <div className="select-none">
          <p className="mt-10 chapter-mark accent-pink">
            Rhapsody of Realities &middot; {longDate(date)}
          </p>
          <h1 className="mt-3 font-serif text-3xl md:text-4xl font-normal text-rog-ink leading-tight">
            {entry?.title?.trim() || "Today’s article"}
          </h1>
          {entry && edition && (
            <p className="mt-2 text-sm text-rog-muted">
              {edition.title} &middot; page {page}
            </p>
          )}
        </div>

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

        {viewerUrl && (
          <>
            {/* The browser's own PDF viewer. No library: an <iframe> is what
                every phone and desktop already knows how to render. */}
            <div className="mt-10 rounded-3xl overflow-hidden border border-rog-line">
              <iframe
                src={viewerUrl}
                title={`Rhapsody of Realities — ${longDate(date)}`}
                className="w-full block h-[70vh] min-h-[420px] bg-white"
              />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href={viewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 text-center"
              >
                Open full screen
              </a>
              <Link href="/today" className="btn-primary flex-1 text-center">
                Back to today
              </Link>
            </div>
          </>
        )}

        <p className="mt-10 text-xs text-rog-muted leading-relaxed max-w-prose">
          Shared with our church members only. Please don&rsquo;t forward, download
          or redistribute it &mdash; every member can open it here for themselves.
        </p>
      </main>
    </>
  );
}
