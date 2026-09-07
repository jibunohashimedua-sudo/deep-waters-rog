"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

const MIN_PASSWORD = 8;

type Status = "checking" | "ready" | "expired";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const supabase = createClient();

  // A recovery link can hand us a session in more than one shape, and which
  // one depends on the Supabase flow config and on whether the link opened in
  // the same browser that requested it. Rather than assume, try each in turn.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      // Supabase reports a dead link via error params, in the query or hash.
      const errDesc =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      const errCode = url.searchParams.get("error") ?? hash.get("error");
      if (errDesc || errCode) {
        if (!cancelled) {
          setLinkError(errDesc ?? errCode);
          setStatus("expired");
        }
        return;
      }

      // 1. Tokens in the hash (implicit flow). Handle these explicitly rather
      //    than racing the client's own detectSessionInUrl.
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!cancelled && !error) {
          // Drop the tokens out of the address bar once they're banked.
          window.history.replaceState({}, "", "/reset-password");
          setStatus("ready");
          return;
        }
      }

      // 2. A PKCE code in the query string. Exchanged here on the client,
      //    where the verifier lives, instead of on the server.
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          window.history.replaceState({}, "", "/reset-password");
          setStatus("ready");
          return;
        }
      }

      // 3. A session already in place — either detectSessionInUrl got there
      //    first, or they're signed in and changing their password.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "ready" : "expired");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Make your password at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(friendlyError(error.message));
      return;
    }
    // Full navigation so the server picks up the session cookie.
    window.location.href = "/today";
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight text-center">
          Choose a password
        </h1>

        {status === "checking" && (
          <p className="mt-8 text-center text-rog-muted text-sm">Checking your link…</p>
        )}

        {status === "expired" && (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">This link didn&rsquo;t work</p>
            <p className="mt-2 text-sm text-rog-muted">
              Reset links only work once and they expire after an hour. Send yourself a fresh one
              and open it as soon as it arrives.
            </p>
            <Link href="/forgot-password" className="btn-primary mt-6 inline-block">
              Send a new link
            </Link>
            {linkError && (
              <p className="mt-4 text-xs text-rog-muted/70">Reason: {linkError}</p>
            )}
          </div>
        )}

        {status === "ready" && (
          <>
            <p className="mt-2 text-center text-rog-muted text-sm">
              Pick something you&rsquo;ll remember. You&rsquo;ll use it every time you sign in.
            </p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <input
                  type="password"
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-full border border-rog-line px-6 py-3 focus:border-rog-purple focus:outline-none"
                />
                <p className="mt-2 px-6 text-xs text-rog-muted">
                  At least {MIN_PASSWORD} characters.
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
                {loading ? "Saving…" : "Save and continue"}
              </button>
              {error && <p className="text-sm text-danger text-center">{error}</p>}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
