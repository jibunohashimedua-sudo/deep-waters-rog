import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { requireAdmin } from "@/lib/auth";
import { isFigureKey, loadFigure } from "@/lib/adminFigures";
import AdminFigureList from "@/components/AdminFigureList";

/**
 * The people behind one figure on the admin dashboard.
 *
 * Three separate admin checks stand between a member and this page:
 * requireAdmin() here, which redirects; assertAdmin() inside
 * loadFigure(), which throws before any row is read; and the row-level
 * policies on profiles and completions. Hiding the link is not one of
 * them, and would not be worth anything if it were.
 */
export default async function AdminFigurePage({
  params
}: {
  params: { metric: string };
}) {
  await requireAdmin();
  if (!isFigureKey(params.metric)) notFound();

  const figure = await loadFigure(params.metric);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/admin" className="meta">
          Admin
        </Link>
        <h1 className="mt-2 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          {figure.title}
        </h1>
        <p className="mt-2 max-w-[34rem] text-sm text-rog-muted">
          {figure.blurb} Account names are shown here, with the name members
          see underneath.
        </p>

        <AdminFigureList figure={figure} />
      </main>
    </>
  );
}
