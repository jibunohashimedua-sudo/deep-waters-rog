import Link from "next/link";
import Nav from "@/components/Nav";
import NewSermonButton from "@/components/NewSermonButton";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { sermonTitle } from "@/lib/sermons";
import { humanDate } from "@/lib/dates";

export const metadata = { title: "Sermons · Deep Waters" };

/** What the list actually renders. Note what is not here: `blocks`. */
const LIST_COLUMNS = "id, title, passage_ref, status, updated_at, block_count";
const LIST_COLUMNS_WITHOUT_COUNT = "id, title, passage_ref, status, updated_at";

type Row = {
  id: string;
  title: string | null;
  passage_ref: string | null;
  status: string | null;
  updated_at: string;
  block_count?: number | null;
};

/**
 * The pastor's own sermons, newest first.
 *
 * Gated the same way the admin pages are: someone without the flag is sent
 * to /today without being told there was anything here. RLS says the same
 * thing underneath — a sermon is readable only by the person who wrote it.
 *
 * The query names its columns. It used to be `select("*")`, which shipped
 * every block of every sermon so the page could print `blocks.length` —
 * a whole sermon's body per row, to render a number. `block_count` is a
 * generated column (2026_09_15_sermon_block_count.sql) and the bodies stay
 * in the database. ELITE_EXCELLENCE_AUDIT P1-B.
 */
export default async function SermonsPage() {
  const { userId } = await requirePastoral();
  const supabase = createClient();

  const withCount = await supabase
    .from("sermons")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  let sermons = (withCount.data ?? []) as Row[];

  // Between a deploy and its migration the column is not there yet, and a
  // named select for a column that does not exist is a 400 that would take
  // the whole list down with it. Same reasoning as Nav's `*` on profiles.
  // The list is worth more than the count.
  if (withCount.error) {
    console.error("[deep-waters] sermons list:", withCount.error.message);
    const fallback = await supabase
      .from("sermons")
      .select(LIST_COLUMNS_WITHOUT_COUNT)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (fallback.error) {
      console.error("[deep-waters] sermons list fallback:", fallback.error.message);
    }
    sermons = (fallback.data ?? []) as Row[];
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Sermons
        </h1>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          A title, and the scriptures, headings and notes you have gathered
          under it. Tap one to preach from it.
        </p>

        <div className="mt-8">
          <NewSermonButton />
        </div>

        {sermons.length === 0 ? (
          <div className="mt-10 empty">
            <p>Nothing written yet.</p>
          </div>
        ) : (
          <ul className="mark-list mt-8">
            {sermons.map((s) => {
              const count = typeof s.block_count === "number" ? s.block_count : null;
              const date = humanDate(s.updated_at);
              return (
                <li key={s.id} className="mark-row">
                  <Link href={`/sermons/${s.id}`} className="block">
                    {/* The title leads. It used to be the passage, in
                        caps, above the title — which put the one thing
                        that might not be there above the one thing that
                        always is. */}
                    <span className="mark-note selectable block">
                      {sermonTitle(s.title)}
                    </span>
                    <span className="meta block mt-2">
                      {[
                        s.passage_ref,
                        s.status === "preached" ? "Preached" : null,
                        count === null
                          ? null
                          : `${count} block${count === 1 ? "" : "s"}`,
                        date
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
