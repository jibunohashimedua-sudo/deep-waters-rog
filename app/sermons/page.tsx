import Link from "next/link";
import Nav from "@/components/Nav";
import NewSermonButton from "@/components/NewSermonButton";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { readBlocks } from "@/lib/sermons";

export const metadata = { title: "Sermons · Deep Waters" };

/**
 * The pastor's own sermons, newest first.
 *
 * Gated the same way the admin pages are: someone without the flag is sent
 * to /today without being told there was anything here. RLS says the same
 * thing underneath — a sermon is readable only by the person who wrote it.
 */
export default async function SermonsPage() {
  const { userId } = await requirePastoral();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sermons")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[deep-waters] sermons list:", error.message);
  }

  const sermons = data ?? [];

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="kicker">Elite</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Sermons
        </h1>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          A title, a passage, and the blocks you have put under it. Verses sent
          here from the Bench land in your most recent draft.
        </p>

        <div className="mt-8">
          <NewSermonButton userId={userId} />
        </div>

        {sermons.length === 0 ? (
          <div className="mt-10 empty-state">
            <p className="empty-body">Nothing written yet.</p>
            <p className="empty-hint">
              Start one here, or send a verse over from the Bench and it will
              start one for you.
            </p>
          </div>
        ) : (
          <ul className="mark-list mt-8">
            {sermons.map((s) => {
              const blocks = readBlocks(s.blocks);
              return (
                <li key={s.id} className="mark-row">
                  <Link href={`/sermons/${s.id}`} className="block">
                    <span className="kicker kicker-strong block">
                      {(s.passage_ref || "No passage yet").toUpperCase()}
                    </span>
                    <span className="mark-note selectable block mt-2">
                      {s.title?.trim() || "Untitled"}
                    </span>
                    <span className="kicker block mt-2">
                      {`${s.status} · ${blocks.length} block${blocks.length === 1 ? "" : "s"} · ${new Date(
                        s.updated_at
                      ).toLocaleDateString("en-GB")}`}
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
