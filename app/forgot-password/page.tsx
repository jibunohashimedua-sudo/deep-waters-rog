"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Point straight at the reset page — no server callback hop. The server
    // route can only read a ?code= query param, which goes missing both when
    // Supabase appends it to a URL that already has a query string and when
    // the link is opened in a different browser than requested it. The reset
    // page handles every arrival shape on the client instead.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    if (error) setError(friendlyError(error.message));
    else setSent(true);
  }

  return (
    <main className="main-plain min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight text-center">
          Set your password
        </h1>
        <p className="mt-2 text-center text-rog-muted text-sm">
          We&rsquo;ll email you a link to choose a new one.
        </p>

        {sent ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">Check your email</p>
            <p className="mt-2 text-sm text-rog-muted">
              If there&rsquo;s an account for <b>{email}</b>, a link is on its way. Open it on this
              device and you&rsquo;ll be able to set a new password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-rog-line px-4 py-3 focus:border-rog-purple focus:outline-none"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Sending…" : "Send the link"}
            </button>
            {error && <p className="text-sm text-danger text-center">{error}</p>}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-rog-muted">
          <Link href="/login" className="text-rog-purple font-semibold">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading…</div>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
