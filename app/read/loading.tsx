import Nav from "@/components/Nav";
import ReadingSkeleton from "@/components/ReadingSkeleton";

export default function ReadLoading() {
  return (
    <>
      <Nav />
      <ReadingSkeleton
        label="Loading today’s reading"
      />
    </>
  );
}
