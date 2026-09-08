"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import Mark from "@/components/Mark";

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const cohort = searchParams.get("cohort");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(friendlyError(error.message));
      return;
    }
    // Full navigation so the server picks up the new session cookie.
    window.location.href = cohort ? `/c/${cohort}` : "/today";
  }

  const forgotHref = `/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  return (
    <main className="main-plain min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex justify-center">
          <Mark size={64} />
        </div>
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight text-center">
          Sign in
        </h1>
        <p className="mt-2 text-center text-rog-muted text-sm">
          Welcome back. Pick up where you left off.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-rog-line px-4 py-3 focus:border-rog-purple focus:outline-none"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="w-full border border-rog-line px-4 py-3 focus:border-rog-purple focus:outline-none"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <p className="text-sm text-danger text-center">{error}</p>}
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href={forgotHref} className="text-rog-muted hover:text-rog-purple">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-rog-muted">
          New here?{" "}
          <Link href={cohort ? `/signup?cohort=${cohort}` : "/signup"} className="text-rog-purple font-semibold">
            Join Deep Waters
          </Link>
        </p>

        {/* Everyone who joined before passwords existed has no password yet.
            This is their way in — one reset and they're set. */}
        <div className="mt-10 surface-soft text-center !p-4">
          <p className="text-xs text-rog-muted">
            Joined before and never set a password?{" "}
            <Link href={forgotHref} className="text-rog-purple font-medium">
              Set one here
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

import { Suspense } from "react";
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
