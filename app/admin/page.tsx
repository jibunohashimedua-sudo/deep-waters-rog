import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import AnnouncementForm from "@/components/AnnouncementForm";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = createClient();

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersWeek },
    { count: completionsToday },
    { count: completionsWeek },
    { count: openReports },
    { count: pendingTestimonials },
    { count: pendingUsers },
    { count: finishers },
    { data: notesCount }
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("completions").select("*", { count: "exact", head: true }).gte("completed_at", dayAgo),
    supabase.from("completions").select("*", { count: "exact", head: true }).gte("completed_at", weekAgo),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("resolved", false),
    supabase.from("testimonials").select("*", { count: "exact", head: true }).eq("approved", false),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("approved", false),
    supabase.from("finishers").select("*", { count: "exact", head: true }),
    supabase.from("study_notes").select("day_number").not("body", "is", null)
  ]);

  const notesWritten = notesCount?.length ?? 0;

  const stat = (label: string, value: number | null | undefined, href?: string) => {
    const inner = (
      <div className="card text-center hover:border-rog-purple transition">
        <p className="text-3xl font-bold text-rog-purple">{value ?? 0}</p>
        <p className="text-xs text-rog-muted mt-1">{label}</p>
      </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
  };

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Admin dashboard</h1>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {stat("Total users", totalUsers, "/admin/users")}
          {stat("New this week", newUsersWeek, "/admin/users")}
          {stat("Completions today", completionsToday)}
          {stat("Completions this week", completionsWeek)}
          {stat("Finishers", finishers, "/finishers")}
          {stat("Study notes written", notesWritten, "/admin/notes")}
          {stat("Open reports", openReports, "/admin/reports")}
          {stat("Pending testimonials", pendingTestimonials, "/admin/testimonials")}
        </div>

        {(pendingUsers ?? 0) > 0 && (
          <div className="mt-4 card">
            <p className="font-semibold text-rog-purple">
              {pendingUsers} user{pendingUsers === 1 ? "" : "s"} awaiting approval
            </p>
            <Link href="/admin/users?filter=pending" className="text-sm text-rog-purple underline">
              Review now
            </Link>
          </div>
        )}

        <div className="mt-8 grid md:grid-cols-2 gap-3">
          <Link href="/admin/notes" className="card hover:border-rog-purple transition">
            <p className="font-bold text-rog-purple">Study notes</p>
            <p className="text-xs text-rog-muted mt-1">Write daily notes for all 90 days</p>
          </Link>
          <Link href="/admin/rhapsody" className="card hover:border-rog-purple transition">
            <p className="font-bold text-rog-purple">Rhapsody of Realities</p>
            <p className="text-xs text-rog-muted mt-1">Upload the month&rsquo;s PDF and map each date</p>
          </Link>
          <Link href="/admin/users" className="card hover:border-rog-purple transition">
            <p className="font-bold text-rog-purple">Users</p>
            <p className="text-xs text-rog-muted mt-1">Approve, promote to admin, remove</p>
          </Link>
          <Link href="/admin/reports" className="card hover:border-rog-purple transition">
            <p className="font-bold text-rog-purple">Reports</p>
            <p className="text-xs text-rog-muted mt-1">Review flagged content</p>
          </Link>
          <Link href="/admin/testimonials" className="card hover:border-rog-purple transition">
            <p className="font-bold text-rog-purple">Testimonials</p>
            <p className="text-xs text-rog-muted mt-1">Approve and feature stories</p>
          </Link>
        </div>

        <section className="mt-8">
          <p className="kicker">Global announcement</p>
          <p className="text-sm text-rog-muted mt-1 mb-3">Sent to every user as a notification.</p>
          <AnnouncementForm cohortId={null} />
        </section>
      </main>
    </>
  );
}
