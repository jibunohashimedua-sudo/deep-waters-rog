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
        <p className="mt-6 chapter-mark">Day {day} &middot; {label}</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-normal text-rog-ink leading-tight">
          {reference}
        </h1>

        {note?.body && testament === "ot" && (
          <div className="mt-8 card border-rog-pink border-2 bg-white">
            <p className="kicker">Study note</p>
            {note.title && <p className="mt-1 font-bold text-rog-purple text-lg">{note.title}</p>}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{note.body}</p>
          </div>
        )}

        <div className="mt-14 space-y-14">
          {chapterContent.map((c, i) => (
            <article key={c.reference}>
              <p className="chapter-mark mb-5">{c.reference}</p>
              <div
                className="bible-content"
                dangerouslySetInnerHTML={{ __html: c.content }}
              />
              {i < chapterContent.length - 1 && (
                <div className="mt-14 flex justify-center" aria-hidden="true">
                  <span className="block h-px w-16 bg-rog-line/70" />
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="mt-16 flex gap-3">
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
