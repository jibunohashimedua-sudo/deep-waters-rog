"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** Named in the message, so a reader knows which pane gave up. */
  label: string;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * One pane's worth of failure.
 *
 * The app had no error boundary anywhere, which meant a lens that threw
 * took the whole page with it — and the Bench, and the verse you had
 * selected. A study surface with seven lenses on it is exactly the place
 * where one pane failing must not cost you the other six.
 *
 * This does not swallow anything: the error is reported to the console the
 * way an unhandled one would be, and the pane says plainly that it failed
 * rather than rendering an empty box that reads as "no data".
 */
export default class BenchPaneBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[deep-waters] bench pane "${this.props.label}":`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bench-lens-body">
          <p className="bench-empty">
            This pane stopped. Nothing you have saved is affected, and the
            rest of the Bench is still here.
          </p>
          <p className="bench-source">
            {this.props.label}: {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
