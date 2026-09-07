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
    <div className="mb-6 flex gap-2">
      {tabs.map((t) => {
        const active =
          pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className="chip !min-h-[38px] px-4"
            data-on={active ? "true" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
