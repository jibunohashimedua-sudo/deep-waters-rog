import { notFound } from "next/navigation";
import { bookBySlug } from "@/lib/bibleBooks";
import { parseVerseSegment } from "@/lib/reference";
import Nav from "@/components/Nav";
import ChapterView from "@/components/ChapterView";
import { requireProfile } from "@/lib/auth";

/**
 * A chapter opened at a verse: /bible/john/3/16, or a range,
 * /bible/john/3/16-18.
 *
 * The verse lives in the path rather than a #hash so the link survives being
 * pasted anywhere — a hash never reaches the server, so it couldn't appear in
 * the page title, in a link preview, or in anything rendered before hydration.
 */
export async function generateMetadata({
  params
}: {
  params: { book: string; chapter: string; verse: string };
}) {
  const book = bookBySlug(params.book);
  const verses = parseVerseSegment(params.verse);
  if (!book || !verses) return { title: "Bible · Deep Waters" };

  const ref =
    verses.start === verses.end
      ? `${book.name} ${params.chapter}:${verses.start}`
      : `${book.name} ${params.chapter}:${verses.start}-${verses.end}`;
  return { title: `${ref} · Deep Waters` };
}

export default async function ChapterVersePage({
  params,
  searchParams
}: {
  params: { book: string; chapter: string; verse: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // The URL is ours to generate, so a malformed verse segment is a broken
  // link rather than someone mistyping — 404 rather than guess at it.
  const verses = parseVerseSegment(params.verse);
  if (!verses) notFound();

  // Free now: requireProfile() reads the row middleware forwarded on this
  // same request rather than asking Supabase for it again.
  const { profile } = await requireProfile();
  return (
    <>
      <Nav profile={profile} />
      <ChapterView
        bookSlug={params.book}
        chapter={Number.parseInt(params.chapter, 10)}
        focus={verses}
        searchParams={searchParams}
      />
    </>
  );
}
