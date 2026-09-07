import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { monthStart, todayISO, datesInMonth } from "@/lib/rhapsody";
import RhapsodyAdmin, { type DayRow, type Edition } from "@/components/RhapsodyAdmin";

export const dynamic = "force-dynamic";

export default async function AdminRhapsodyPage({
  searchParams
}: {
  searchParams: { m?: string };
}) {
  const { userId } = await requireAdmin();
  const supabase = createClient();

  // ?m=2026-09-01 picks the month being mapped; today's month is the default.
  const asked = searchParams.m ?? "";
  const month = /^\d{4}-\d{2}-\d{2}$/.test(asked)
    ? monthStart(asked)
    : monthStart(todayISO());
  const dates = datesInMonth(month);

  // Two plain queries, merged in the component. No nested selects.
  const { data: editions, error: editionsError } = await supabase
    .from("rhapsody_editions")
    .select("id, month, title, file_path")
    .order("month", { ascending: false });

  const { data: days, error: daysError } = await supabase
    .from("rhapsody_days")
    .select("date, title, page_number")
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1])
    .order("date", { ascending: true });

  const loadError = editionsError?.message ?? daysError?.message ?? null;
  if (loadError) console.error("[deep-waters] admin rhapsody load:", loadError);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/admin" className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; Admin
        </Link>
        <div className="select-none">
          <p className="mt-4 kicker">Admin</p>
          <h1 className="mt-3 font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight">
            Rhapsody of Realities
          </h1>
          <p className="mt-2 text-sm text-rog-muted">
            Upload the month&rsquo;s PDF, then say which article belongs to each day.
            Members see today&rsquo;s article on their Today page.
          </p>
        </div>

        {loadError && (
          <p className="mt-6 text-sm text-danger">
            Couldn&rsquo;t load the existing editions: {loadError}
          </p>
        )}

        <div className="mt-6">
          <RhapsodyAdmin
            month={month}
            editions={(editions ?? []) as Edition[]}
            days={(days ?? []) as DayRow[]}
            userId={userId}
          />
        </div>
      </main>
    </>
  );
}
