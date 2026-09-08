# Deep Waters — Excellence Audit

Read-only audit against the three reported pains: **won't scroll**, **general
slowness**, **keyboard opens on pages with no text input**. Findings are
tagged P0 (breaks the reported symptom), P1 (visible drag), P2 (cleanup).

No code changed to write this file. Applied fixes come in Group A → B → C.

---

## Scroll audit

The horizontal-scroll fix from earlier is in place and correct:
[app/globals.css:179](app/globals.css:179) sets `html { overflow-x: clip }`
and `body { overflow-x: hidden; overscroll-behavior-y: none }`. The two other
`overflow: hidden` rules in the stylesheet ([app/globals.css:1406](app/globals.css:1406)
for the condensed reading-header title, [app/globals.css:1620](app/globals.css:1620)
for `.mark-text[data-clamped="true"]`) are both legitimate — ellipsis and
line-clamp only.

Six sheets lock body scroll while open:
[DayPicker](components/DayPicker.tsx:45),
[MoreSheet](components/MoreSheet.tsx:93),
[TranslationSwitcher](components/TranslationSwitcher.tsx:64),
[VerseNoteSheet](components/VerseNoteSheet.tsx:45),
[CompareSheet](components/CompareSheet.tsx:153),
[ReferencePicker](components/ReferencePicker.tsx:90). Each follows the same
correct pattern — capture `prev`, set `overflow: hidden` on open, restore
`prev` in the effect's cleanup, and gated on `open` so a closed sheet never
touches body style.

**No P0 scroll issue found.** If a user reports "the page won't scroll",
the most likely trigger is a sheet that was open when they backgrounded the
tab, where a route change unmounted its parent mid-transition. There is one
narrow race worth closing:

### P2 — Two open sheets can leak a locked body
- **Where.** All six body-lock effects capture `document.body.style.overflow`
  when they mount. If Sheet A opens (captures `""`, sets `"hidden"`), Sheet B
  opens on top (captures `"hidden"`, sets `"hidden"`), and Sheet A closes
  first, A restores `""`, then B on close restores `"hidden"`. The body stays
  locked with no sheet visible.
- **Real risk today.** Low — the app rarely stacks sheets. The one case where
  it can happen is `ReadingHeader` picker → `TranslationSwitcher` from inside
  the picker.
- **Fix later.** Extract a small `useLockBodyScroll(open: boolean)` that
  reference-counts. Out of scope for this pass; noting so it's not forgotten.

---

## Keyboard audit

The reported symptom — "keyboard opens on pages with no text input" — is
**not caused by any `autoFocus` on page load**. Whole-tree search:

- `autoFocus` appears exactly once, on the note textarea inside
  [VerseNoteSheet](components/VerseNoteSheet.tsx:110). That sheet only opens
  when the user taps "Note" on the verse toolbar (`setSheetOpen(true)` at
  [ScriptureReader:850](components/ScriptureReader.tsx:850)), so the keyboard
  arriving there is what the user asked for.
- No `.focus()` on any `<input>` or `<textarea>` in `app/` or `components/`.
  The two `.focus()` calls are on a testament tab button
  ([BookPicker:77](components/BookPicker.tsx:77)) and on a panel div
  ([ReferencePicker:92](components/ReferencePicker.tsx:92)); neither opens
  the mobile keyboard.
- No `contentEditable` elements anywhere.
- Every `<input>` and `<textarea>` is gated behind `open` on a sheet, or
  lives on a page where typing is the point (`/onboarding`, `/me/edit`,
  `/login`, `/signup`, `/reset-password`, `/forgot-password`,
  `/testimonials`, `/bible` search, `/community` post box,
  `/admin/rhapsody`, `/cohorts/*`).

**Most likely real-world cause:** the user taps on a verse while trying to
scroll; the verse toolbar comes up; a second unlucky tap catches "Note"; the
sheet opens and the textarea's `autoFocus` fires the keyboard. On a fast
finger this reads as "the keyboard appeared out of nowhere on a reading
page".

### P1 — Drop the `autoFocus` on the note textarea
- **Where.** [components/VerseNoteSheet.tsx:110](components/VerseNoteSheet.tsx:110).
- **Why.** The sheet already appears at the bottom of the screen with the
  textarea in view; a tap-to-type is one gesture. Removing `autoFocus` costs
  nothing to a user who meant to write a note, and quietly prevents the
  ghost-keyboard case above.

---

## Performance audit

`next build` runs clean. Bundle sizes are healthy — the heavy routes
(`/read` and `/bible/*` at 190 kB, `/community` at 182 kB, `/day/[n]` at
179 kB) all sit inside the Supabase + React baseline, not on top of it.
Nothing to hunt down in userland bundles.

The one hot number is **middleware = 85.8 kB** running on every page
navigation. It has an asset-excluding matcher, but it does not have an
early-return for public routes: every request hits `supabase.auth.getUser()`
before we check whether the path is public.

