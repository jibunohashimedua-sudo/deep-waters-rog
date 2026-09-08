# Deep Waters — Stress Audit

Read-only survey against normal / unusual / adversarial use. Nothing was
changed to write this file. Fixes are named but never coded. Items already
shipped in the earlier excellence work (autofocus removal, middleware
public-route bypass, `FinishersView` limit, splash pointer-events, keyboard
hints, `lib/bible.ts` in-flight coalescing, safe-area confirmation, sticky
parent-chain confirmation, realtime unique-suffix pattern) are not
re-flagged.

---

## Summary

| Tier | Count | What it means                                                                 |
|------|-------|-------------------------------------------------------------------------------|
| 1    | 15    | Breaks under normal use — reachable this week if the shape lines up          |
| 2    | 12    | Breaks under unusual but plausible use — real users, real edge cases          |
| 3    | 10    | Breaks under adversarial or rare use — small user counts, big consequences    |
| ✓    | 18    | Confirmed clean (fully or in the last pass)                                   |

**Top three most impactful — fix first**

1. **T1‑A · Every user-input write path is length-uncapped.** Reflection,
   prayer, comment, announcement, cohort name, cohort description, cohort
   welcome, verse note, bio, testimony. Postgres `text` columns will accept
   a megabyte; the UI has no defence. First time a user pastes a long
   passage into a prayer post, the row lands, the client caches it, and the
   feed layout breaks for everyone rendering that card. See T1‑A.1 … A.9.

2. **T1‑B · `amen`, `postComment`, `deleteComment` (ReflectionCard) and
   `pray` / `markAnswered` / `del` (PrayerWall) fire fetches with no error
   check.** A 500 or a `res.json()` on a redirect HTML body throws
   uncaught; the UI shows the optimistic state; the DB never wrote. Counts
   drift from truth until the next hard reload. See T1‑B.

3. **T2‑A · `currentDayNumber` is off by one in west-of-UTC timezones and
   drifts by ±1 across DST boundaries.** A user in New York who sets
   `start_date` "Sep 1" opens the app on Sep 1 and is greeted with Day 2.
   The whole 90-day plan is one day ahead of them for as long as they live
   in that timezone. See T2‑A.

---

## Tier 1 — breaks under normal use

### T1‑A · Input-length validation is missing across every write path

Postgres accepts these writes; nobody upstream refuses them. Every one is
a landmine waiting on one long paste.

**A.1 — Reflection body** ([app/api/complete/route.ts:57-70](app/api/complete/route.ts:57))
* Failure: `reflection` upserted with no length cap. A 10 000-character
  paste writes cleanly.
* Symptom: the CommunityFeed row that renders it becomes a wall of text
  taller than the viewport; long unbroken tokens overflow the card
  horizontally (word-break not set on `.mark-note`).
* Smallest fix: server-side length cap (e.g. 5 000 chars) before upsert.

**A.2 — `verse_reference` and `verse_text`** ([app/api/complete/route.ts:57-70](app/api/complete/route.ts:57))
* Failure: neither is `.trim()`ed or length-checked. Whitespace-only or
  20 kB pasted "verse text" saves.
* Symptom: card renders raw whitespace or a giant quoted block.
* Smallest fix: trim and cap both at the API boundary.

**A.3 — Prayer request body** ([app/api/prayer/route.ts:11-14](app/api/prayer/route.ts:11))
* Failure: only `!body?.trim()` guards; no max length.
* Symptom: PrayerWall card overflows; realtime replay pushes the bloated
  row to every subscriber.
* Smallest fix: length cap at the API.

**A.4 — Prayer answered-note** ([app/api/prayer/route.ts:56-64](app/api/prayer/route.ts:56))
* Failure: `note` passed through with no trim or cap.
* Symptom: same overflow, different row.
* Smallest fix: length cap on `note`.

**A.5 — Comment body** ([app/api/comment/route.ts:11-19](app/api/comment/route.ts:11))
* Failure: `!body?.trim()` only.
* Symptom: comment thread stretches indefinitely; long unbroken tokens
  break horizontal layout of the recessed comment plate.
* Smallest fix: length cap at the API.

**A.6 — Announcement title/body** ([components/AnnouncementForm.tsx:22-27](components/AnnouncementForm.tsx:22))
* Failure: direct client insert with only `.trim()`. No `maxLength` prop
  on the inputs either.
* Symptom: `/announcements` list and cohort landing page overflow.
* Smallest fix: `maxLength` on the fields + server-side cap.

