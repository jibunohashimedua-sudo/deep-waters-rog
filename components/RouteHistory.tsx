"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { noteNavigation } from "@/lib/navHistory";

/**
 * Counts route changes so a back control knows whether there is a page
 * of this app behind the current one. Mounted once, in the root layout,
 * because it has to see every navigation — including the ones on screens
 * that have no back control of their own.
 *
 * Path *and* query. A change of query is a change of page as far as the
 * history stack is concerned, and counting only the path would miss it:
 * two entries would exist and the back control would believe there was
 * one. useSearchParams is why this sits inside a Suspense boundary in
 * the layout — without one it would opt every route into client
 * rendering.
 *
 * Renders nothing.
 */
export default function RouteHistory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    noteNavigation(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}
