import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { READING_PLAN, formatReading } from "@/lib/plan";

export default async function AdminNotesPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: notes } = await supabase.from("study_notes").select("day_number, title, body");
  const written = new Map((notes ?? []).map((n) => [n.day_number, n]));

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="kicker">Admin</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Study notes</h1>
        <p className="mt-2 text-sm text-rog-muted">
          {written.size} of 90 written. Notes appear on each day&rsquo;s reading page.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
          {READING_PLAN.map((d) => {
            const n = written.get(d.day);
            const has = !!(n?.body && n.body.trim());
            return (
              <Link
                key={d.day}
                href={`/admin/notes/${d.day}`}
                className={`card hover:border-rog-purple transition flex items-center gap-3 !py-3 ${
                  has ? "" : "!border-dashed"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    has ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-muted"
                  }`}
                >
                  {d.day}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-rog-ink truncate">
                    {n?.title || `Day ${d.day}`}
                  </p>
                  <p className="text-[11px] text-rog-muted truncate">
                    {formatReading(d.ot)}, {formatReading(d.nt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