**A.7 — Cohort name / description / welcome / start_date** ([components/CohortSettingsForm.tsx:35-43](components/CohortSettingsForm.tsx:35))
and ([app/cohorts/new/page.tsx:83-102](app/cohorts/new/page.tsx:83))
* Failure: unbounded text on all four fields.
* Symptom: the four dashboard tiles on `/cohorts/[slug]/manage` (line
  70-89) blow apart when name is >30 chars; nav's cohort link truncates
  awkwardly; the CohortShareBox URL echoes the slug (which is derived
  elsewhere) so long names alone don't break the URL.
* Smallest fix: cap name at 60, description at 240, welcome at 500.

**A.8 — Verse note body** ([components/VerseNoteSheet.tsx](components/VerseNoteSheet.tsx))
and its insert path in ScriptureReader
([components/ScriptureReader.tsx:651-669](components/ScriptureReader.tsx:651))
* Failure: unbounded. `NotesView` renders each row's body untruncated.
* Symptom: a giant note pushes every other note off-screen.
* Smallest fix: cap at ~2 000 chars.

**A.9 — Profile bio and name** ([app/me/edit/page.tsx:229-241](app/me/edit/page.tsx:229))
* Failure: bio has `maxLength={160}` client-side but NO server cap. Name
  input has no `maxLength` at all.
* Symptom: bio bypasses via API/curl; a 500-char name breaks the Depth
  header (line 353-355 `text-[26px]` `break-words`), the Nav avatar row,
  the leaderboard, and every ReflectionCard header.
* Smallest fix: cap name at 60 server-side; cap bio at 160 server-side.

**A.10 — Testimony body** ([app/testimonials/page.tsx:46-54](app/testimonials/page.tsx:46))
* Failure: `maxLength={1500}` client-side; direct client insert has no
  server cap.
* Symptom: bypass via curl writes an unbounded row into `testimonials`.
* Smallest fix: server cap.

### T1‑B · Client fetches without error handling

**B.1 — Amen** ([components/ReflectionCard.tsx:76-85](components/ReflectionCard.tsx:76))
* Failure: `await res.json()` on the response with no `res.ok` check. A
  401 (middleware sees expired session) redirects to HTML and `.json()`
  throws; a duplicate-key 500 (rapid double-tap) returns `{error: ...}`
  which is treated as `{reacted: undefined}`.
* Symptom: amen count sets to NaN, or increments locally without a server
  row. Persists visually until reload.
* Smallest fix: check `res.ok` before parsing; revert local state on any
  non-2xx.

**B.2 — postComment** ([components/ReflectionCard.tsx:87-98](components/ReflectionCard.tsx:87))
* Failure: no `res.ok` check. Even on a 500 the count still `c + 1` and
  the draft still clears.
* Symptom: user sees "Post" succeed, the comment isn't in the thread,
  the count shows one extra. Doesn't recover until page reload.
* Smallest fix: check `res.ok`, keep draft on failure, don't bump count.

**B.3 — deleteComment** ([components/ReflectionCard.tsx:100-107](components/ReflectionCard.tsx:100))
* Failure: no `res.ok` check.
* Symptom: comment vanishes from UI even when RLS blocks the delete;
  next reload it comes back.
* Smallest fix: check `res.ok`; restore on failure.

**B.4 — Prayer pray/answered/delete** ([components/PrayerWall.tsx:178-210](components/PrayerWall.tsx:178))
* Failure: `pray()`, `markAnswered()`, `del()` all fire fetches without
  reading the response.
* Symptom: silent failure. Optimistic delete in particular leaves the UI
  out of sync until the `load()` catches up.
* Smallest fix: read `res.ok`, show `friendlyError` on failure.

**B.5 — ResetMyData** ([components/ResetMyData.tsx:11-22](components/ResetMyData.tsx:11))
* Failure: fetch has no error check. Any failure shows the "cleared"
  screen anyway.
* Symptom: a partial or failed reset reads as complete success. User
  refreshes and sees their data still there.
* Smallest fix: check `res.ok` and the returned `{ok, results}` object;
  show a failure state that names which tables didn't clear.

### T1‑C · No timeouts on Supabase or API.Bible

**C.1 — API.Bible fetch has no `AbortController`** ([lib/bible.ts:198-203](lib/bible.ts:198))
* Failure: `fetch()` with no timeout. If the upstream stalls, the caller
  waits forever.
