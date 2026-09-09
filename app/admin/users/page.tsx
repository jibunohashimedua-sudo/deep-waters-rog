import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import AdminUserRow from "@/components/AdminUserRow";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: { filter?: string; q?: string };
}) {
  const { userId: me } = await requireAdmin();
  const supabase = createClient();

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.filter === "pending") query = query.eq("approved", false);
  if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);

  const { data: users } = await query;

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Users</h1>

        <form className="mt-6 flex flex-wrap gap-2">
          <input
            name="q"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search by name"
            aria-label="Search users by name"
            className="flex-1 min-w-[10rem] rounded-full border border-rog-line bg-white px-5 py-2.5 text-sm"
          />
          <button className="btn-primary text-sm">Search</button>
          {searchParams.filter !== "pending" ? (
            <Link href="/admin/users?filter=pending" className="btn-secondary text-sm">Pending only</Link>
          ) : (
            <Link href="/admin/users" className="btn-secondary text-sm">Show all</Link>
          )}
        </form>

        <div className="mt-6">
          {(users ?? []).length === 0 && (
            <div className="empty">
              <p>No one matches that search.</p>
            </div>
          )}
          <div className="admin-list">
            {(users ?? []).map((u) => (
              <AdminUserRow
                key={u.id}
                id={u.id}
                name={u.name}
                nickname={u.nickname}
                photoUrl={u.photo_url}
                role={u.role}
                approved={u.approved}
                isPastoral={u.is_pastoral === true}
                startDate={u.start_date}
                joinedAt={u.created_at}
                isSelf={u.id === me}
              />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
