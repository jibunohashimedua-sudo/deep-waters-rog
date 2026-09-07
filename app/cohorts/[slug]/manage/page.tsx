import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isCohortLeader } from "@/lib/auth";
import CohortSettingsForm from "@/components/CohortSettingsForm";
import AnnouncementForm from "@/components/AnnouncementForm";
import RemoveMemberButton from "@/components/RemoveMemberButton";

export default async function CohortManagePage({
  params
}: {
  params: { slug: string };
}) {
  const { userId } = await requireProfile();
  const supabase = createClient();

  const { data: cohort } = await supabase
    .from("cohort_summary")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!cohort) notFound();

  const leader = await isCohortLeader(userId, cohort.id);
  if (!leader) redirect(`/c/${params.slug}`);

  const [{ data: members }, { data: announcements }] = await Promise.all([
    supabase
      .from("cohort_members")
      .select("user_id, role, joined_at, profiles(id, name, photo_url)")
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
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href={`/c/${cohort.slug}`} className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; Back to {cohort.name}
        </Link>
        <p className="mt-4 kicker">Manage</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">{cohort.name}</h1>

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
          <p className="kicker">Settings</p>
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
          <p className="kicker">Announcements</p>
          <div className="mt-3">
            <AnnouncementForm cohortId={cohort.id} />
          </div>
          <div className="mt-4 space-y-2">
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="card">
                {a.title && <p className="font-bold text-rog-purple">{a.title}</p>}
                <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
                <p className="mt-2 text-xs text-rog-muted">
                  {new Date(a.created_at).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Members */}
        <section className="mt-8">
          <p className="kicker">Members</p>
          <div className="mt-3 space-y-2">
            {(members ?? []).map((m: any) => {
              const p = progMap.get(m.user_id);
              return (
                <div key={m.user_id} className="card flex items-center gap-3">
                  {m.profiles?.photo_url ? (
                    <Image
                      src={m.profiles.photo_url}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-full object-cover w-10 h-10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-rog-peach flex items-center justify-center font-bold text-rog-purple">
                      {m.profiles?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-rog-ink">
                      {m.profiles?.name}{" "}
                      {m.role === "leader" && (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-rog-purple font-medium ml-1">Leader</span>
                      )}
                    </p>
                    <p className="text-xs text-rog-muted">
                      Day {p?.highest_day ?? 0} &bull; {p?.days_completed ?? 0} done &bull;{" "}
                      {p?.current_streak ?? 0} streak
                    </p>
                  </div>
                  {m.user_id !== userId && (
                    <RemoveMemberButton cohortId={cohort.id} userId={m.user_id} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
