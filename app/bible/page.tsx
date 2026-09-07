import { requireProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import BookPicker from "@/components/BookPicker";

export const metadata = { title: "Bible · Deep Waters" };

export default async function BiblePage() {
  // Signed-in only, same as every other in-app page.
  await requireProfile();

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="kicker">Read anywhere</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          The Bible
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          All 66 books. Nothing here changes your plan.
        </p>
        <BookPicker />
      </main>
    </>
  );
}