* Symptom: `/read` renders spinner-less blank scripture area; the whole
  server render hangs on the slowest chapter of the 13. Serverless
  functions have their own 10s hard cap but the reader sees a hang.
* Smallest fix: `AbortController` with a 6s cap around each fetch; the
  outer code already turns unavailable into an empty-state.

**C.2 — Middleware `supabase.auth.getUser()` has no timeout**
([middleware.ts:47-49](middleware.ts:47))
* Failure: no timeout on the auth roundtrip. A slow Supabase drags every
  in-flight page.
* Symptom: navigation feels dead — Vercel's function timeout kills the
  request after 10-15s and shows a generic error, but by then the user
  has clicked three more things.
* Smallest fix: `Promise.race` against a 3-4s timeout that falls back to
  a redirect to `/login`.

**C.3 — Every client Supabase read** (PrayerWall, CommunityFeed,
LeaderboardView, NotificationsPage, DepthTabs children, HighlightsView,
NotesView) fires without a timeout.
* Failure: hung Supabase leaves loading skeletons on screen forever.
* Symptom: no visible error state; user assumes the app is broken.
* Smallest fix: wrap the client reads with a `Promise.race`-based
  timeout and route to `friendlyError("network")` on rejection.

### T1‑D · Middleware profile check returns HTML redirect to API calls

Location: [middleware.ts:76-86](middleware.ts:76)
* Failure: a signed-in user with no `profiles` row hitting any protected
  `/api/*` route gets a 307 to `/onboarding`. The XHR then reads HTML
  and JSON.parse throws.
* Symptom: any client action (comment, amen, prayer) posts, the client
  crashes on JSON parse, user sees nothing.
* Reachable when: onboarding was aborted mid-flow, or an admin deleted
  the row via `/admin/users` while a tab was open.
* Smallest fix: for `/api/*` paths with no profile, return a JSON 401 with
  `{error:"profile-missing"}` instead of a redirect.

### T1‑E · ChapterTicker three-tap race

Location: [components/ChapterTicker.tsx:53-83](components/ChapterTicker.tsx:53) and
[app/api/chapter-read/route.ts:59-79](app/api/chapter-read/route.ts:59)
* Failure: the server reads `existingTick` and then inserts/deletes;
  those two ops aren't in a transaction. Two concurrent identical POSTs
  from a fast triple-tap both see `existingTick=null`, both insert, one
  wins the unique constraint, the loser returns 500. Client shows the
  raw `.error` in `<p class="text-danger">`.
* Symptom: red error line on a legitimate ticked chapter; tick appears
  to have failed even though it landed.
* Smallest fix: catch unique-violation server-side and treat as
  "already ticked" success.

### T1‑F · Reflection card no-word-break on long unbroken text

Location: [components/ReflectionCard.tsx:154-159](components/ReflectionCard.tsx:154)
* Failure: `MentionText` renders inside `<p class="selectable mt-3 …">`
  with no `overflow-wrap` set. A 500-char URL or emoji-only run breaks
  card width on mobile.
* Symptom: horizontal card scroll; the row above (verse quote) doesn't
  scroll but a long reflection pushes the amen button off-screen.
* Smallest fix: `overflow-wrap: anywhere;` on `.mark-note` and the
  reflection paragraph.

---

## Tier 2 — breaks under unusual but plausible use

### T2‑A · `currentDayNumber` timezone drift

Location: [lib/plan.ts:229-236](lib/plan.ts:229)
* Failure: `new Date("YYYY-MM-DD")` parses `start_date` as UTC midnight.
  `.setHours(0,0,0,0)` then shifts to *local* midnight; in a west-of-UTC
  zone that lands on the previous local day. Same shift on today. The
  resulting diff can be one day too high.
* Concrete break: user in EDT sets start "2026-09-01". Opens the app on
  Sep 1 at 09:00 EDT. `new Date("2026-09-01")` = Aug 31 20:00 EDT →
  `.setHours(0,0,0,0)` = Aug 31 00:00 EDT. `today.setHours(0,0,0,0)` =
  Sep 1 00:00 EDT. diff = 1 day. `Math.floor(1) + 1 = 2`. **App shows
  Day 2 on day 1.** Every day is one ahead for that user forever.
* Symptom: user thinks the app is broken from the first hour.
* Smallest fix: parse `start_date` part-by-part like `lib/rhapsody.ts`
  does — no `new Date(iso)`. Compute both dates as UTC-noon and subtract.

