import { bookBySlug } from "@/lib/bibleBooks";
import Nav from "@/components/Nav";
import ChapterView from "@/components/ChapterView";
import { requireProfile } from "@/lib/auth";

export async function generateMetadata({
  params
}: {
  params: { book: string; chapter: string };
}) {
  const book = bookBySlug(params.book);
  return {
    title: book ? `${book.name} ${params.chapter} · Deep Waters` : "Bible · Deep Waters"
  };
}

export default async function ChapterPage({
  params,
  searchParams
}: {
  params: { book: string; chapter: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Free now: requireProfile() reads the row middleware forwarded on this
  // same request rather than asking Supabase for it again.
  const { profile } = await requireProfile();
  return (
    <>
      <Nav profile={profile} />
      <ChapterView
        bookSlug={params.book}
        chapter={Number.parseInt(params.chapter, 10)}
        searchParams={searchParams}
      />
    </>
  );
}
