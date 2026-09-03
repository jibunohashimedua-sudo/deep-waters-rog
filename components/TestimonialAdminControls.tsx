"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TestimonialAdminControls({
  id,
  approved,
  featured
}: {
  id: string;
  approved: boolean;
  featured: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function set(patch: Record<string, boolean>) {
    await supabase.from("testimonials").update(patch).eq("id", id);
    router.refresh();
  }
  async function del() {
    await supabase.from("testimonials").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex gap-2 text-xs">
      {!approved ? (
        <button onClick={() => set({ approved: true })} className="btn-primary text-xs px-4 py-2">Approve</button>
      ) : (
        <button onClick={() => set({ approved: false })} className="btn-secondary text-xs px-4 py-2">Unapprove</button>
      )}
      {approved && (
        <button onClick={() => set({ featured: !featured })} className="btn-secondary text-xs px-4 py-2">
          {featured ? "Unfeature" : "Feature"}
        </button>
      )}
      <button onClick={del} className="text-red-600 px-2">Delete</button>
    </div>
  );
}
