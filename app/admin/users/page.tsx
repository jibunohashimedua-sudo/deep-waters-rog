import Image from "next/image";
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
      <main className="max-w-4xl mx-auto px-6 py-8">
        <p className="kicker">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-rog-purple">Users</h1>

        <form className="mt-6 flex gap-2">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search by name"
            className="flex-1 rounded-full border border-rog-line bg-white px-5 py-2.5 text-sm"
          />
          <button className="btn-primary text-sm">Search</button>
          {searchParams.filter !== "pending" ? (
            <a href="/admin/users?filter=pending" className="btn-secondary text-sm">Pending only</a>
          ) : (
            <a href="/admin/users" className="btn-secondary text-sm">Show all</a>
          )}
        </form>

        <div className="mt-6 space-y-2">
          {(users ?? []).map((u) => (
            <div key={u.id} className="card flex items-center gap-3">
              {u.photo_url ? (
                <Image src={u.photo_url} alt="" width={40} height={40} className="rounded-full object-cover w-10 h-10" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-rog-peach flex items-center justify-center font-bold text-rog-purple">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-rog-ink">
                  {u.name}
                  {u.role === "admin" && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-rog-pink">Admin</span>
                  )}
                  {!u.approved && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600">Pending</span>
                  )}
                </p>
                <p className="text-xs text-rog-muted">
                  Joined {new Date(u.created_at).toLocaleDateString("en-GB")} &bull; Start {u.start_date}
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
