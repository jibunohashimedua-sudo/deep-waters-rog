import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { READING_PLAN, formatReading } from "@/lib/plan";
import NoteEditor from "@/components/NoteEditor";

export default async function EditNotePage({ params }: { params: { day: string } }) {
  await requireAdmin();
  const day = Number(params.day);
  if (!Number.isInteger(day) || day < 1 || day > 90) notFound();

  const supabase = createClient();
  const { data: note } = await supabase
    .from("study_notes")
    .select("title, body")
    .eq("day_number", day)
    .maybeSingle();

  const reading = READING_PLAN[day - 1];

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* The app bar's arrow climbs to /admin/notes. */}
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Study note</h2>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Day {day}</h1>
        <p className="mt-2 text-sm text-rog-muted">
          OT: {formatReading(reading.ot)}
          <br />
          NT: {formatReading(reading.nt)}
        </p>

        <div className="mt-6">
          <NoteEditor day={day} initialTitle={note?.title ?? ""} initialBody={note?.body ?? ""} />
        </div>

        <div className="mt-6 flex justify-between text-sm">
          {day > 1 ? (
            <Link href={`/admin/notes/${day - 1}`} className="text-rog-purple">&larr; Day {day - 1}</Link>
          ) : <span />}
          {day < 90 ? (
            <Link href={`/admin/notes/${day + 1}`} className="text-rog-purple">Day {day + 1} &rarr;</Link>
          ) : <span />}
        </div>
      </main>
    </>
  );
}
