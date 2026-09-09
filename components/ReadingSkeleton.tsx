import LoadingRule from "@/components/LoadingRule";

/**
 * The reading screen, waiting.
 *
 * It used to draw seven grey bars at the measure — a picture of a
 * paragraph that isn't there yet. On a reading surface that is worse than
 * nothing: it puts fake text in front of somebody who came to read real
 * text, and when the chapter lands the fake lines and the real lines
 * don't match, so the page moves under them.
 *
 * A rule across the top instead, and silence.
 */
export default function ReadingSkeleton({ label }: { label: string }) {
  return (
    <main data-surface="reading" className="max-w-3xl mx-auto px-6 py-10">
      <LoadingRule label={label} />
    </main>
  );
}
