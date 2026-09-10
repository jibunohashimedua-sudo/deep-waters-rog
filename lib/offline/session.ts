"use client";
import { deleteDatabase, kvGet, kvSet, storageAvailable } from "./db";

/**
 * Who the offline store belongs to, and getting rid of it when it stops
 * belonging to them.
 *
 * Two people share a phone. One reads Romans and writes a note about verse
 * eight; the other signs in the next morning. Nothing of the first must be
 * there — not the note, not the highlight, not the progress, not the cached
 * feed. There are two guards for that, deliberately, because sign-out is not
 * guaranteed to run: a phone can be force-quit mid-session, a session can
 * expire server-side, a tab can be closed on the sheet.
 *
 *   1. Signing out purges, before the session is dropped.
 *   2. Arriving as somebody the store does not belong to purges, before
 *      anything is read.
 *
 * The second is the one that actually holds the promise. The first is there
 * so the phone is not carrying a stranger's notes around in the meantime.
 */

const OWNER_KEY = "meta:user";

/** The one localStorage key this feature owns, mirrored for the head script
    which runs before any of this module could. */
export const PREFS_KEY = "dw_prefs";

/**
 * Everything, gone: the database, the mirrored preferences, and every cache
 * the service worker holds.
 *
 * Awaited by sign out rather than fired off, so the session is still alive
 * while it runs. Capped, because a browser that will not let go of a
 * database must not be able to trap somebody on a screen they are trying to
 * leave — signing out has to win either way.
 */
export async function purgeOffline(): Promise<void> {
  const jobs: Promise<unknown>[] = [deleteDatabase(), purgeWorkerCaches()];

  try {
    localStorage.removeItem(PREFS_KEY);
    // The two the app mirrored before this feature existed. Theme is the one
    // that would give a departing reader's choice to the next person.
    localStorage.removeItem("theme");
  } catch {
    /* Private mode. Nothing was stored, so nothing needs removing. */
  }

  await Promise.race([
    Promise.all(jobs),
    new Promise((resolve) => setTimeout(resolve, 3500))
  ]);
}

/** Ask the worker to drop its caches, and wait for it to say it has. */
function purgeWorkerCaches(): Promise<void> {
  return new Promise((resolve) => {
    // Delete them from here as well as asking the worker to. Either alone
    // is enough; both means a worker that has been stopped by the browser
    // cannot leave anything behind.
    const direct = (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(
          names.filter((n) => n.startsWith("dw-")).map((n) => caches.delete(n))
        );
      } catch {
        /* No Cache Storage in this browser, or none of ours. */
      }
    })();

    try {
      const worker = navigator.serviceWorker?.controller;
      if (!worker) return void direct.then(() => resolve());
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type !== "DW_PURGED") return;
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve();
      };
      navigator.serviceWorker.addEventListener("message", onMessage);
      worker.postMessage({ type: "DW_PURGE" });
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve();
      }, 2000);
    } catch {
      void direct.then(() => resolve());
    }
  });
}

/**
 * Make sure the store belongs to the person now signed in.
 *
 * Returns true when the store was usable as it stood, false when it had to
 * be thrown away first — callers that were about to read from it should
 * treat false as "there is nothing cached", which is the truth.
 *
 * Runs before anything else reads the database, on every signed-in page.
 */
export async function claimOfflineStore(userId: string): Promise<boolean> {
  if (!storageAvailable() || !userId) return false;

  const owner = await kvGet<string>(OWNER_KEY);
  if (owner === userId) return true;

  if (owner) {
    // Somebody else's. Not merged, not filtered — deleted.
    await purgeOffline();
  }
  await kvSet(OWNER_KEY, userId);
  return false;
}

export async function offlineOwner(): Promise<string | null> {
  return kvGet<string>(OWNER_KEY);
}