### P1 — Middleware calls Supabase for public routes
- **Where.** [middleware.ts:32](middleware.ts:32) — `getUser()` runs
  unconditionally, then [middleware.ts:56](middleware.ts:56) computes
  `isPublic`.
- **Why.** `/api/og`, `/api/og/verse`, `/auth/*`, `/c/*`, `/`, `/welcome`,
  `/login`, `/signup`, `/forgot-password`, `/reset-password` don't need a
  refreshed session to be served. Every one of them pays a Supabase round
  trip today. This is the single biggest lever on perceived navigation
  latency across the app.
- **Fix.** Move the `isPublic` computation to the top. For public paths,
  skip `getUser()` and the profile lookup and just `return response`. Keep
  the cookie refresh path for signed-in navigation — that's what it's for.

### P1 — Drop the `autoFocus` on the note textarea (repeat, for completeness)
- Listed above under Keyboard.

### P2 — Splash overlay stays clickable while it fades
- **Where.** `.dw-launch` in [app/globals.css](app/globals.css) — the fixed
  full-screen overlay animates opacity to 0 from 920ms → 1200ms and only
  unmounts on `dw-stage-out` end. During that 280ms it still catches taps.
- **Fix.** Add `pointer-events: none` to `.dw-launch` after the
  `dw-stage-out` animation starts (either an extra keyframe rule or a
  container class swap in JS).

### P2 — `finishers` view has no query limit
- **Where.** [components/FinishersView.tsx:23](components/FinishersView.tsx:23)
  `supabase.from("finishers").select("*")`.
- **Why.** In practice `finishers` is small (users who kept all 90 days).
  Every other list surface (`CommunityFeed`, `PrayerWall`, `LeaderboardView`)
  ships with a safety limit; this one is the odd one out.
- **Fix.** Add `.limit(500)` as a safety cap. Not user-visible today.

### P2 — List rows aren't memoised
- **Where.** `ReflectionCard`, `PrayerWall` rows, `LeaderboardView` rows,
  `CommunityFeed`.
- **Why.** Realtime updates trigger a full re-render of the whole list.
  Rows are cheap today, so this is invisible under 100 items; if the feed
  grows past a few hundred it will bite. Not fixing this pass.

### Already good — noted so they don't get "fixed" again
- `react-easy-crop` is already dynamic-imported in
  [app/me/edit/page.tsx:11](app/me/edit/page.tsx:11) — the profile page
  doesn't ship it in the initial bundle.
- `unpdf` is `await import`ed inside the API route at
  [app/api/admin/rhapsody/extract/route.ts:67](app/api/admin/rhapsody/extract/route.ts:67).
  It runs server-side only; the client bundle never sees it.
- `Avatar` uses `next/image`; there are zero raw `<img>` tags in `app/` or
  `components/`.
- The `share-as-image` path in ScriptureReader is a server route
  (`/api/og/verse`) that returns a PNG — no client-side HTML-to-image
  library to lazy-load.
- CommunityFeed, PrayerWall, LeaderboardView all already `.limit()` their
  main queries.

---

## Realtime audit

All four channel subscriptions use a unique random suffix so a strict-mode
double-mount can't tear down its own live channel:

- [components/Nav.tsx:63](components/Nav.tsx:63) — `nav-notif-${user.id}-…`
- [components/PrayerWall.tsx:120](components/PrayerWall.tsx:120) — `prayer-live-…`
- [components/LeaderboardView.tsx:74](components/LeaderboardView.tsx:74) — `leaderboard-live-…`
- [components/CommunityFeed.tsx:98](components/CommunityFeed.tsx:98) — `feed-live-…`

Nothing to fix.

---

## Fix order (Groups A → B → C)

**A (P0/P1 — keyboard and scroll)**
1. Remove `autoFocus` from the note textarea
   ([VerseNoteSheet.tsx:110](components/VerseNoteSheet.tsx:110)).

**B (P1/P2 — performance)**
2. Middleware early-return for public paths
   ([middleware.ts](middleware.ts)).
3. `.limit(500)` on the finishers query
   ([FinishersView.tsx:23](components/FinishersView.tsx:23)).
4. `pointer-events: none` on `.dw-launch` while `dw-stage-out` runs
   ([app/globals.css](app/globals.css)).

**C (ScriptureReader)**
No bugs the audit surfaced. The 902-line file stays untouched.

**Explicitly not touching this pass**
- Schema / RLS / views / triggers / migrations.
- Design system (Fathom).
- Empty API folders (`app/api/announce/`, `app/api/report/`),
  the duplicate migration, `push_subscriptions`, ROG-era Tailwind aliases.
- Auth flows.
- Two-sheet body-lock race (P2, noted above for a future pass).
- List-row memoisation (P2, invisible under current loads).
