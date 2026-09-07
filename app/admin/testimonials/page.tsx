import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import TestimonialAdminControls from "@/components/TestimonialAdminControls";

export default async function AdminTestimonialsPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: items } = await supabase
    .from("testimonials")
    .select("id, body, approved, featured, created_at, profiles(name, photo_url)")
    .order("approved")
    .order("created_at", { ascending: false });

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="kicker">Admin</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Testimonials</h1>
        <p className="mt-2 text-sm text-rog-muted">
          Approved stories show on the finisher wall. Featured ones rotate on the landing page.
        </p>

        <div className="mt-6 space-y-3">
          {(items ?? []).length === 0 ? (
            <div className="empty-state">
              <p className="empty-body">No testimonies to review yet.</p>
              <p className="empty-hint">They will appear here when people submit them.</p>
            </div>
          ) : (
            (items ?? []).map((t: any) => (
              <div key={t.id} className={`card ${t.approved ? "" : "border-amber-300"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-rog-purple">{t.profiles?.name}</p>
                  <div className="flex gap-2 text-[10px] uppercase tracking-wider">
                    {!t.approved && <span className="text-amber-600">Pending</span>}
                    {t.approved && <span className="text-green-700">Approved</span>}
                    {t.featured && <span className="text-rog-purple font-medium">Featured</span>}
                  </div>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{t.body}</p>
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
