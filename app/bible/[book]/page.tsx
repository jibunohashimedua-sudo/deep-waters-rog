import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bookBySlug } from "@/lib/bibleBooks";
import { readChaptersForBook } from "@/lib/plan";
import Nav from "@/components/Nav";
import ChapterGrid from "@/components/ChapterGrid";

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

        <ChapterGrid
          bookSlug={book.slug}
          bookName={book.name}
          chapters={book.chapters}
          read={[...read]}
        />

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
