import { requireProfile } from "@/lib/auth";
import { readPreferences } from "@/lib/preferences";
import { DEFAULT_BIBLE_ID } from "@/lib/translations";
import Nav from "@/components/Nav";
import PreferencesForm from "@/components/PreferencesForm";

export const metadata = { title: "Preferences · Deep Waters" };

/**
 * Preferences.
 *
 * Everything that changes how the app looks or behaves for one person,
 * in one place, rather than scattered between the More sheet, the
 * profile screen and the browser. Reached from More.
 *
 * Read on the server from the profile, so the screen opens already
 * showing what is true rather than flickering from the defaults to the
 * reader's own settings a moment later.
 */
export default async function PreferencesPage() {
  const { profile } = await requireProfile();
  const prefs = readPreferences(profile as unknown as Record<string, unknown>);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Preferences
        </h1>
        <p className="mt-2 text-sm text-rog-muted">
          Yours alone, and saved as you change them. They follow you to any
          device you sign in on.
        </p>

        <PreferencesForm
          initial={prefs}
          initialNickname={
            (profile as unknown as { nickname?: string | null }).nickname ?? ""
          }
          accountName={profile.name}
          initialTranslation={profile.preferred_bible_id ?? DEFAULT_BIBLE_ID}
        />
      </main>
    </>
  );
}
