"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The opening animation. A fixed overlay, nothing more — the app renders and
 * hydrates underneath it from the first paint, and no fetch, route or render
 * is gated on it. It covers load; it never creates it.
 *
 * Shows on a full page load only, never on internal navigation: this sits in
 * the root layout, which App Router does not remount when you move between
 * routes, so the component simply never mounts a second time.
 *
 * There is deliberately no "have I played before?" flag. Suppressing the
 * splash on a reload would need sessionStorage, which this project doesn't
 * use — and a reload is a load, which is precisely what the animation is
 * here to cover.
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    // remove the overlay, never hold it: the stage-out is over by 2220ms, and
    // this sits far enough past that it can't clip the end of the animation.
    const failsafe = window.setTimeout(done, 3200);
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <>
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
