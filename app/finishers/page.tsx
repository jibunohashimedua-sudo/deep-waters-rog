import Image from "next/image";
import Nav from "@/components/Nav";
import ProgressTabs from "@/components/ProgressTabs";
import { createClient } from "@/lib/supabase/server";

export default async function FinishersPage() {
  const supabase = createClient();
  const { data } = await supabase.from("finishers").select("*");
  const finishers = data ?? [];

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <ProgressTabs />
        <p className="kicker">Day 90</p>
        <h1 className="mt-1 text-4xl font-bold text-rog-purple">Finishers</h1>
        <p className="mt-2 text-sm text-rog-muted">
          Every name here read the whole Bible in 90 days.
        </p>

        {finishers.length === 0 ? (
          <div className="mt-10 card text-center py-16">
            <p className="text-xl font-semibold text-rog-purple">
              No finishers yet. The wall is waiting.
            </p>
            <p className="mt-2 text-rog-muted">Be the first name on it.</p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {finishers.map((f) => (
              <div key={f.id} className="card text-center">
                {f.photo_url ? (
                  <Image
                    src={f.photo_url}
                    alt={f.name}
                    width={100}
                    height={100}
                    className="rounded-full object-cover w-20 h-20 mx-auto"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-rog-peach flex items-center justify-center mx-auto font-bold text-2xl text-rog-purple">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="mt-3 font-semibold text-rog-purple">{f.name}</p>
                <p className="text-xs text-rog-muted">
                  {new Date(f.finished_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
