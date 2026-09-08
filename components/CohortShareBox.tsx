"use client";
import { useState } from "react";

export default function CohortShareBox({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${slug}`
      : `/c/${slug}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-6 card">
      <p className="kicker">Invite others</p>
      <h3 className="mt-1 font-bold text-rog-purple">Share this cohort</h3>
      <p className="mt-2 text-sm text-rog-muted">
        Send this link. Anyone who signs up through it joins this cohort with
        the same start date.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          readOnly
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          className="flex-1 rounded-full border border-rog-line bg-rog-cream px-4 py-2 text-sm truncate"
        />
        <button onClick={handleCopy} className="btn-primary whitespace-nowrap">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
