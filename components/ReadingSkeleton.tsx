/**
 * The shape a reading screen will be, held while the chapter is fetched.
 *
 * It mirrors the real layout deliberately: the sticky bar with its hairline,
 * the mono line, the reference in the reading serif, then verses as blocks
 * with the padding they actually have. A skeleton that doesn't match the
 * page it stands in for makes the arrival a jolt rather than a fill-in.
 */
export default function ReadingSkeleton({
  label,
  titleWidth,
  metaWidth
}: {
  label: string;
  titleWidth: string;
  metaWidth: string;
}) {
  // Verse-shaped groups, not one column of even bars — a verse is two or
  // three lines with air round it, and that is the rhythm of the page.
  const verses = [
    ["100%", "94%", "62%"],
    ["98%", "88%"],
    ["100%", "96%", "91%", "48%"],
    ["93%", "70%"],
    ["100%", "97%", "58%"]
  ];

  return (
    <main
      data-surface="reading"
      className="max-w-3xl mx-auto px-6 pt-0 pb-10"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>

      <div className="reading-bar">
        <div className="skeleton h-4 w-4 justify-self-center" />
        <span />
        <div className="skeleton h-[44px] w-[92px] !rounded-full" />
      </div>

      <div className="pt-8">
        <div className="skeleton h-2.5" style={{ width: metaWidth }} />
        <div className="skeleton mt-3 h-8" style={{ width: titleWidth }} />
      </div>

      <div className="mt-10">
        <div className="skeleton h-2.5 w-24" />
        <div className="mt-6 space-y-7">
          {verses.map((lines, i) => (
            <div key={i} className="space-y-2.5">
              {lines.map((w, j) => (
                <div key={j} className="skeleton h-4" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
