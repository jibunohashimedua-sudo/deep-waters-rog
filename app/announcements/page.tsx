import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function AnnouncementsPage() {
  const { userId } = await requireProfile();
  const supabase = createClient();

  const { data: myCohorts } = await supabase
    .from("cohort_members")
    .select("cohort_id")
    .eq("user_id", userId);
  const cohortIds = (myCohorts ?? []).map((c) => c.cohort_id);

  let query = supabase
    .from("announcements")
    .select("id, title, body, created_at, cohort_id, cohorts(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (cohortIds.length > 0) {
    query = query.or(`cohort_id.is.null,cohort_id.in.(${cohortIds.join(",")})`);
  } else {
    query = query.is("cohort_id", null);
  }

  const { data: items } = await query;

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <p className="kicker">From the team</p>
        <h1 className="mt-1 text-3xl font-bold text-rog-purple">Announcements</h1>

        <div className="mt-6 space-y-3">
          {(items ?? []).length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">Nothing to announce right now.</p>
              <p className="empty-hint">Notes from the team will collect here.</p>
            </div>
          ) : (
            (items ?? []).map((a: any) => (
              <div key={a.id} className="card">
                <p className="text-[10px] uppercase tracking-wider text-rog-pink font-semibold">
                  {a.cohort_id ? a.cohorts?.name : "Everyone"}
                </p>
                {a.title && <p className="mt-1 font-bold text-rog-purple">{a.title}</p>}
                <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="mt-2 text-xs text-rog-muted">
                  {new Date(a.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
