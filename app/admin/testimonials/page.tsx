import Nav from "@/components/Nav";
import PageHeading from "@/components/PageHeading";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import TestimonialAdminControls from "@/components/TestimonialAdminControls";

export default async function AdminTestimonialsPage() {
  const { profile } = await requireAdmin();
  const supabase = createClient();
  const { data: items } = await supabase
    .from("testimonials")
    .select("id, body, approved, featured, created_at, profiles(name, photo_url)")
    .order("approved")
    .order("created_at", { ascending: false });

  return (
    <>
      <Nav profile={profile} />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <PageHeading>Testimonials</PageHeading>
        <p className="mt-2 text-sm text-rog-muted">
          Approved stories show on the finisher wall. Featured ones rotate on the landing page.
        </p>

        <div className="mt-6 card-list">
          {(items ?? []).length === 0 ? (
            <div className="empty">
              <p>No testimonies to review yet.</p>
            </div>
          ) : (
            (items ?? []).map((t: any) => (
              <div key={t.id} className={`card ${t.approved ? "" : "border-warning"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-rog-purple">{t.profiles?.name}</p>
                  <div className="flex gap-2 meta">
                    {!t.approved && <span className="text-warning">Pending</span>}
                    {t.approved && <span className="text-success">Approved</span>}
                    {t.featured && <span className="text-rog-purple font-medium">Featured</span>}
                  </div>
                </div>
                <p className="selectable mt-2 text-sm whitespace-pre-wrap">{t.body}</p>
                <div className="mt-3">
                  <TestimonialAdminControls id={t.id} approved={t.approved} featured={t.featured} />
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
