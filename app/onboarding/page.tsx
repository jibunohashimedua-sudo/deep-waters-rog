"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import PhotoCropper from "@/components/PhotoCropper";

function OnboardingPageInner() {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [cohortName, setCohortName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
      else router.push("/login");
    });
  }, [router, supabase]);

  useEffect(() => {
    const slug = searchParams.get("cohort");
    if (!slug) return;
    supabase
      .from("cohorts")
      .select("id, name, start_date")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCohortId(data.id);
          setCohortName(data.name);
          setStartDate(data.start_date);
        }
      });
  }, [searchParams, supabase]);

  const [cropperSrc, setCropperSrc] = useState<string | null>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Open the cropper with the picked file
    setCropperSrc(URL.createObjectURL(f));
    // Reset input so picking the same file again re-opens the cropper
    e.target.value = "";
  }

  function handleCropSave(blob: Blob) {
    const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setPhoto(cropped);
    // Revoke old preview URL to free memory
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(cropped));
    if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
  }

  function handleCropCancel() {
    if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    setError(null);

    let photoUrl: string | null = null;
    if (photo) {
      const ext = photo.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, photo, { upsert: true });
      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    const { error: insErr } = await supabase.from("profiles").upsert({
      id: userId,
      name: name.trim(),
      photo_url: photoUrl,
      start_date: startDate,
      cohort_id: cohortId
    });

    if (insErr) {
      setLoading(false);
      setError(insErr.message);
      return;
    }

    // Cohort join is part of the same submit now. Used to be fire-and-forget
    // after the profile write, so a network blip between the two left a
    // profile row that middleware would admit forever while the user was
    // never actually in the cohort they signed up through.
    if (cohortId) {
      const { error: memberErr } = await supabase
        .from("cohort_members")
        .upsert(
          { cohort_id: cohortId, user_id: userId, role: "member" },
          { onConflict: "cohort_id,user_id" }
        );
      if (memberErr) {
        setLoading(false);
        setError(memberErr.message);
        return;
      }
    }

    await supabase.from("events").insert({ user_id: userId, event: "signup", meta: { cohort_id: cohortId } });

    setLoading(false);
    router.push("/today");
  }

  return (
    <main className="main-plain min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <p className="kicker text-center">Welcome</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight text-center">
          Set up your profile
        </h1>
        <p className="mt-3 text-center text-rog-muted text-sm">
          This is how you&rsquo;ll show up in Deep Waters.
        </p>

        {cohortName && (
          <div className="mt-6 surface-soft text-center">
            <p className="kicker">Joining cohort</p>
            <p className="mt-3 font-serif text-lg font-medium text-rog-purple">{cohortName}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="flex flex-col items-center">
            <label className="cursor-pointer">
              <div className="w-32 h-32 rounded-full bg-rog-cream border-2 border-dashed border-rog-line flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="preview"
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-rog-muted text-sm">Add photo</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />
            </label>
            <p className="mt-2 text-xs text-rog-muted">
              {photoPreview ? "Tap to change" : "Tap to upload"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              required
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we call you?"
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!!cohortName}
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-rog-muted">
              {cohortName
                ? "Set by your cohort. Cannot be changed."
                : "Today = Day 1. Change it if your cohort starts later."}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Enter Deep Waters"}
          </button>
          {error && (
            <p className="text-sm text-danger text-center">{error}</p>
          )}
        </form>
      </div>

      {cropperSrc && (
        <PhotoCropper
          src={cropperSrc}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}
    </main>
  );
}

import { Suspense } from "react";
export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-rog-muted">Loading...</div>}>
      <OnboardingPageInner />
    </Suspense>
  );
}
