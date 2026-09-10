"use client";
import { useEffect } from "react";

/**
 * Install the offline worker, once, out of everybody's way.
 *
 * Registration is deferred twice over — until after `load`, and then until
 * the browser says it is idle. That is not caution for its own sake. The
 * cold load of this app was measured and cut hard in the performance pass
 * before this one, and a service worker registering during startup competes
 * for exactly the main-thread time that pass bought back. Nothing here is
 * needed on the visit that installs it; everything here is for the visit
 * after, and the one in the tunnel after that.
 *
 * On a repeat visit the worker is already installed and this does nothing at
 * all but ask the browser to check for a new copy.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // A dev server rebuilds routes on demand; a worker holding an old shell
    // across a hot reload is confusing rather than useful.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Blocked by a browser setting, a private window, or an insecure
        // origin. The app works exactly as it did before offline existed.
      });
    };

    const whenIdle = () => {
      if (cancelled) return;
      // requestIdleCallback is still missing from Safari, which is most of
      // this congregation's phones, so the timeout is the real path there
      // rather than a fallback nobody takes.
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback;
      if (typeof ric === "function") ric(register);
      else window.setTimeout(register, 1200);
    };

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
    };
  }, []);

  return null;
}