### T2‑B · DST changeover

Same location, same function.
* Failure: `Math.floor(diff / 86400000)` doesn't know that the day of
  the change had 23 or 25 hours.
* Concrete break: UK user starts plan mid-October. On the "fall back"
  Sunday, diff is 1 hour short of a whole day, floor drops one. Day
  count shows one lower for the day.
* Smallest fix: same as A — compare calendar dates, not epoch ms.

### T2‑C · `todayISO()` runs in server timezone (UTC)

Location: [lib/rhapsody.ts:22-26](lib/rhapsody.ts:22) called from
[app/rhapsody/page.tsx:22-23](app/rhapsody/page.tsx:22)
* Failure: `new Date()` on the Vercel edge is UTC. A user in Asia at
  07:00 local (23:00 UTC previous day) reads yesterday's article. A user
  in the US at 19:00 local (00:00 UTC next day) reads tomorrow's.
* Symptom: article is "wrong" once a day for one whole timezone tier.
* Smallest fix: read the client's own timezone from a small script and
  compute the local ISO server-side, or read the `Date` header the CDN
  sets on the incoming request.

### T2‑D · `/depth` initial render is heavy on a power user

Location: [app/depth/page.tsx:64-92](app/depth/page.tsx:64)
* Failure: all completions (up to 90), all highlights (unbounded),
  all verse_notes (unbounded), all chapter_reads (up to ~1170), plus
  full verse texts for every highlight, are pulled and rendered on the
  server. Client hydrates the full tree.
* Concrete break: a user with 500 highlights + 200 notes + 90
  completions ships ~1-3 MB HTML; hydration blocks the main thread for
  hundreds of ms on a mid-range Android.
* Symptom: `/depth` feels slow to load and jankier to scroll than any
  other page.
* Smallest fix: server-side pagination on highlights and verse_notes,
  or lazy-load them into the DepthTabs' "Highlights" and "Notes" tabs
  on click.

### T2‑E · Announcement title in list layout

Location: [app/announcements/page.tsx](app/announcements/page.tsx) (renders each row) and
insertion at [components/AnnouncementForm.tsx:22-27](components/AnnouncementForm.tsx:22)
* Failure: no cap on title. A 500-char title breaks the list row.
* Symptom: single announcement pushes every other row off-screen.
* Smallest fix: cap at 120 chars server-side + `line-clamp-2`.

### T2‑F · Cohort share link opened by an existing member

Location: [app/api/cohort/join/route.ts:27-40](app/api/cohort/join/route.ts:27)
* Failure: `upsert` on `(cohort_id, user_id)` is a no-op re-add, but the
  next block **also updates `profiles.cohort_id` and, if `align_start=1`
  is checked, overwrites `profiles.start_date`**. An existing member who
  taps the join link (which they might, out of habit) and leaves the
  default box ticked loses their real start date.
* Symptom: their whole plan snaps back to Day 1 without warning; their
  reflections and completions stay, but the leaderboard says they've
  fallen behind.
* Smallest fix: check membership first; skip the profile update entirely
  for existing members.

### T2‑G · Cohort deleted while a leader is on `/cohorts/[slug]/manage`

Location: [app/cohorts/[slug]/manage/page.tsx](app/cohorts/[slug]/manage/page.tsx) +
[components/CohortSettingsForm.tsx:35-43](components/CohortSettingsForm.tsx:35)
* Failure: settings form UPDATE with `.eq("id", cohortId)` returns 0
  rows on a deleted cohort. Supabase returns no error for zero-row
  updates; the client shows "Saved".
* Symptom: leader confidently saves changes that go nowhere.
* Smallest fix: `select("id")` back after the update and check length.

### T2‑H · Rhapsody with entry + no PDF and no article body

Location: [app/rhapsody/page.tsx:130-144](app/rhapsody/page.tsx:130)
* Failure: the "hasn't been typed up yet" empty state renders only when
  `pdfUrl` exists. If both PDF and body are missing (entry row present
  but broken edition record), the page shows title + date + nothing.
* Symptom: reader sees a dead page and has no idea whether to wait or
  reload.
* Smallest fix: a second empty state for the pdf-null case.

### T2‑I · API.Bible cache poisoning window

Location: [lib/bible.ts:198-224](lib/bible.ts:198)
* Failure: guard is `if (!text.content) return {ok:false, kind:"missing"}`.
  If API.Bible returns a `data.content` field that is a maintenance
  page HTML rather than scripture, it's cached with the 90-day TTL and
  served to every reader for three months.
