import Avatar from "@/components/Avatar";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import UserAdminControls from "@/components/UserAdminControls";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: { filter?: string; q?: string };
}) {
  const { userId: me } = await requireAdmin();
  const supabase = createClient();

  let query = supabase
    .from("profiles")
    .select("id, name, photo_url, role, approved, start_date, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.filter === "pending") query = query.eq("approved", false);
  if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);

  const { data: users } = await query;

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="kicker">Admin</p>
        <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">Users</h1>

        <form className="mt-6 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search by name"
            aria-label="Search users by name"
            className="flex-1 min-w-[10rem] rounded-full border border-rog-line bg-white px-5 py-2.5 text-sm"
          />
          <button className="btn-primary text-sm">Search</button>
          {searchParams.filter !== "pending" ? (
            <a href="/admin/users?filter=pending" className="btn-secondary text-sm">Pending only</a>
          ) : (
            <a href="/admin/users" className="btn-secondary text-sm">Show all</a>
          )}
        </form>

        <div className="mt-6 space-y-2">
          {(users ?? []).length === 0 && (
            <div className="empty-state">
              <p className="empty-body">No one matches that search.</p>
              <p className="empty-hint">Try part of a name, or clear the box to see everyone.</p>
            </div>
          )}
          {(users ?? []).map((u) => (
            <div key={u.id} className="card flex items-center gap-3">
              <Avatar name={u.name} photoUrl={u.photo_url} size="md" decorative />
              <div className="flex-1">
                <p className="font-semibold text-rog-ink">
                  {u.name}
                  {u.role === "admin" && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-rog-purple font-medium">Admin</span>
                  )}
                  {!u.approved && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-warning">Pending</span>
                  )}
                </p>
                <p className="text-xs text-rog-muted">
                  Joined {new Date(u.created_at).toLocaleDateString("en-GB")} &bull; Start {new Date(u.start_date).toLocaleDateString("en-GB")}
                </p>
              </div>
              {u.id !== me && (
                <UserAdminControls userId={u.id} role={u.role} approved={u.approved} />
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
