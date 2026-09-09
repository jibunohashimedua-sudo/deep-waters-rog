import Nav from "@/components/Nav";
import ReadingLoading from "@/components/ReadingLoading";

export default function ReadLoading() {
  return (
    <>
      <Nav />
      <ReadingLoading
        label="Loading today’s reading"
      />
    </>
  );
}
