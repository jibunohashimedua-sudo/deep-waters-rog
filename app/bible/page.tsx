import { requireProfile } from "@/lib/auth";
import Nav from "@/components/Nav";
import BookPicker from "@/components/BookPicker";
import { readPreferences } from "@/lib/preferences";

export const metadata = { title: "Bible · Deep Waters" };

export default async function BiblePage() {
  // Signed-in only, same as every other in-app page.
  const { profile } = await requireProfile();
  // Seeded from the profile so the reader's own list renders on the
  // first paint. The picker still reads the browser copy as a fallback
  // — see lib/bookLayout — which is what covers a signed-in page that
  // hasn't been given one.
  const layout = readPreferences(profile as unknown as Record<string, unknown>)
    .book_layout;

  return (
    <>
      <Nav profile={profile} />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          The Bible
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          All 66 books. Nothing here changes your plan.
        </p>
        <BookPicker initialLayout={layout} />
      </main>
    </>
  );
}
