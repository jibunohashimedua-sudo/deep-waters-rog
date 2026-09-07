import Image from "next/image";

/**
 * One avatar for the whole app. There used to be ten hand-rolled copies at six
 * sizes with four different fallback treatments — this collapses them so a
 * person looks the same everywhere they appear.
 */
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { px: number; box: string; text: string }> = {
  xs: { px: 28, box: "w-7 h-7", text: "text-xs" },
  sm: { px: 36, box: "w-9 h-9", text: "text-sm" },
  md: { px: 40, box: "w-10 h-10", text: "text-sm" },
  lg: { px: 48, box: "w-12 h-12", text: "text-base" },
  xl: { px: 80, box: "w-20 h-20", text: "text-2xl" }
};

type Props = {
  name: string;
  photoUrl?: string | null;
  size?: Size;
  /** Extra classes on the outer element — e.g. a ring or a shrink-0. */
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
  const initial = (name?.trim()?.charAt(0) ?? "?").toUpperCase();

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={decorative ? "" : name}
        width={px}
        height={px}
        // Intrinsic size matches the rendered box, so nothing reflows on load.
        className={`rounded-full object-cover shrink-0 ${box} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-rog-peach flex items-center justify-center font-bold text-rog-purple shrink-0 ${box} ${text} ${className}`}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : name}
    >
      {initial}
    </div>
  );
}
