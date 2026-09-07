import { bookBySlug } from "@/lib/bibleBooks";
import Nav from "@/components/Nav";
import ChapterView from "@/components/ChapterView";

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

export default function ChapterPage({
  params
}: {
  params: { book: string; chapter: string };
}) {
  return (
    <>
      <Nav />
      <ChapterView
        bookSlug={params.book}
        chapter={Number.parseInt(params.chapter, 10)}
      />
    </>
  );
}
