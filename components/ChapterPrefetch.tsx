"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Warm the next chapter while this one is being read, so "Next" feels
 * instant. Prefetching the route renders it on the server, which also fills
 * the shared bible_cache — the next reader of that chapter gets it free too.
 *
 * Fires once, after paint, and never blocks anything on this page.
 */
export default function ChapterPrefetch({ href }: { href: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!href) return;
    const id = window.setTimeout(() => router.prefetch(href), 400);
    return () => window.clearTimeout(id);
  }, [href, router]);
  return null;
}
