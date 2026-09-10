import Link from "next/link";
import Avatar from "@/components/Avatar";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requirePrivateOwner } from "@/lib/auth";
import { currentDayNumber } from "@/lib/plan";
import { todayForCurrentRequest } from "@/lib/serverToday";

export const metadata = { title: "Private members · Deep Waters" };

/**
 * Private members — the owner's view, and only the owner's.
 *
 * Gated on ownership, never on the admin flag. requirePrivateOwner() calls
 * my_private_members(), which answers for the caller: an account that owns
 * nobody gets an empty array and this route 404s for them. The other admin
 * on this project has the same role, the same is_admin() and the same
 * everything, and typing the path gets them the same page a made-up path
 * would.
 *
 * There is no fallback to the admin flag anywhere in this file. That is
 * the whole point of it.
 */
export default async function PrivateMembersPage() {
  const { members, profile } = await requirePrivateOwner();
  const supabase = createClient();
  const today = todayForCurrentRequest();

  const ids = members.map((m) => m.user_id);

  // Three plain queries, no nested joins — this project has had HTTP 300s
  // out of ambiguous relationships, so everything is merged in code.
  const [completionsResult, notesResult, readsResult] = await Promise.all([
    supabase.from("completions").select("user_id, day_number, is_full").in("user_id", ids),
    supabase.from("verse_notes").select("user_id, updated_at").in("user_id", ids),
    supabase.from("chapter_reads").select("user_id, read_at").in("user_id", ids)
  ]);

  const countBy = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const days = countBy(
    (completionsResult.data ?? []).filter((c) => c.is_full !== false) as { user_id: string }[]
  );
  const notes = countBy(notesResult.data as { user_id: string }[] | null);
  const reads = countBy(readsResult.data as { user_id: string }[] | null);

  const lastRead = new Map<string, string>();
  for (const r of (readsResult.data ?? []) as { user_id: string; read_at: string }[]) {
    const prev = lastRead.get(r.user_id);
    if (!prev || r.read_at > prev) lastRead.set(r.user_id, r.read_at);
  }

  return (
    <>
      <Nav profile={profile} />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Private members
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          Visible to you and to nobody else on this project — not to the other
          admins, not to the pastoral team, not in Church Pulse, not in any
          number anyone else can see.
        </p>

        <div className="mt-8 space-y-2">
          {members.length === 0 && (
            <div className="empty">
              <p>Nobody yet.</p>
            </div>
          )}
          {members.map((m) => {
            const day = currentDayNumber(m.start_date, today);
            const last = lastRead.get(m.user_id);
            return (
              <Link key={m.user_id} href={`/private/${m.user_id}`} className="card flex items-center gap-3">
                <Avatar name={m.name} photoUrl={m.photo_url} size="md" decorative />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-rog-ink">
                    {m.name}
                    {m.is_pastoral && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-rog-purple font-medium">
                        Elite
                      </span>
                    )}
                  </span>
                  <span className="meta block mt-1">
                    {`Day ${day} · ${days.get(m.user_id) ?? 0} days kept · ${reads.get(m.user_id) ?? 0} chapters · ${notes.get(m.user_id) ?? 0} notes`}
                  </span>
                  <span className="meta block mt-1">
                    {last
                      ? `Last read ${new Date(last).toLocaleDateString("en-GB")}`
                      : "Not read yet"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
