import Nav from "@/components/Nav";
import ReadingLoading from "@/components/ReadingLoading";

export default function ReadChapterLoading() {
  return (
    <>
      <Nav />
      <ReadingLoading label="Loading the chapter" />
    </>
  );
}
