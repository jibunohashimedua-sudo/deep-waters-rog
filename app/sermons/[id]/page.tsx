import { notFound } from "next/navigation";
import SermonReader from "@/components/SermonReader";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { readBlocks, type SermonStatus } from "@/lib/sermons";

export const metadata = { title: "Sermon · Deep Waters" };

/**
 * One sermon, open to be preached from.
 *
 * Tapping a sermon used to open the editor, which is the wrong door: a
 * sermon is written a few times and read once, standing up, and the
 * writing tools were in the way of the reading. The editor is one tap
 * further in, behind the three dots.
 *
 * No Nav. This page is the whole screen — an app bar over a sermon being
 * preached is furniture, and the way back is in the header.
 *
 * RLS means a row that isn't yours simply isn't there, which is the same
 * answer as a sermon that never existed.
 */
export default async function SermonPage({ params }: { params: { id: string } }) {
  const { userId } = await requirePastoral();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sermons")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[deep-waters] sermon lookup:", error.message);
  }
  if (!data) notFound();

  return (
    <main className="sermon-read-page">
      <SermonReader
        id={data.id}
        title={data.title ?? ""}
        passage={data.passage_ref ?? null}
        status={(data.status ?? "draft") as SermonStatus}
        preachedOn={data.preached_on ?? null}
        blocks={readBlocks(data.blocks)}
      />
    </main>
  );
}
