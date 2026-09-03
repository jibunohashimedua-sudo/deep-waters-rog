"use client";
import { useRouter } from "next/navigation";

export default function BackButton({
  href,
  label = "Back"
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  const onClick = () => {
    if (href) router.push(href);
    else router.back();
  };
  return (
    <button
      onClick={onClick}
      className="glass-chip inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-rog-purple font-medium hover:text-rog-blue transition"
    >
      <span aria-hidden>&larr;</span>
      <span>{label}</span>
    </button>
  );
}
