"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
      <div className="skeleton h-64 w-64" />
    </div>
  )
});
import { createClient } from "@/lib/supabase/client";
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
  const [msg, setMsg] = useState<string | null>(null);
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
        setMsg(upErr.message);
        setSaving(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      finalPhoto = `${data.publicUrl}?v=${Date.now()}`;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        photo_url: finalPhoto,
        email_reminders: emailReminders,
        push_reminders: pushReminders,
        reminder_hour: reminderHour,
        preferred_bible_id: bibleId
      })
      .eq("id", userId);

    setSaving(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Saved");
      router.refresh();
      setTimeout(() => router.push("/me"), 600);
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <main className="max-w-lg mx-auto px-6 py-10">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-3 h-9 w-64" />
          <div className="skeleton mt-8 h-32 w-32 !rounded-full mx-auto" />
          <div className="skeleton mt-6 h-12 w-full" />
          <div className="skeleton mt-4 h-24 w-full" />
        </main>
      </>
    );
  }

  if (loadFailed) {
    return (
      <>
        <Nav />
        <main className="max-w-lg mx-auto px-6 py-10">
          <div className="card text-center">
            <p className="font-semibold text-rog-purple">Couldn&rsquo;t load your profile</p>
            <p className="mt-2 text-sm text-rog-muted">
              Nothing has been changed. Refresh to try again.
            </p>
          </div>
        </main>
      </>
    );
  }

  const displayPhoto = preview ?? photoUrl;

  return (
    <>
      <Nav />
      <main className="max-w-lg mx-auto px-6 py-10">
        <p className="kicker">Profile</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">Edit your profile</h1>

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div className="flex flex-col items-center">
            <label className="cursor-pointer">
              <div className="w-32 h-32 rounded-full bg-rog-cream border-2 border-dashed border-rog-line flex items-center justify-center overflow-hidden">
                {displayPhoto ? (
                  <Image src={displayPhoto} alt="" width={128} height={128} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-rog-muted text-sm">Add photo</span>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
            <p className="mt-2 text-xs text-rog-muted">Tap to change</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bio (optional)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              maxLength={160}
              placeholder="A line about you"
              className="w-full border border-rog-line bg-white px-6 py-3 focus:border-rog-purple focus:outline-none"
            />
          </div>

          {/* Which translation scripture is shown in, everywhere: the daily
              plan, the Bible browser, all of it. Stored on the profile rather
              than in the browser so it follows you between devices. */}
          <div className="card space-y-3">
            <p className="kicker">Translation</p>
            <label className="block">
              <span className="sr-only">Bible translation</span>
              <select
                value={bibleId}
                onChange={(e) => setBibleId(e.target.value)}
                className="w-full min-h-[44px] rounded-full border border-rog-line bg-white px-5 py-2 text-sm focus:border-rog-purple focus:outline-none"
              >
                {TRANSLATION_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {TRANSLATIONS.filter((t) => t.group === g).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.abbr} — {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="text-xs text-rog-muted leading-relaxed">
              {translationById(bibleId).note}
            </p>
            <p className="text-xs text-rog-muted leading-relaxed">
              Your 90 days stay exactly the same — same books, same chapters,
              same days. Only the wording changes, and your highlights and
              notes stay where you put them.
            </p>
          </div>

          <div className="card space-y-4">
            <p className="kicker">Reminders</p>
            <label className="flex items-center justify-between">
              <span className="text-sm">Email reminders</span>
              <input
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
                className="w-5 h-5 accent-rog-purple"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Push notifications</span>
              <input
                type="checkbox"
                checked={pushReminders}
                onChange={(e) => setPushReminders(e.target.checked)}
                className="w-5 h-5 accent-rog-purple"
              />
            </label>
            <label className="block">
              <span className="text-sm">Remind me at</span>
              <select
                value={reminderHour}
                onChange={(e) => setReminderHour(Number(e.target.value))}
                className="mt-1 w-full rounded-full border border-rog-line bg-white px-4 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? "Saving..." : "Save changes"}
          </button>
          {msg && <p className="text-sm text-center text-rog-purple">{msg}</p>}
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
