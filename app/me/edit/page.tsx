"use client";
import { useState, useEffect } from "react";
import LoadingRule from "@/components/LoadingRule";
import { useRouter } from "next/navigation";
import SelectSheet from "@/components/SelectSheet";
import Check from "@/components/Check";
import Image from "next/image";
import Nav from "@/components/Nav";
import dynamic from "next/dynamic";

// react-easy-crop is the heaviest thing this page can reach, and nobody
// touches it unless they pick a photo. Loading it on demand keeps it out
// of the bundle everyone downloads just to change their reminder time.
const PhotoCropper = dynamic(() => import("@/components/PhotoCropper"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      role="status"
      aria-label="Opening the photo editor"
    >
      <LoadingRule label="Opening the photo editor" />
    </div>
  )
});
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { PROFILE_NAME_MAX, PROFILE_BIO_MAX } from "@/lib/limits";
import {
  DEFAULT_BIBLE_ID,
  TRANSLATIONS,
  TRANSLATION_GROUPS,
  translationById
} from "@/lib/translations";

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [emailReminders, setEmailReminders] = useState(true);
  const [pushReminders, setPushReminders] = useState(true);
  const [reminderHour, setReminderHour] = useState(7);
  const [bibleId, setBibleId] = useState<string>(DEFAULT_BIBLE_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setUserId(user.id);
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      // An empty form here isn't harmless: saving it would overwrite the real
      // profile with blanks. Refuse to render the form at all if the load failed.
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[deep-waters] profile load failed:", error.message);
        setLoadFailed(true);
        setLoading(false);
        return;
      }
      if (p) {
        setName(p.name);
        setBio(p.bio ?? "");
        setPhotoUrl(p.photo_url);
        setEmailReminders(p.email_reminders);
        setPushReminders(p.push_reminders);
        setReminderHour(p.reminder_hour);
        // Absent until the translations migration has been run — the KJV
        // default in state already covers that case.
        if (p.preferred_bible_id) setBibleId(p.preferred_bible_id);
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCropperSrc(URL.createObjectURL(f));
    e.target.value = "";
  }

  function handleCropSave(blob: Blob) {
    const f = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setNewPhoto(f);
    setPreview(URL.createObjectURL(f));
    if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    setCropperSrc(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setMsg(null);

    let finalPhoto = photoUrl;
    if (newPhoto) {
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, newPhoto, { upsert: true });
      if (upErr) {
        setMsg({ kind: "error", text: friendlyError(upErr.message) });
        setSaving(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      finalPhoto = `${data.publicUrl}?v=${Date.now()}`;
    }

    // Server-side length caps live in /api/me. Fields that aren't strings
    // (booleans, numbers, the translation id) get validated the same way.
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        bio,
        photo_url: finalPhoto,
        email_reminders: emailReminders,
        push_reminders: pushReminders,
        reminder_hour: reminderHour,
        preferred_bible_id: bibleId
      })
    });

    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg({ kind: "error", text: friendlyError(j.error) });
      return;
    }
    setMsg({ kind: "ok", text: "Saved." });
    router.refresh();
    setTimeout(() => router.push("/depth"), 600);
  }

  if (loading) {
    return (
      <>
        <Nav />
        <main className="max-w-lg mx-auto px-6 py-10">
          <LoadingRule label="Loading your profile" />
        </main>
      </>
    );
  }

  if (loadFailed) {
    return (
      <>
        <Nav />
        <main className="max-w-lg mx-auto px-6 py-10">
          <h1 className="text-[27px] font-semibold tracking-[-0.025em] text-rog-ink leading-[1.14]">
            Couldn&rsquo;t load your profile
          </h1>
          <p className="mt-3 text-[13.5px] leading-5 text-rog-muted">
            Nothing has been changed. Refresh to try again.
          </p>
        </main>
      </>
    );
  }

  const displayPhoto = preview ?? photoUrl;

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-6 py-10">
        {/* No meta over the heading. "Profile" named the one thing
            directly beneath it, which is the heading saying what the
            heading says. */}
        <h1 className="text-[27px] font-semibold tracking-[-0.025em] text-rog-ink leading-[1.14]">
          Edit your profile
        </h1>

        <form onSubmit={handleSave} className="mt-10">
          {/* Square, like every portrait in the app. It was a 128px circle
              with a dashed ring, which is two things this system doesn't
              have: a round person, and a dashed border. */}
          <div className="flex flex-col items-center">
            <label className="cursor-pointer">
              <div className="portrait-fallback w-32 h-32 text-[10px] overflow-hidden">
                {displayPhoto ? (
                  <Image
                    src={displayPhoto}
                    alt=""
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Add photo</span>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
            <p className="meta mt-3">Tap to change</p>
          </div>

          {/* Fields are square recessed plates — the global input rules in
              globals.css already say so. They were carrying `rounded-full`,
              which beat those rules and made every text field a pill. A pill
              means "press me"; a field you type into is a container, and
              containers in this system have corners. */}
          <div className="mt-10">
            <label htmlFor="pf-name" className="block text-[13.5px] leading-5 font-medium text-rog-ink">
              Name
            </label>
            <input
              id="pf-name"
              required
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              maxLength={PROFILE_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full min-h-[44px] border px-4 py-3 text-[13.5px]"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="pf-bio" className="block text-[13.5px] leading-5 font-medium text-rog-ink">
              Bio
            </label>
            <p className="meta mt-1">160 characters</p>
            <textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              maxLength={PROFILE_BIO_MAX}
              enterKeyHint="done"
              placeholder="A line about you"
              className="mt-2 w-full border px-4 py-3 text-[13.5px] leading-5"
            />
          </div>

          {/* Which translation scripture is shown in, everywhere: the daily
              plan, the Bible browser, all of it. Stored on the profile rather
              than in the browser so it follows you between devices. */}
          <section className="mt-10 border-t border-rog-line pt-6">
            <h2 className="text-[13.5px] leading-5 font-medium text-rog-ink">Translation</h2>
            <label className="block">
              <span className="sr-only">Bible translation</span>
              <SelectSheet
                label="Bible translation"
                value={bibleId}
                onChange={setBibleId}
                className="mt-3"
                options={TRANSLATION_GROUPS.flatMap((g) =>
                  TRANSLATIONS.filter((t) => t.group === g).map((t) => ({
                    value: t.id,
                    label: `${t.abbr} — ${t.name}`,
                    group: g
                  }))
                )}
              />
            </label>
            <p className="mt-3 text-[13.5px] leading-5 text-rog-muted">
              {translationById(bibleId).note}
            </p>
            <p className="mt-2 text-[13.5px] leading-5 text-rog-muted">
              Your 90 days stay exactly the same &mdash; same books, same
              chapters, same days. Only the wording changes, and your
              highlights and notes stay where you put them.
            </p>
          </section>

          <section className="mt-10 border-t border-rog-line pt-6">
            <h2 className="text-[13.5px] leading-5 font-medium text-rog-ink">Reminders</h2>

            {/* Drawn, not native: accent-color hands the platform the
                fill, and the platform's purple is not ours. 44px rows. */}
            <div className="mt-3">
              <Check
                label="Email reminders"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
              />
            </div>
            <div className="border-t border-rog-line">
              <Check
                label="Push notifications"
                checked={pushReminders}
                onChange={(e) => setPushReminders(e.target.checked)}
              />
            </div>

            <label className="block border-t border-rog-line pt-4">
              <span className="text-[13.5px] leading-5 text-rog-ink">Remind me at</span>
              <SelectSheet
                label="Remind me at"
                value={String(reminderHour)}
                onChange={(v) => setReminderHour(Number(v))}
                className="mt-2 font-mono tabular-nums"
                options={Array.from({ length: 24 }, (_, h) => ({
                  value: String(h),
                  label: `${h.toString().padStart(2, "0")}:00`
                }))}
              />
            </label>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary mt-10 w-full disabled:opacity-50"
          >
            {saving ? "Saving\u2026" : "Save changes"}
          </button>
          {msg && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-4 text-center text-[13.5px] leading-5 ${
                msg.kind === "ok" ? "text-success" : "text-danger"
              }`}
            >
              {msg.text}
            </p>
          )}
        </form>
      </main>

      {cropperSrc && (
        <PhotoCropper
          src={cropperSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropperSrc);
            setCropperSrc(null);
          }}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
