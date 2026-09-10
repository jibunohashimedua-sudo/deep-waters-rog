import type { Metadata } from "next";
import OfflineShell from "@/components/OfflineShell";

/**
 * The one document the service worker keeps.
 *
 * It is here rather than inside any of the real routes because of what it
 * must NOT contain. Every signed-in page in Deep Waters is server-rendered
 * with somebody's name, somebody's notes, somebody's reflection in it, and a
 * cached copy of one of those is a copy of a person's reading sitting in the
 * browser's cache where the sign-out purge has to remember to find it. This
 * page has nothing of anybody in it. It reads no cookie, queries nothing,
 * and is prerendered once at build time, byte-identical for every reader in
 * the church. The worker fetches it with `credentials: "omit"` so that even
 * by accident it cannot be personalised — which is also why /offline is on
 * the middleware's public list.
 *
 * Everything the reader sees on it is drawn afterwards, in their own
 * browser, out of their own IndexedDB.
 *
 * `force-static` is not an optimisation here, it is the guarantee. If this
 * page ever became dynamic — one `cookies()` call, one Supabase client — it
 * would start carrying a session, and the worker would start storing it.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline · Deep Waters",
  // Nothing to index: it is a fallback, not a destination.
  robots: { index: false, follow: false }
};

export default function OfflinePage() {
  return <OfflineShell />;
}
