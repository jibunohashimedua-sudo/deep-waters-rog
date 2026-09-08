import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import SermonEditor from "@/components/SermonEditor";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { readBlocks } from "@/lib/sermons";

export const metadata = { title: "Sermon · Deep Waters" };

/** One sermon, open for editing. RLS means a row that isn't yours simply
    isn't there, which is the same answer as a sermon that never existed. */
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
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <SermonEditor
          id={data.id}
          initialTitle={data.title ?? ""}
          initialPassage={data.passage_ref ?? ""}
          initialBlocks={readBlocks(data.blocks)}
          initialStatus={data.status ?? "draft"}
          initialPreachedOn={data.preached_on ?? ""}
        />
      </main>
    </>
  );
}
