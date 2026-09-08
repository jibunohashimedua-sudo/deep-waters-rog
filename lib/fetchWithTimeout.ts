/**
 * `fetch` with an AbortController-backed timeout.
 *
 * Callers get a named `TimeoutError` on the deadline so they can tell
 * timeout apart from a network error, an HTTP error, or a parse error.
 * Retry logic lives at call sites, not here — this file's job is to make
 * "the upstream is stalling" observable, not to hide it.
 */

export class TimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(ms: number, url?: string) {
    super(
      url ? `Timeout after ${ms}ms: ${url}` : `Timeout after ${ms}ms`
    );
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}

/**
 * Wrap `fetch` with a timeout. Rejects with `TimeoutError` when the
 * deadline hits; anything else propagates as-is.
 *
 * If the caller passes its own `AbortSignal` in `init.signal`, both
 * signals combine — either can abort the request.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 6000
): Promise<Response> {
  const controller = new AbortController();
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  const timer = setTimeout(() => controller.abort(new TimeoutError(timeoutMs, url)), timeoutMs);

  // If the caller already provided a signal, fold it in so their abort
  // still fires and ours does too.
  if (init.signal) {
    const outer = init.signal;
    if (outer.aborted) {
      clearTimeout(timer);
      controller.abort(outer.reason);
    } else {
      outer.addEventListener("abort", () => controller.abort(outer.reason), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    // AbortController surfaces our TimeoutError as reason; some runtimes
    // wrap it in a DOMException, so also translate that shape.
    if (controller.signal.reason instanceof TimeoutError) {
      throw controller.signal.reason;
    }
    if (err?.name === "AbortError") {
      throw new TimeoutError(timeoutMs, url);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
