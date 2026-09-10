import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isCohortLeader } from "@/lib/auth";
import CohortSettingsForm from "@/components/CohortSettingsForm";
import AnnouncementForm from "@/components/AnnouncementForm";
import AdminMemberRow from "@/components/AdminMemberRow";
import CohortGone from "@/components/CohortGone";

export default async function CohortManagePage({
  params
}: {
  params: { slug: string };
}) {
  const { userId, profile } = await requireProfile();
  const supabase = createClient();

  const { data: cohort } = await supabase
    .from("cohort_summary")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();
  // A leader whose cohort was deleted while a tab was open used to hit
  // the raw 404 here; friendly page instead. requireProfile above means
  // signedIn is always true on this route.
  if (!cohort) {
    return <CohortGone signedIn={true} />;
  }

  const leader = await isCohortLeader(userId, cohort.id);
  if (!leader) redirect(`/c/${params.slug}`);

  const [{ data: members }, { data: announcements }] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("user_id, role, joined_at, profiles(id, name, nickname, photo_url, start_date)")
      .eq("cohort_id", cohort.id)
      .order("joined_at"),
    supabase
      .from("announcements")
      .select("id, title, body, created_at")
      .eq("cohort_id", cohort.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  // Progress per member
  const memberIds = (members ?? []).map((m: any) => m.user_id);
  const { data: progress } = await supabase
    .from("leaderboard")
    .select("user_id, days_completed, current_streak, highest_day")
    .in("user_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const progMap = new Map((progress ?? []).map((p) => [p.user_id, p]));

  const startDate = new Date(cohort.start_date);
  const today = new Date();
  const daysSince = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;
  const expectedDay = Math.max(0, Math.min(90, daysSince));
  const onTrack = (members ?? []).filter((m: any) => {
    const p = progMap.get(m.user_id);
    return p && p.highest_day >= expectedDay - 2;
  }).length;

  return (
    <>
      <Nav profile={profile} />
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* The app bar's arrow goes back to the cohort itself. */}
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">{cohort.name}</h1>

        {/* Dashboard */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center">
            <p className="text-3xl font-bold text-rog-purple">{cohort.member_count}</p>
            <p className="text-xs text-rog-muted">Members</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-rog-purple">{expectedDay > 0 ? expectedDay : "—"}</p>
            <p className="text-xs text-rog-muted">Expected day</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-rog-purple">{cohort.avg_days_completed}</p>
            <p className="text-xs text-rog-muted">Avg completed</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-rog-purple">{onTrack}</p>
            <p className="text-xs text-rog-muted">On track</p>
          </div>
        </div>

        {/* Settings */}
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Settings</h2>
          <div className="mt-3">
            <CohortSettingsForm
              cohortId={cohort.id}
              slug={cohort.slug}
              initialName={cohort.name}
              initialDescription={cohort.description ?? ""}
              initialWelcome={cohort.welcome_message ?? ""}
              initialStartDate={cohort.start_date}
            />
          </div>
        </section>

        {/* Announcements */}
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Announcements</h2>
          <div className="mt-3">
            <AnnouncementForm cohortId={cohort.id} />
          </div>
          <div className="mt-4 space-y-2">
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="card">
                {a.title && <p className="font-bold text-rog-purple">{a.title}</p>}
                <p className="selectable mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="mt-2 text-xs text-rog-muted">
                  {new Date(a.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Members */}
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Members</h2>
          <div className="mt-3 space-y-2">
            <div className="admin-list">
              {(members ?? []).map((m: any) => {
                const p = progMap.get(m.user_id);
                return (
                  <AdminMemberRow
                    key={m.user_id}
                    cohortId={cohort.id}
                    userId={m.user_id}
                    name={m.profiles?.name ?? "Someone"}
                    nickname={m.profiles?.nickname}
                    photoUrl={m.profiles?.photo_url}
                    isLeader={m.role === "leader"}
                    joinedAt={m.joined_at}
                    startDate={m.profiles?.start_date}
                    daysKept={p?.days_completed ?? 0}
                    streak={p?.current_streak ?? 0}
                    isSelf={m.user_id === userId}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
