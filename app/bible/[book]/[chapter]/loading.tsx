import Nav from "@/components/Nav";
import ReadingLoading from "@/components/ReadingLoading";

/**
 * A chapter takes a network round trip to API.Bible the first time anyone
 * opens it, so this stands in at the reading measure and rhythm.
 */
export default function ChapterLoading() {
  return (
    <>
      <Nav />
      <ReadingLoading
        label="Loading the chapter"
      />
    </>
  );
}
