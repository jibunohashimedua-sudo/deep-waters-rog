"use client";

import { useEffect, useRef, useState } from "react";

// Runs while the HTML is still parsing, before React hydrates — the same trick
// layout.tsx uses for the theme. It decides once per tab whether the splash is
// owed, and stamps <html> so CSS can hide the overlay instantly on later loads.
// Deciding in an effect instead would flash the whole animation for as long as
// hydration takes, every time someone reloaded.
const gateScript = `
(function() {
  var seen = false;
  try {
    seen = sessionStorage.getItem('dw:launched') === '1';
    sessionStorage.setItem('dw:launched', '1');
  } catch (e) {}
  document.documentElement.dataset.dwSplash = seen ? 'skip' : 'show';
})();
`;

/**
 * The opening animation. A fixed overlay, nothing more — the app renders and
 * hydrates underneath it from the first paint, and no fetch, route or render
 * is gated on it. It covers load; it never creates it.
 *
 * Shows on the first load of a tab only, not on client-side navigation (this
 * sits in the root layout, which App Router never remounts between routes).
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Already launched this session: drop the overlay on the same tick that
    // CSS has already hidden it.
    if (document.documentElement.dataset.dwSplash === "skip") {
      setVisible(false);
      return;
    }

    let cancelled = false;
    const done = () => {
      if (!cancelled) setVisible(false);
    };

    // The animation is CSS, so it plays whether or not React has caught up —
    // and on a cold cache or a slow phone hydration can land after the stage
    // has already faded out. The onAnimationEnd binding below would miss that
    // event entirely and leave an invisible full-screen layer swallowing taps.
    // Asking the animation itself settles both cases: still running, it
    // resolves when it ends; already over, it resolves immediately.
    const running = rootRef.current?.getAnimations?.() ?? [];
    if (running.length) {
      Promise.all(running.map((a) => a.finished)).then(done, () => {});
    }

    // Failsafe for anything neither path covers — no getAnimations, a
    // stylesheet that never arrived, a tab restored mid-flight. It can only
    // remove the overlay, never hold it: the stage-out is over by 1360ms.
    const failsafe = window.setTimeout(done, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: gateScript }} />
      {visible && (
        <div
          ref={rootRef}
          className="dw-launch"
          aria-hidden="true"
          // The bar and wordmark animations bubble up here too, so only the
          // stage fade means the overlay is actually finished.
          onAnimationEnd={(e) => {
            if (e.animationName === "dw-stage-out") setVisible(false);
          }}
        >
          <div className="dw-launch-inner">
            <div className="dw-launch-mark">
              <div className="dw-bar dw-bar1" />
              <div className="dw-bar dw-bar2" />
              <div className="dw-bar dw-bar3" />
              <div className="dw-bar dw-bar4" />
            </div>
            <div className="dw-word">
              <span className="d">DEEP</span>
              <span className="w">WATERS</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
