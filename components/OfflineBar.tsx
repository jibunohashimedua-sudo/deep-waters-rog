"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useOnline } from "@/lib/offline/useOnline";
import { startQueue, subscribeQueue } from "@/lib/offline/queue";
import { claimOfflineStore } from "@/lib/offline/session";

/**
 * Where the reader stands, in one line.
 *
 * Three states, and only ever one of them on screen:
 *
 *   offline — a quiet hairline saying so, and reassuring them their reading
 *   is being kept. Not a warning. Somebody on the Piccadilly line has not
 *   done anything wrong and does not need a red bar about it.
 *
 *   online with writes still waiting — the count, in mono, because it is a
 *   number and numbers are mono here. This is the brief's "show the user
 *   what is waiting to sync".
 *
 *   online with something the server refused — the one case that is worth
 *   colour, because it is the only one where nothing further will happen
 *   without the reader.
 *
 * When there is nothing to say it renders nothing, which is almost always.
 *
 * Fathom: square, one hairline rule, no shadow, no blur, no rounded
 * container. It sits under the header rather than floating over the page,
 * so it moves the content down honestly instead of covering a line of it.
 *
 * It also does the offline layer's boot work — claiming the store for this
 * reader and starting the queue — because it is rendered by Nav, which is on
 * every signed-in screen and nowhere else. A second component to hold two
 * effects would be a second thing to remember to render.
 */
export default function OfflineBar({ userId }: { userId: string | null }) {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  // Whose device is this? A store belonging to somebody else is deleted
  // before a single row of it is read. See lib/offline/session.ts — this is
  // the guard that actually holds, because signing out is not guaranteed to
  // have run.
  useEffect(() => {
    if (!userId) return;
    void claimOfflineStore(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const stop = startQueue();
    return stop;
  }, [userId]);

  useEffect(() => {
    let previous = 0;
    return subscribeQueue((s) => {
      setPending(s.pending);
      setBlocked(s.blocked);
      // "Confirm quietly when it has gone through." Only when something was
      // actually waiting and now is not — never on a first load with an
      // empty queue, which would be congratulating somebody for nothing.
      if (previous > 0 && s.pending === 0) {
        setJustSynced(true);
        window.setTimeout(() => setJustSynced(false), 3200);
      }
      previous = s.pending;
    });
  }, []);

  if (!userId) return null;

  if (!online) {
    return (
      <div className="offline-bar" role="status" aria-live="polite">
        <span className="offline-bar-dot" aria-hidden />
        <span>
          Offline — your reading is saved
          {pending > 0 && (
            <>
              {" · "}
              <span className="offline-bar-count">{pending}</span> waiting
            </>
          )}
        </span>
      </div>
    );
  }

  if (blocked > 0) {
    return (
      <div className="offline-bar" data-tone="attention" role="status">
        <span>
          <span className="offline-bar-count">{blocked}</span>{" "}
          {blocked === 1 ? "item" : "items"} couldn&rsquo;t be saved.{" "}
          <Link href="/preferences#waiting" className="offline-bar-link">
            See why
          </Link>
        </span>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <div className="offline-bar" role="status" aria-live="polite">
        <span>
          Syncing <span className="offline-bar-count">{pending}</span>{" "}
          {pending === 1 ? "change" : "changes"}
        </span>
      </div>
    );
  }

  if (justSynced) {
    return (
      <div className="offline-bar" data-tone="done" role="status" aria-live="polite">
        <span>Everything&rsquo;s synced</span>
      </div>
    );
  }

  return null;
}
