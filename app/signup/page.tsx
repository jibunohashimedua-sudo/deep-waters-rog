"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

function SignupPageInner() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const cohort = searchParams.get("cohort");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const nextPath = cohort
      ? `/onboarding?cohort=${encodeURIComponent(cohort)}`
      : `/onboarding`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    });
    setLoading(false);
    if (error) setError(friendlyError(error.message));
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl font-medium text-rog-ink leading-tight text-center">Join Deep Waters</h1>
        <p className="mt-2 text-center text-rog-muted text-sm">
          Enter your email to get started.
        </p>

        {sent ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">Check your email</p>
            <p className="mt-2 text-sm text-rog-muted">
              We sent a magic link to <b>{email}</b>. Click it to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Sending..." : "Continue"}
            </button>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-rog-muted">
          Already joined?{" "}
          <Link href="/login" className="text-rog-purple font-semibold">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading...</div>}>
      <SignupPageInner />
    </Suspense>
  );
}
