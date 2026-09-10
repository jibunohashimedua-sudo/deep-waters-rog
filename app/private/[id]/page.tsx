import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requirePrivateOwner } from "@/lib/auth";
import { READING_PLAN, currentDayNumber, formatReading } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";

export const metadata = { title: "Private member · Deep Waters" };

type Params = { params: { id: string } };

/**
 * One private member: his reading, his notes, his activity.
 *
 * Two gates, both ownership. requirePrivateOwner() 404s an account that
 * owns nobody, and the id in the path has to be one of the people this
 * account actually owns — otherwise this page would be a way for the owner
 * of one private member to read another's. There is one today; there is no
 * reason to write it so there can only ever be one.
 */
export default async function PrivateMemberPage({ params }: Params) {
  const { members, profile } = await requirePrivateOwner();
  const member = members.find((m) => m.user_id === params.id);
  if (!member) notFound();

  const supabase = createClient();
  const today = todayForCurrentRequest();
  const day = currentDayNumber(member.start_date, today);

  const [completionsResult, notesResult, highlightsResult, readsResult, sermonsResult] =
    await Promise.all([
      supabase
        .from("completions")
        .select("id, day_number, verse_reference, verse_text, reflection, completed_at, is_full")
        .eq("user_id", params.id)
        .order("day_number", { ascending: false }),
      supabase
        .from("verse_notes")
        .select("id, book, chapter, verse_start, verse_end, body, updated_at")
        .eq("user_id", params.id)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("highlights")
        .select("id, book, chapter, verse_start, verse_end, colour, created_at")
        .eq("user_id", params.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("chapter_reads")
        .select("id, day_number, book, chapter, read_at")
        .eq("user_id", params.id)
        .order("read_at", { ascending: false })
        .limit(200),
      supabase
        .from("sermons")
        .select("id, title, passage_ref, status, updated_at")
        .eq("user_id", params.id)
        .order("updated_at", { ascending: false })
        .limit(50)
    ]);

  // Errors are logged rather than dropped: a page that renders an empty
  // list on a failed query tells the reader there is nothing there, which
  // is a worse lie than saying the list wouldn't load.
  for (const [label, r] of [
    ["completions", completionsResult],
    ["verse_notes", notesResult],
    ["highlights", highlightsResult],
    ["chapter_reads", readsResult],
    ["sermons", sermonsResult]
  ] as const) {
    if (r.error) {
      // eslint-disable-next-line no-console
      console.error(`[deep-waters] private member ${label}:`, r.error.message);
    }
  }

  const completions = completionsResult.data ?? [];
  const notes = notesResult.data ?? [];
  const highlights = highlightsResult.data ?? [];
  const reads = readsResult.data ?? [];
  const sermons = sermonsResult.data ?? [];

  const kept = completions.filter((c) => c.is_full !== false).length;
  const written = completions.filter((c) => (c.reflection ?? "").trim() !== "");
  const lastActivity =
    [
      reads[0]?.read_at,
      completions[0]?.completed_at,
      notes[0]?.updated_at,
      sermons[0]?.updated_at
    ]
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  const ref = (n: { book: string; chapter: number; verse_start: number; verse_end: number }) =>
    `${n.book} ${n.chapter}:${n.verse_end > n.verse_start ? `${n.verse_start}–${n.verse_end}` : n.verse_start}`.toUpperCase();

  return (
    <>
      <Nav profile={profile} />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} photoUrl={member.photo_url} size="lg" decorative />
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
              {member.name}
            </h1>
            <p className="meta mt-1">
              {`Day ${day} · ${kept} of 90 kept · ${reads.length} chapters ticked`}
            </p>
            <p className="meta mt-1">
              {lastActivity
                ? `Last activity ${new Date(lastActivity).toLocaleString("en-GB")}`
                : "No activity yet"}
            </p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Reading</h2>
          {completions.length === 0 ? (
            <p className="mt-4 font-serif text-[17px] text-rog-muted">Nothing kept yet.</p>
          ) : (
            <ul className="mark-list mt-4">
              {completions.slice(0, 30).map((c) => (
                <li key={c.id} className="mark-row">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {`Day ${c.day_number} · ${formatReading(READING_PLAN[c.day_number - 1].ot)}, ${formatReading(READING_PLAN[c.day_number - 1].nt)}`}
                  </span>
                  <span className="meta block mt-1">
                    {`${c.is_full === false ? "Part read" : "Read"} · ${new Date(c.completed_at).toLocaleDateString("en-GB")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">
            What he wrote
          </h2>
          {written.length === 0 ? (
            <p className="mt-4 font-serif text-[17px] text-rog-muted">Nothing written yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {written.map((c) => (
                <li key={c.id} className="card">
                  <p className="meta">{`Day ${c.day_number}${c.verse_reference ? ` · ${c.verse_reference}` : ""}`}</p>
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-rog-ink whitespace-pre-wrap">
                    {c.reflection}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">His notes</h2>
          {notes.length === 0 ? (
            <p className="mt-4 font-serif text-[17px] text-rog-muted">No notes yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="card">
                  <p className="meta">{ref(n)}</p>
                  <p className="mt-2 font-serif text-[15px] leading-relaxed text-rog-ink whitespace-pre-wrap">
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">
            Marked verses
          </h2>
          {highlights.length === 0 ? (
            <p className="mt-4 font-serif text-[17px] text-rog-muted">Nothing marked yet.</p>
          ) : (
            <ul className="mark-list mt-4">
              {highlights.map((h) => (
                <li key={h.id} className="mark-row">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {ref(h)}
                  </span>
                  <span className="meta block mt-1">
                    {`${h.colour} · ${new Date(h.created_at).toLocaleDateString("en-GB")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sermons.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">
              Sermon desk
            </h2>
            <ul className="mark-list mt-4">
              {sermons.map((s) => (
                <li key={s.id} className="mark-row">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {s.title || "Untitled"}
                  </span>
                  <span className="meta block mt-1">
                    {`${s.passage_ref ?? "No passage"} · ${s.status} · ${new Date(s.updated_at).toLocaleDateString("en-GB")}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">
            Chapters ticked
          </h2>
          {reads.length === 0 ? (
            <p className="mt-4 font-serif text-[17px] text-rog-muted">Nothing ticked yet.</p>
          ) : (
            <ul className="mark-list mt-4">
              {reads.slice(0, 40).map((r) => (
                <li key={r.id} className="mark-row">
                  <span className="block text-[13.5px] leading-5 font-medium text-rog-ink">
                    {`${r.book} ${r.chapter}`.toUpperCase()}
                  </span>
                  <span className="meta block mt-1">
                    {`Day ${r.day_number} · ${new Date(r.read_at).toLocaleDateString("en-GB")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
