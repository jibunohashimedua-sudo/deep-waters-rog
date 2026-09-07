"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/me", label: "Me" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/finishers", label: "Finishers" }
];

export default function ProgressTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex p-1 rounded-full glass-chip w-full max-w-md">
      {tabs.map((t) => {
        const active =
          pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center py-1.5 text-xs font-medium rounded-full transition ${
              active
                ? "bg-rog-purple text-white"
                : "text-rog-muted hover:text-rog-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
