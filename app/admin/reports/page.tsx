import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import ReportActions from "@/components/ReportActions";

type TargetType = "completion" | "comment" | "prayer" | "testimonial";

/** Which table and body column each report type points at. */
const TARGETS: Record<TargetType, { table: string; body: string }> = {
  completion: { table: "completions", body: "reflection" },
  comment: { table: "comments", body: "body" },
  prayer: { table: "prayer_requests", body: "body" },
  testimonial: { table: "testimonials", body: "body" }
};

export default async function AdminReportsPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, resolved, created_at, reporter_id")
    .order("resolved")
    .order("created_at", { ascending: false })
    .limit(100);

  if (reportsError) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] reports query failed:", reportsError.message);
  }

  const list = reports ?? [];

  // Look the targets up one table at a time rather than one report at a time.
  // Two things this avoids: the old code ran a query per report (up to 100
  // round trips), and it embedded profiles(name), which PostgREST answers with
  // HTTP 300 for completions and prayer_requests — both reach profiles by more
  // than one path, so the join is ambiguous. Plain selects have no such
  // problem, and the error was being discarded, so every reported reflection
  // and prayer was silently rendering as "(deleted)". Same fix the prayer wall
  // already carries.
  const idsByType = new Map<TargetType, string[]>();
  for (const r of list) {
    const t = r.target_type as TargetType;
    if (!TARGETS[t]) continue;
    idsByType.set(t, [...(idsByType.get(t) ?? []), r.target_id]);
  }

  const lookups = await Promise.all(
    (Object.keys(TARGETS) as TargetType[]).map(async (type) => {
      const ids = idsByType.get(type);
      if (!ids || ids.length === 0) return [type, new Map()] as const;
      const { table, body } = TARGETS[type];
      const { data, error } = await supabase
        .from(table)
        .select(`id, user_id, ${body}`)
        .in("id", ids);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[deep-waters] ${table} lookup failed:`, error.message);
      }
      const map = new Map<string, { text: string; userId: string }>();
      for (const row of (data ?? []) as any[]) {
        map.set(row.id, { text: row[body] ?? "", userId: row.user_id });
      }
      return [type, map] as const;
    })
  );
  const byType = new Map(lookups);

  // One profiles query covering both the authors and the reporters.
  const authorIds = lookups.flatMap(([, map]) =>
    Array.from(map.values()).map((v) => v.userId)
  );
  const reporterIds = list.map((r) => r.reporter_id);
  const everyone = Array.from(new Set([...authorIds, ...reporterIds].filter(Boolean)));

  const names = new Map<string, string>();
  if (everyone.length > 0) {
    const { data: profs, error: profsError } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", everyone);
    if (profsError) {
      // eslint-disable-next-line no-console
      console.error("[deep-waters] profiles lookup failed:", profsError.message);
    }
    for (const p of profs ?? []) names.set(p.id, p.name);
  }

  const enriched = list.map((r) => {
    const hit = byType.get(r.target_type as TargetType)?.get(r.target_id);
    return {
      ...r,
      content: hit?.text || "(deleted)",
      author: hit ? names.get(hit.userId) ?? "unknown" : "unknown",
      reporter: names.get(r.reporter_id) ?? "unknown"
    };
  });

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="kicker">Admin</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Reports</h1>

        {reportsError && (
          <p className="mt-6 text-sm text-danger">
            Couldn&rsquo;t load reports. Refresh to try again.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {enriched.length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">No reports.</p>
              <p className="empty-hint">Anything the community flags will land here.</p>
            </div>
          ) : (
            enriched.map((r) => (
              <div key={r.id} className={`card ${r.resolved ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-rog-muted font-medium">
                    {r.target_type} by {r.author}
                  </p>
                  <p className="text-xs text-rog-muted shrink-0">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <p className="selectable mt-2 text-sm whitespace-pre-wrap break-words surface-soft !p-3">
                  {r.content}
                </p>
                <p className="mt-2 text-xs text-rog-muted">
                  Reported by {r.reporter}
                  {r.reason && <> &bull; Reason: {r.reason}</>}
                </p>
                {!r.resolved && (
                  <div className="mt-3">
                    <ReportActions reportId={r.id} targetType={r.target_type} targetId={r.target_id} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
