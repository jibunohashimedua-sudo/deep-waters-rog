"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

const MIN_PASSWORD = 8;

function SignupPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const searchParams = useSearchParams();
  const cohort = searchParams.get("cohort");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Make your password at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      setError(friendlyError(error.message));
      return;
    }

    // With email confirmation off, signUp hands back a live session and we go
    // straight into onboarding. With it on, there's no session yet and they
    // have to confirm by email first.
    if (data.session) {
      window.location.href = cohort
        ? `/onboarding?cohort=${encodeURIComponent(cohort)}`
        : "/onboarding";
      return;
    }
    setLoading(false);
    setCheckEmail(true);
  }

  return (
    <main className="main-plain min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight text-center">
          Join Deep Waters
        </h1>
        <p className="mt-2 text-center text-rog-muted text-sm">
          Ninety days, start to finish. Set up takes a minute.
        </p>

        {checkEmail ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">Confirm your email</p>
            <p className="mt-2 text-sm text-rog-muted">
              We sent a confirmation link to <b>{email}</b>. Open it, then come back and sign in.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-block">
              Go to sign in
            </Link>
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
            <div>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                className="w-full border border-rog-line px-4 py-3 focus:border-rog-purple focus:outline-none"
              />
              <p className="mt-2 px-6 text-xs text-rog-muted">
                At least {MIN_PASSWORD} characters.
              </p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Creating your account…" : "Continue"}
            </button>
            {error && <p className="text-sm text-danger text-center">{error}</p>}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-rog-muted">
          Already joined?{" "}
          <Link href={cohort ? `/login?cohort=${cohort}` : "/login"} className="text-rog-purple font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading…</div>}>
      <SignupPageInner />
    </Suspense>
  );
}