* Symptom: entire chapters read as "We're back soon" until the row is
  manually deleted from `bible_cache`.
* Smallest fix: a shape check on the returned HTML (verse-number markup
  present) before caching.

### T2‑J · Onboarding aborted after profile upsert, before cohort join

Location: [app/onboarding/page.tsx:100-118](app/onboarding/page.tsx:100)
* Failure: profile write succeeds; user closes the tab before the
  `cohort_members` upsert fires. Next login has a profile → middleware
  admits them → cohort membership missing.
* Symptom: user shows up in the "Everyone" feed but not in their cohort
  filter. Confusing and rare, but real.
* Smallest fix: do the cohort_members upsert *inside* the same await
  chain and treat its failure as fatal to the whole submit; or, better,
  fold both into a single RPC.

### T2‑K · Multi-device stale session

* Failure: middleware refreshes the refresh token on device A. Device B's
  cached cookie is now dead. B's next request 401s and redirects to
  `/login`.
* Symptom: opening the PWA on device B after any activity on device A
  logs you out without warning.
* Smallest fix: the app already accepts this trade-off (Supabase best
  practice). Worth surfacing a small "signed you out on another device"
  toast on login. Non-blocking.

### T2‑L · Very old accounts loop on Day 90

Location: [lib/plan.ts:236](lib/plan.ts:236) clamps to `Math.min(90, ...)`
* Failure: a user whose start_date is >90 days ago sees Day 90 forever.
  `/day/90` renders normally. Depth grid shows all 90 cells based on
  their actual completions, but the "days to go" line reads `0`.
* Symptom: no "you finished" state; the app just keeps offering the last
  day of the plan.
* Smallest fix: a Day 91+ state that says "You've reached the end. Start
  again? See your reflections." Route it from `/today`.

---

## Tier 3 — breaks under adversarial or rare use

### T3‑A · Prayer wall RLS is world-read

Location: `supabase/schema.sql` `prayer_requests` policy (per APP_MAP §5),
consumed by [components/PrayerWall.tsx:52-72](components/PrayerWall.tsx:52)
* Failure: policy is "read all", not "read own cohort". Any signed-in
  user sees every prayer request from every cohort — including cohorts
  they left, or never joined.
* Symptom: sensitive prayer text is visible cross-cohort.
* Smallest fix: RLS SELECT policy that checks cohort membership OR
  `cohort_id IS NULL`. Schema change; note per your instruction not to
  do that here.

### T3‑B · Mention regex rejects non-ASCII names

Location: [lib/mentions.ts:6-9](lib/mentions.ts:6) + [lib/mentions.ts:39-51](lib/mentions.ts:39)
* Failure: `/@([A-Za-z][A-Za-z'-]*(?:\s[A-Z][A-Za-z'-]*)?)/g`. Any name
  containing `é`, `ö`, `ñ`, `ị`, `ả`, `Ω`, apostrophes-other-than-'`,
  or two-plus-space names is never mentionable.
* Symptom: Björk, Ọlá, Ìyá, Mary‑Anne, Jean-Luc Picard, Ann Marie Smith
  can never receive a mention notification.
* Smallest fix: `[\p{L}]` with the `u` flag; multi-word extension.

### T3‑C · Mention resolver notifies every prefix match

Location: [lib/mentions.ts:26-30](lib/mentions.ts:26)
* Failure: `full.startsWith(lower)` — `@Sarah` matches every user whose
  full name starts "Sarah…".
* Symptom: several people notified for one mention. Not a bug so much as
  a design gap.
* Smallest fix: only match exact full-name or exact first-name; drop the
  `startsWith` case.

### T3‑D · Signed URL for Rhapsody PDF expires mid-session

Location: [app/rhapsody/page.tsx:41-56](app/rhapsody/page.tsx:41)
* Failure: TTL is 30 min. A user who lands on `/rhapsody`, reads the
  article, then taps "Open the original booklet" 45 min later gets a
  403 in a new tab.
* Symptom: browser-native "access denied" page in a fresh tab.
* Smallest fix: mint the signed URL *at click time* via a small
  `/api/rhapsody/pdf` route rather than at server-render.

### T3‑E · Notification link points at deleted resources

Location: notifications rows created by triggers in `supabase/schema.sql`
(mentioned in APP_MAP §5 "Triggers"); consumed at
[app/notifications/page.tsx:39-50](app/notifications/page.tsx:39)
* Failure: `notifications.link` is stored at insert time. Deletions of
  comments, prayers, completions don't clean up the notifications that
  point to them.
