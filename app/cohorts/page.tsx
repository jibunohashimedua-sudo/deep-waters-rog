import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function CohortsPage() {
  const supabase = createClient();
  const { data: cohorts } = await supabase.from("cohort_summary").select("*");

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="kicker">Groups</p>
            <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Cohorts</h1>
            <p className="mt-2 text-sm text-rog-muted">
              Groups starting Deep Waters together. Share a link to invite.
            </p>
          </div>
          <Link href="/cohorts/new" className="btn-primary">
            + New cohort
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {!cohorts || cohorts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-mark" aria-hidden>
                <svg width="44" height="20" viewBox="0 0 44 20" fill="none">
                  <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <circle cx="22" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <circle cx="34" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                </svg>
              </span>
              <p className="empty-body">No cohorts yet.</p>
              <p className="empty-hint">Anyone can start one.</p>
            </div>
          ) : (
            cohorts.map((c: any) => {
              const startDate = new Date(c.start_date);
              const today = new Date();
              const daysUntil = Math.ceil(
                (startDate.getTime() - today.getTime()) / 86400000
              );
              const status =
                daysUntil > 0
                  ? `Starts in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
                  : daysUntil === 0
                  ? "Starts today"
                  : `Day ${Math.min(90, Math.abs(daysUntil) + 1)} in progress`;
              return (
                <Link
                  key={c.id}
                  href={`/c/${c.slug}`}
                  className="card block hover:border-rog-purple transition"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-rog-purple text-lg">{c.name}</p>
                      <p className="text-xs text-rog-muted mt-1">
                        {status} &bull; {c.member_count} member
                        {c.member_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-xs text-rog-muted font-medium uppercase tracking-[0.2em]">
                      View &rarr;
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
