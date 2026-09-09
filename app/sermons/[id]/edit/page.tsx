import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import SermonEditor from "@/components/SermonEditor";
import { createClient } from "@/lib/supabase/server";
import { requirePastoral } from "@/lib/auth";
import { readBlocks, sermonTitle } from "@/lib/sermons";

export const metadata = { title: "Editing a sermon · Deep Waters" };

/** The sermon, open for writing. One tap in from the read view, which is
    the page it is actually used from. */
export default async function SermonEditPage({
  params
}: {
  params: { id: string };
}) {
  const { userId, profile } = await requirePastoral();
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
        <Link href={`/sermons/${data.id}`} className="meta">
          {sermonTitle(data.title)}
        </Link>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-rog-ink leading-tight">
          Editing
        </h1>

        <SermonEditor
          id={data.id}
          initialTitle={data.title ?? ""}
          initialPassage={data.passage_ref ?? ""}
          initialBlocks={readBlocks(data.blocks)}
          initialStatus={data.status ?? "draft"}
          initialPreachedOn={data.preached_on ?? ""}
          translationId={profile.preferred_bible_id ?? null}
        />
      </main>
    </>
  );
}