* Symptom: tap a notification, land on a 404 or an empty feed with no
  explanation.
* Smallest fix: cascade delete on the source resource, or verify at
  render time and downgrade the notification body if the link is dead.

### T3‑F · Reports on deleted target

Location: [app/admin/reports/page.tsx](app/admin/reports/page.tsx) (server-side
cross-lookup per APP_MAP §4 "Admin panel")
* Failure: same pattern — a report references a `target_id` that may not
  exist. Not verified in this pass; presumed to render an empty target
  block.
* Symptom: an admin sees a report they can't investigate; unclear
  whether the offending row was already deleted or the report is broken.
* Smallest fix: name the state explicitly in the queue row ("target
  already deleted") and offer a resolve action.

### T3‑G · Admin `/admin/users` delete a user already gone

Location: [app/api/admin/delete-user/route.ts:20-27](app/api/admin/delete-user/route.ts:20)
* Failure: `admin.auth.admin.deleteUser(user_id)` returns
  `{error: {message: "User not found"}}` when the auth user is already
  gone. The route returns 500 with that message. `<UserAdminControls>`
  shows the raw string.
* Symptom: admin sees "User not found" and doesn't know what to do; the
  row still displays because the refresh hasn't run.
* Smallest fix: treat "not found" as success (idempotent delete) and
  refresh the list.

### T3‑H · Concurrent reflection writes from two devices

Location: [app/api/complete/route.ts:57-70](app/api/complete/route.ts:57)
* Failure: `upsert` with `onConflict: "user_id,day_number"`. Last write
  wins, silently. Neither device knows the other overwrote its version.
* Symptom: user writes on their phone, then a partial draft they left on
  their laptop autosaves later and wipes the phone's version.
* Smallest fix: version column + optimistic-concurrency check; or
  simply return the row's timestamps so the client can warn on staleness.

### T3‑I · Direct URL access to `/reset-password` without a session

Location: [app/reset-password/page.tsx:31-73](app/reset-password/page.tsx:31)
* **Confirmed handled correctly.** Page walks three link shapes then
  falls to `status="expired"`. Copy in the JSX is friendly. Nothing to
  do.

### T3‑J · Direct URL access to `/day/[n]`, `/cohorts/[slug]/manage`, admin routes

* **Confirmed handled correctly.** Middleware + `requireProfile()` +
  `requireAdmin()` + explicit `isCohortLeader()` checks and `notFound()`
  each block their respective paths. Documented in APP_MAP §6.

---

## Confirmed clean

Both from earlier passes and from this survey.

* **Ghost keyboard** — `autoFocus` removed from `VerseNoteSheet`.
* **Middleware pays Supabase only when needed** — early-return for public
  routes.
* **`FinishersView` unbounded query** — `.limit(500)` added.
* **Splash overlay swallows taps** — `pointer-events: none` set.
* **Keyboard hints on every input** — swept, `type` + `inputMode` +
  `enterKeyHint` + `autoComplete` all correct.
* **`bible_cache` race** — in-flight `Map<key, Promise>` shares
  concurrent misses.
* **Safe-area padding** — `body` + `--bottom-nav-clearance` cover every
  main.
* **Sticky `ReadingHeader` parent chain** — no ancestor breaks it.
* **Realtime channel names** — all four use `Math.random()` suffix.
* **XSS via reflection / comment / prayer text** — `MentionText` renders
  through React text nodes; no `dangerouslySetInnerHTML`.
* **`/depth` verse-text lookup** — batched `.or()` on `bible_cache`; no
  N+1 pattern.
* **`HighlightsView` pagination** — client-side `PAGE=40` after initial
  filter; not O(n²).
* **`/api/complete` and `/api/chapter-read`** — validate day range,
  future-day rejection, ownership.
* **`/api/reset-my-data`** — scoped to `.eq("user_id", uid)`; touches
  own rows only.
* **`/api/admin/delete-user`** — requires role check; disallows
  self-delete.
* **`resetPassword` link handling** — three flows fall through to a
  clean expired state.
* **`CohortManagePage` empty-`.in()`** — sentinel UUID prevents the
  PostgREST error on a member-less cohort.
* **`Notifications` markAllRead / markRead** — properly scoped and
  optimistic-with-server-refresh.

---

*Read-only survey. No files modified.*
