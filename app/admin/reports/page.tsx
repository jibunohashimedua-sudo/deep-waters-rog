import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import ReportActions from "@/components/ReportActions";

export default async function AdminReportsPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, resolved, created_at, profiles(name)")
    .order("resolved")
    .order("created_at", { ascending: false })
    .limit(100);

  // Fetch target content for context
  const enriched = await Promise.all(
    (reports ?? []).map(async (r: any) => {
      let content = "";
      let author = "";
      if (r.target_type === "completion") {
        const { data } = await supabase
          .from("completions")
          .select("reflection, verse_reference, profiles(name)")
          .eq("id", r.target_id)
          .maybeSingle();
        content = data?.reflection ?? "(deleted)";
        author = (data as any)?.profiles?.name ?? "";
      } else if (r.target_type === "comment") {
        const { data } = await supabase
          .from("comments")
          .select("body, profiles(name)")
          .eq("id", r.target_id)
          .maybeSingle();
        content = data?.body ?? "(deleted)";
        author = (data as any)?.profiles?.name ?? "";
      } else if (r.target_type === "prayer") {
        const { data } = await supabase
          .from("prayer_requests")
          .select("body, profiles(name)")
          .eq("id", r.target_id)
          .maybeSingle();
        content = data?.body ?? "(deleted)";
        author = (data as any)?.profiles?.name ?? "";
      } else if (r.target_type === "testimonial") {
        const { data } = await supabase
          .from("testimonials")
          .select("body, profiles(name)")
          .eq("id", r.target_id)
          .maybeSingle();
        content = data?.body ?? "(deleted)";
        author = (data as any)?.profiles?.name ?? "";
      }
      return { ...r, content, author };
    })
  );

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="kicker">Admin</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Reports</h1>

        <div className="mt-6 space-y-3">
          {enriched.length === 0 ? (
            <p className="text-rog-muted">No reports. All clear.</p>
          ) : (
            enriched.map((r) => (
              <div key={r.id} className={`card ${r.resolved ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-rog-muted font-medium">
                    {r.target_type} by {r.author}
                  </p>
                  <p className="text-xs text-rog-muted">
                    {new Date(r.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap bg-rog-cream p-3 rounded-xl">{r.content}</p>
                <p className="mt-2 text-xs text-rog-muted">
                  Reported by {r.profiles?.name ?? "unknown"}
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
