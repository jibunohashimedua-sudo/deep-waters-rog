import LoadingRule from "@/components/LoadingRule";
import Nav from "@/components/Nav";

/**
 * A rule, not a skeleton.
 *
 * The skeleton this replaced was a guess at the layout underneath it, and
 * a guess that is wrong makes the page settle twice — once into the
 * guess, once into the truth. A 1px sonar rule across the top says the
 * same thing honestly and never has to be revised. It waits 200ms before
 * drawing, so a fast load shows nothing at all.
 */
export default function BibleLoading() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <LoadingRule label="Loading the Bible" />
      </main>
    </>
  );
}
