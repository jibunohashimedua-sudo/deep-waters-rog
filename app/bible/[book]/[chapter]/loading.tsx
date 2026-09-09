import Nav from "@/components/Nav";
import ReadingSkeleton from "@/components/ReadingSkeleton";

/**
 * A chapter takes a network round trip to API.Bible the first time anyone
 * opens it, so this stands in at the reading measure and rhythm.
 */
export default function ChapterLoading() {
  return (
    <>
      <Nav />
      <ReadingSkeleton
        label="Loading the chapter"
        metaWidth="6rem"
        titleWidth="13rem"
      />
    </>
  );
}
