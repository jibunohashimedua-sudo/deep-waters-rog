import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  READING_PLAN,
  currentDayNumber,
  formatReading,
  buildPassageIds
} from "@/lib/plan";
import { fetchChapters } from "@/lib/bible";
import Nav from "@/components/Nav";

export default async function ReadPage({
  searchParams
}: {
  searchParams: { t?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("start_date")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const day = currentDayNumber(profile.start_date);
  const reading = READING_PLAN[day - 1];
  const testament = searchParams.t === "nt" ? "nt" : "ot";
  const chapters = testament === "ot" ? reading.ot : reading.nt;
  const label = testament === "ot" ? "Old Testament" : "New Testament";
  const reference = formatReading(chapters);
  const chapterIds = buildPassageIds(chapters);
  const chapterContent = await fetchChapters(chapterIds);

  const otherT = testament === "ot" ? "nt" : "ot";
  const otherLabel = testament === "ot" ? "New Testament" : "Old Testament";

  const { data: note } = await supabase
    .from("study_notes")
    .select("title, body")
    .eq("day_number", day)
    .maybeSingle();

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/today" className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; Back to Day {day}
        </Link>
        <p className="mt-4 kicker">Day {day} &bull; {label}</p>
        <h1 className="mt-1 text-3xl font-bold text-rog-purple">{reference}</h1>

        {note?.body && testament === "ot" && (
          <div className="mt-6 card border-rog-pink border-2 bg-white">
            <p className="kicker">Study note from ROG</p>
            {note.title && <p className="mt-1 font-bold text-rog-purple text-lg">{note.title}</p>}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {chapterContent.map((c) => (
            <article key={c.reference} className="card">
              <h2 className="text-lg font-bold text-rog-purple mb-3">
                {c.reference}
              </h2>
              <div
                className="bible-content prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: c.content }}
              />
            </article>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <Link href={`/read?t=${otherT}`} className="btn-secondary flex-1">
            Read {otherLabel}
          </Link>
          <Link href="/today" className="btn-primary flex-1">
            Mark day complete
          </Link>
        </div>
      </main>
    </>
  );
}
