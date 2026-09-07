import Image from "next/image";

/**
 * One avatar for the whole app. There used to be ten hand-rolled copies at six
 * sizes with four different fallback treatments — this collapses them so a
 * person looks the same everywhere they appear.
 *
 * Square, always. Nothing in this app is round except the things you press,
 * and a person is not a button. With no photo it falls back to initials set
 * in Plex Mono on the recess ground with a hairline round it: in that state
 * the avatar is standing in for a face, which makes it a label, and labels
 * in this system are mono.
 */
type Size = "xs" | "sm" | "nav" | "md" | "lg" | "xl";

const SIZES: Record<Size, { px: number; box: string; text: string }> = {
  xs:  { px: 28, box: "w-7 h-7",   text: "text-[10px]" },
  nav: { px: 32, box: "w-8 h-8",   text: "text-[11px]" },
  sm:  { px: 36, box: "w-9 h-9",   text: "text-[12px]" },
  md:  { px: 40, box: "w-10 h-10", text: "text-[13px]" },
  lg:  { px: 48, box: "w-12 h-12", text: "text-[15px]" },
  xl:  { px: 80, box: "w-20 h-20", text: "text-[22px]" }
};

/** Up to two initials — "Zoe Adeyemi" becomes ZA, "Zoe" becomes Z. */
function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0);
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
}

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: Size;
  /** Extra classes on the outer element — e.g. a shrink-0. */
  className?: string;
  /** Decorative when the name is already rendered beside it. */
  decorative?: boolean;
};

export default function Avatar({
  name,
  photoUrl,
  size = "md",
  className = "",
  decorative = false
}: Props) {
  const { px, box, text } = SIZES[size];

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={decorative ? "" : name}
        width={px}
        height={px}
        // Intrinsic size matches the rendered box, so nothing reflows on load.
        className={`object-cover shrink-0 ${box} ${className}`}
      />
    );
  }

  return (
    <div
      className={`portrait-fallback shrink-0 ${box} ${text} ${className}`}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : name}
    >
      {initialsOf(name).toUpperCase()}
    </div>
  );
}
