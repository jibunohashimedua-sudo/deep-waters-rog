import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bookBySlug } from "@/lib/bibleBooks";
import { readChaptersForBook } from "@/lib/plan";
import Nav from "@/components/Nav";

export async function generateMetadata({ params }: { params: { book: string } }) {
  const book = bookBySlug(params.book);
  return { title: book ? `${book.name} · Deep Waters` : "Bible · Deep Waters" };
}

export default async function BookChaptersPage({
  params
}: {
  params: { book: string };
}) {
  const book = bookBySlug(params.book);
  if (!book) notFound();

  const { userId } = await requireProfile();
  const supabase = createClient();

  // Which chapters this reader has already met through the plan. A failure
  // here is not worth blocking the page for — the marks are a quiet extra,
  // so we log it and render the grid unmarked.
  const { data: completions, error } = await supabase
    .from("completions")
    .select("day_number")
    .eq("user_id", userId);
  if (error) {
    console.error("[deep-waters] chapter picker completions:", error.message);
  }
  const read = readChaptersForBook(
    book.name,
    (completions ?? []).map((c) => c.day_number as number)
  );

  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/bible" className="text-sm text-rog-muted hover:text-rog-purple">
          &larr; All books
        </Link>
        <p className="mt-10 kicker">{book.group}</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          {book.name}
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          {book.chapters} {book.chapters === 1 ? "chapter" : "chapters"}
          {read.size > 0 && ` · ${read.size} read in your plan`}
        </p>

        <ul className="mt-10 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {chapters.map((c) => {
            const done = read.has(c);
            return (
              <li key={c}>
                <Link
                  href={`/bible/${book.slug}/${c}`}
                  data-read={done ? "true" : undefined}
                  aria-label={
                    done
                      ? `${book.name} chapter ${c}, already read in your plan`
                      : `${book.name} chapter ${c}`
                  }
                  className="chapter-tile"
                >
                  {c}
                </Link>
              </li>
            );
          })}
        </ul>

        {read.size > 0 && (
          <p className="mt-6 text-xs text-rog-muted flex items-center gap-2">
            <span className="chapter-tile chapter-tile-key" data-read="true" aria-hidden>
              1
            </span>
            Already read on your plan
          </p>
        )}
      </main>
    </>
  );
}
