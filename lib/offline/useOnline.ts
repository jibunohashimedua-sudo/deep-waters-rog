"use client";
import { useEffect, useState } from "react";

/**
 * Whether the app can reach the network.
 *
 * `navigator.onLine` alone is not enough and is worst exactly where this
 * matters most. On iOS it reports true for a phone attached to a wifi
 * network with no route out — a hotel captive portal, a train's carriage
 * wifi, an aeroplane's — and it is slow to flip when a tunnel takes the
 * signal. So it is treated as one vote of two: the browser's opinion, and
 * what actually happened the last time we tried to send something.
 *
 * A request that failed at the network layer marks us offline immediately.
 * Any request that succeeds marks us back online immediately. That is the
 * honest signal, because it is the same thing the reader is experiencing.
 *
 * Module state rather than a context so the two halves — the components
 * that display it and the fetch helpers that report into it — do not have
 * to be arranged in a tree around each other.
 */

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

/** Starts optimistic. A first render that guessed wrong corrects itself
    within a request, and guessing "offline" would put an alarming bar in
    front of everyone who is perfectly fine. */
let online = true;

function announce(next: boolean) {
  if (next === online) return;
  online = next;
  for (const l of listeners) l(next);
}

/** Call after any request that failed with a network error (not a 4xx or a
    5xx — those mean the network is fine and the server disagreed). */
export function reportOffline(): void {
  announce(false);
}

/** Call after any request that came back at all, whatever its status. */
export function reportOnline(): void {
  announce(true);
}

export function isOnline(): boolean {
  return online;
}

/**
 * True when a rejected fetch means "no network", rather than something the
 * app did wrong. A `fetch` rejects for exactly two reasons that matter here
 * — no route to the host, and an aborted request — and only the first is a
 * connectivity signal.
 */
export function isNetworkError(err: unknown): boolean {
  const e = err as { name?: string } | null;
  if (e?.name === "AbortError") return false;
  return true;
}

/**
 * `fetch`, with the outcome reported into the signal above.
 *
 * Every call the app makes that could tell us something about the network
 * goes through this, so the offline bar is driven by what really happened
 * rather than by the browser's guess.
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const res = await fetch(input, init);
    reportOnline();
    return res;
  } catch (err) {
    if (isNetworkError(err)) reportOffline();
    throw err;
  }
}

if (typeof window !== "undefined") {
  online = navigator.onLine !== false;
  // The browser's events are still worth having: going offline is reported
  // promptly and reliably even when coming back is not.
  window.addEventListener("offline", () => announce(false));
  window.addEventListener("online", () => announce(true));
}

export function useOnline(): boolean {
  const [value, setValue] = useState(true);

  useEffect(() => {
    // Read on mount rather than during render: the server has no navigator,
    // and a first client render that disagreed with the server's HTML would
    // be a hydration mismatch on every page in the app.
    setValue(online);
    const listener: Listener = (next) => setValue(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return value;
}
