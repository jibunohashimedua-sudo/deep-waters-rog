"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

const MIN_PASSWORD = 8;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const supabase = createClient();

  // Arriving from the emailed link, /auth/callback has already exchanged the
  // recovery code for a session. No session means the link was stale or was
  // opened in a different browser than the one that requested it.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
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

        {ready === false ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">This link has expired</p>
            <p className="mt-2 text-sm text-rog-muted">
              Password links only work once, and only in the browser that asked for them. Request a
              fresh one and open it on this device.
            </p>
            <Link href="/forgot-password" className="btn-primary mt-6 inline-block">
              Send a new link
            </Link>
          </div>
        ) : ready === null ? (
          <p className="mt-8 text-center text-rog-muted text-sm">Checking your link…</p>
        ) : (
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
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
