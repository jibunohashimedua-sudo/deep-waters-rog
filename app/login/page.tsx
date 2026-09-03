"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginPageInner() {
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
    // If they came from a cohort link, send them there after login
    const nextPath = cohort ? `/c/${cohort}` : `/today`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center">
          <Image src="/rog-heart-purple.png" alt="ROG" width={80} height={80} className="w-20 h-20 object-contain" />
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-rog-purple text-center">Sign in</h1>
        <p className="mt-2 text-center text-rog-muted text-sm">
          We&rsquo;ll email you a magic link.
        </p>

        {sent ? (
          <div className="mt-8 card text-center">
            <p className="text-rog-purple font-semibold">Check your email</p>
            <p className="mt-2 text-sm text-rog-muted">
              We sent a magic link to <b>{email}</b>. Click it to sign in.
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
              {loading ? "Sending..." : "Send magic link"}
            </button>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </form>
        )}

        <p className="mt-6 text-center text-sm text-rog-muted">
          New here?{" "}
          <Link href="/signup" className="text-rog-purple font-semibold">
            Join Deep Waters
          </Link>
        </p>
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
