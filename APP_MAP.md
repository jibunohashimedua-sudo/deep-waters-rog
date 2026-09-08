# APP_MAP.md — Deep Waters

Read-only discovery pass over the whole repo. File paths, table names and route names are all real. Written 2026-09-08.

---

## 1. Stack and setup

### Framework and languages
- **Next.js 14.2.15** (App Router).
- **React 18.3.1** + **React DOM 18.3.1**.
- **TypeScript 5.6.3** (strict — inferred from `tsconfig.json`, verify).

### Runtime dependencies (from `package.json`)
| Package | Version | Used for |
|---|---|---|
| `@supabase/ssr` | ^0.5.2 | Cookie-aware Supabase client for RSC + middleware — `lib/supabase/server.ts` and `middleware.ts`. |
| `@supabase/supabase-js` | ^2.45.4 | Browser-side Supabase client for realtime and client-page queries — `lib/supabase/client.ts`. |
| `@vercel/og` | ^0.6.3 | Edge-rendered branded share cards — `app/api/og/route.tsx` (completion) and `app/api/og/verse/route.tsx` (single verse). |
| `next` | 14.2.15 | Framework. |
| `react` / `react-dom` | ^18.3.1 | UI runtime. |
| `react-easy-crop` | ^5.4.1 | Avatar photo crop UI on `/onboarding` and `/me/edit` — `components/PhotoCropper.tsx`. |
| `unpdf` | ^1.8.1 | Extracts text from the Rhapsody PDF on the server — `lib/rhapsodyPdf.ts`, called from `app/api/admin/rhapsody/extract/route.ts`. |

### Dev dependencies
`@types/node`, `@types/react`, `@types/react-dom`, `autoprefixer`, `eslint ^8.57.1`, `eslint-config-next`, `postcss`, `tailwindcss ^3.4.13`, `typescript`.

### Environment variables (referenced in code)
| Name | Referenced in |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`, `lib/bible.ts`, `app/api/admin/delete-user/route.ts`, `app/api/admin/rhapsody/extract/route.ts`, `app/rhapsody/page.tsx` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/bible.ts` (writes to `bible_cache`), `app/api/admin/delete-user/route.ts`, `app/api/admin/rhapsody/extract/route.ts`, `app/rhapsody/page.tsx` (signed URLs) |
| `API_BIBLE_KEY` | `lib/bible.ts` |

There is no `NEXT_PUBLIC_SITE_URL` — the memory notes it was deleted 2026-09-07 because nothing reads it; auth redirects use `window.location.origin` or the request's `origin`.

### Scripts (`package.json`)
- `dev` → `next dev`
- `build` → `next build`
- `start` → `next start`
- `lint` → `next lint`

### Hosting
- **Vercel**, team `hesed`, project `deep-waters-rog`. Canonical origin **https://deepwaters.online**; `deep-waters-rog.vercel.app` 308-redirects there.
- **No `vercel.json`** in the repo.
- **Edge runtime** on two routes only, declared inline via `export const runtime = "edge"`:
  - `app/api/og/route.tsx`
  - `app/api/og/verse/route.tsx`
- All other routes run on the Node runtime by default.
- `next.config.js` allows remote images from `*.supabase.co` and `lh3.googleusercontent.com`.
- `middleware.ts` runs on every request (default matcher) — refreshes the Supabase session cookie via `supabase.auth.getUser()` and redirects unauthenticated users trying to reach protected paths (see §6 Auth).

---

## 2. Routes and pages

### Layouts
- **`app/layout.tsx`** — root layout. Loads three self-hosted Google fonts via `next/font/google`: **IBM Plex Sans** (`--font-sans`), **IBM Plex Mono** (`--font-mono`), **Literata** (`--font-serif`). Sets metadata + PWA manifest link + apple-web-app config + viewport. Renders `<SplashScreen>` around `children`. No per-route layout files exist.

### Public / auth routes
| Route | File | Component | Auth | Renders | Data touched |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | server | signed-in redirect to `/today`; otherwise public | Landing hero, verse callout, "How it works" 4-step, footer | none |
| `/login` | `app/login/page.tsx` | client | public | Email + password sign-in with magic-link fallback and "set a password" card | `supabase.auth.signInWithPassword`, `signInWithOtp` |
| `/signup` | `app/signup/page.tsx` | client | public | Email + password sign-up; optional `?cohort=` slug | `supabase.auth.signUp` |
| `/forgot-password` | `app/forgot-password/page.tsx` | client | public | Requests a password-reset magic link | `supabase.auth.resetPasswordForEmail` |
| `/reset-password` | `app/reset-password/page.tsx` | client | link-carried session | Sets a new password on the recovering session | `supabase.auth.updateUser` |
| `/auth/callback` | `app/auth/callback/route.ts` | route handler | none | Exchanges OTP `?code` for session, redirects to a validated `?next` (only local paths) | `supabase.auth.exchangeCodeForSession` |
| `/welcome` | `app/welcome/page.tsx` | client | signed-in-only via `<Nav>`; itself public | 5-step onboarding tour (see §3) | none |
| `/onboarding` | `app/onboarding/page.tsx` | client | signed-in | Sets name + optional photo + start date; picks up `?cohort=` if signed up from a share | `profiles` insert, `avatars` bucket, `cohort_members` insert |

### Signed-in app routes
| Route | File | Component | Renders | Data touched |
|---|---|---|---|---|
| `/today` | `app/today/page.tsx` | server | Redirects to `/day/{currentDay}` | `profiles.start_date` |
| `/day/[n]` | `app/day/[n]/page.tsx` | server (nested clients) | Day view: `DayHeader` (prev/next/picker/back-to-today), greeting or reading-ahead line, ninety-day gauge, three reading tiles (OT/NT/Rhapsody), `ChapterTicker`, `ReflectionForm` + share-card reveal | `profiles`, `completions`, `chapter_reads`, `rhapsody_days`, `/api/og` |
| `/read` | `app/read/page.tsx` | server (client `ScriptureReader`) | Chapters for the day (from URL `?t=ot\|nt` and optional `?d=`), pre-wrapped verses, custom selection toolbar, note sheet, compare sheet, study note if present | `profiles`, `study_notes`, `chapter_reads`, `highlights`, `verse_notes`, API.Bible via `lib/bible.ts`, `bible_cache` |
| `/bible` | `app/bible/page.tsx` | server + `<BookPicker>` client | Book grid (OT/NT tabs), search, "type a reference" jump | none server; client search is in-memory |
| `/bible/[book]` | `app/bible/[book]/page.tsx` | server + `<ChapterGrid>` client | Chapter grid for the book; a cell is marked "read" if its day is in a full `completions` row | `completions.day_number` |
| `/bible/[book]/[chapter]` | `app/bible/[book]/[chapter]/page.tsx` | server → `<ChapterView>` | One chapter with the reading header, verse selection, next/prev between chapters (rolls across books) | `profiles`, chapter via `lib/bible.ts`, `highlights`, `verse_notes` |
| `/bible/[book]/[chapter]/[verse]` | `app/bible/[book]/[chapter]/[verse]/page.tsx` | server → `<ChapterView focus={…}>` | Same as above, then scrolls + briefly highlights the named verse | same |
| `/rhapsody` | `app/rhapsody/page.tsx` | server | Today's Rhapsody article — pulled from `rhapsody_days`. Optional link to the signed PDF | `rhapsody_days`, `rhapsody_editions`, `rhapsody` storage bucket |
| `/community` | `app/community/page.tsx` | client | People page — 5-view segmented control: **Feed** (default) / **Prayer** / **Leaderboard** / **Finishers** / **Cohorts**. `?view=` chooses | Delegates to `CommunityFeed`, `PrayerWall`, `LeaderboardView`, `FinishersView`, `CohortsView` |
| `/prayer` | `app/prayer/page.tsx` | server | Redirects to `/community?view=prayer` | — |
| `/leaderboard` | `app/leaderboard/page.tsx` | server | Redirects to `/community?view=leaderboard` | — |
| `/finishers` | `app/finishers/page.tsx` | server | Redirects to `/community?view=finishers` | — |
| `/cohorts` | `app/cohorts/page.tsx` | server | Redirects to `/community?view=cohorts` | — |
| `/cohorts/new` | `app/cohorts/new/page.tsx` | client | New-cohort form | `cohorts` insert |
| `/cohorts/[slug]/manage` | `app/cohorts/[slug]/manage/page.tsx` | server | Cohort admin: dashboard tiles, settings, announcements, member list, remove-member | `cohort_summary`, `cohort_members`, `leaderboard`, `announcements` |
| `/c/[slug]` | `app/c/[slug]/page.tsx` | server | Public cohort landing — join card, welcome message, announcements, member photos | `cohort_summary`, `cohort_members`, `announcements` |
| `/testimonials` | `app/testimonials/page.tsx` | client | Submit-a-testimony form | `testimonials` insert |
| `/announcements` | `app/announcements/page.tsx` | server | Announcement feed for the current user's cohort(s) + global | `announcements`, `cohorts` |
| `/depth` | `app/depth/page.tsx` | server (client `DepthTabs`) | Profile umbrella. Header: avatar + name + Plex Mono line. `DepthTabs`: Progress (grid + badges + cohorts + history) / Highlights / Notes | `profiles`, `completions`, `badges`, `leaderboard`, `cohort_members`, `highlights`, `verse_notes`, `chapter_reads` |
| `/me` | `app/me/page.tsx` | server | Redirects to `/depth` | — |
| `/me/edit` | `app/me/edit/page.tsx` | client | Edit name, photo, bio, start date, reminders, translation | `profiles` update, `avatars` bucket |
| `/notifications` | `app/notifications/page.tsx` | server + client | Notifications inbox — mark-read on view | `notifications`, `mentions` |
| **Admin — all gated by `requireAdmin()`** | | | | |
| `/admin` | `app/admin/page.tsx` | server | Stat tiles + entry links to sub-tools | `profiles`, `completions`, `reports`, `testimonials`, `finishers`, `study_notes` |
| `/admin/users` | `app/admin/users/page.tsx` | server | Search + list; `<UserAdminControls>` per row for approve / promote / delete | `profiles`, `/api/admin/delete-user` |
| `/admin/reports` | `app/admin/reports/page.tsx` | server | Report queue — cross-lookup of target rows in `completions` / `comments` / `prayer_requests` / `testimonials` | `reports`, `profiles` |
| `/admin/testimonials` | `app/admin/testimonials/page.tsx` | server | Approve / feature testimonies | `testimonials`, `profiles` |
| `/admin/notes` | `app/admin/notes/page.tsx` | server | Ninety-day grid — one link per study note | `study_notes` |
| `/admin/notes/[day]` | `app/admin/notes/[day]/page.tsx` | server → `<NoteEditor>` | Editor for one day's study note | `study_notes` upsert |
| `/admin/rhapsody` | `app/admin/rhapsody/page.tsx` | server → `<RhapsodyAdmin>` | Upload monthly PDF, map article per date, extract text | `rhapsody_editions`, `rhapsody_days`, `rhapsody` bucket, `/api/admin/rhapsody/extract` |

### API routes (`app/api/*`)
All accept only the method noted; anything else returns 405 (Next.js default). Auth check listed per route.
| Endpoint | Method | Purpose | Inputs | Output | Auth |
|---|---|---|---|---|---|
| `/api/complete` | POST | Save a day's reflection and set `completions.is_full` from reflection presence OR full chapter ticks. Rejects future days. | `{day_number, verse_reference, verse_text, reflection}` JSON | `{ok, id}` or `{error}` | `getUser` + `profiles.start_date` |
| `/api/chapter-read` | POST | Toggle one chapter tick, then upsert/update/delete the `completions` row to reflect is_full. Rejects future days. | `{day_number, book, chapter}` | `{ticked, ticks, total, isFull}` | `getUser` + `profiles.start_date` |
| `/api/comment` | POST | Post a comment on a completion; records `@name` mentions | `{completion_id, body}` | `{ok, id}` | `getUser` |
| `/api/react` | POST | Upsert an "Amen" reaction | `{completion_id}` | `{ok}` | `getUser` |
| `/api/prayer` | POST/PATCH/DELETE | Create / mark-answered / delete a prayer request | body varies | `{ok, id}` | `getUser` |
| `/api/cohort/join` | POST | Join a cohort by id, optionally align start_date | form-encoded `{cohort_id, align_start}` | 303 redirect | `getUser` |
| `/api/reset-my-data` | POST | Nuke this user's completions / prayers / reactions / comments / notes / highlights | none | `{ok}` | `getUser` |
| `/api/bible/verse-count` | GET | How many verses in `{book, chapter}` (real count in the reader's translation) | `?book=&chapter=` | `{count}` | `getUser` |
| `/api/bible/verse-text` | GET | One verse range as plain text for the Compare sheet | `?book=&chapter=&start=&end=&bible=` | `{ok, text}` or `{ok:false, message}` | `getUser` |
| `/api/og` | GET | 1080×1350 completion share card | `?day=&name=&verse=&text=&photo=` | PNG | **none** (public) |
| `/api/og/verse` | GET | 1080×1350 branded verse card | `?ref=&text=` | PNG | **none** (public) |
| `/api/admin/delete-user` | POST | Service-role-key deletes an auth user + profile | `{user_id}` | `{ok}` | `requireAdmin` |
| `/api/admin/rhapsody/extract` | POST | Extracts text from a Rhapsody PDF page and stores it into `rhapsody_days` | `{edition_id, date, page_number}` | `{ok, body, verse_text, prayer}` | `requireAdmin` |

Empty folders that showed up in the tree but hold no route: `app/api/announce/`, `app/api/report/`. Cruft — flag in Open Questions.

---

## 3. Navigation

### Bottom nav (`components/BottomNav.tsx`) — 4 tabs + a More button, in this order
1. **Today** → `/today`
2. **Bible** → `/bible`
3. **People** → `/community`
4. **Depth** → `/depth`
5. **More** (button, opens `<MoreSheet>` — not a route)

The bar hides on public/auth pages and on reading routes (`/read`, `/bible/[book]/[chapter]/*` — see `lib/routes.ts::isReadingRoute`).

### Secondary navigation
- **`<Nav>`** — sticky app bar. Renders on non-reading pages. Left: back chevron (only on non-main routes and non-`/day/*`); it uses `backHrefFor(pathname)` for a named destination and falls back to `router.back()`. Middle-left: "Deep Waters" wordmark link → `/today`. Right: notifications bell (`/notifications`, unread count driven by a realtime channel), then the user's `<Avatar>` linking to `/depth`.
- **`<MoreSheet>`** — bottom sheet from the More tab. Rows: profile summary → `/depth`; Edit profile → `/me/edit`; Prayer wall; Cohorts; Finishers; Share testimony; Announcements; Theme picker; Sign out; admin link if applicable.
- **`<DepthTabs>`** — segmented control on `/depth`: Progress / Highlights / Notes. All three views mount so filter state survives switching.
- **`/community` segmented control** — Feed / Prayer / Leaderboard / Finishers / Cohorts (`?view=` picks; only the selected view mounts).
- **`<DayHeader>`** — prev-day chevron, "Day N" picker button (opens `<DayPicker>` sheet), next-day chevron, plus a "Back to today" pill when off-day.
- **`<DayPicker>`** — sheet with the 10×9 grid; taps go to `/day/N`.
- **`<ReferencePicker>`** — book → chapter → verse sheet, shared by the Bible reader header (`<ReadingHeader>`) and the top-level book picker.

### Onboarding flow at `/welcome` (5 steps — `app/welcome/page.tsx`)
Rendered as a swiper; forward tap or arrow key advances. Skip goes to `/`. On the last step, the primary button goes to `/signup`.
1. **Welcome** — "Deep Waters" (title) + intro to the 90-day journey. Brand mark artwork.
2. **Every day** / **Read together** — 13 chapters/day, OT + NT together.
3. **One verse. One thought.** / **Share what stood out** — the reflection habit.
4. **You are not alone** / **Prayer, cohorts, and support** — the together side.
5. Progress / badges / finisher wall + a Sign-in link for returning members.

---

## 4. Features

### 90-day reading plan
- **Data:** `lib/plan.ts` holds the entire plan in-memory. `READING_PLAN[day-1]` returns `{ ot: Chapter[], nt: Chapter[] }` with `Chapter = {book, abbr, chapter}`. OT ≈ 10 chapters/day, NT ≈ 3.
- **Current day:** `currentDayNumber(profile.start_date)` — days elapsed from start, clamped 1–90.
- **Day view:** `/day/[n]` — `<DayHeader>`, gauge, greeting or reading-ahead line, three reading tiles, `<ChapterTicker>`, `<ReflectionForm>`. Chapter progress per day is real (`chapter_reads` table); ticking every chapter, or writing a reflection, sets `completions.is_full = true`.
- **Future days:** readable, not markable. `<ChapterTicker>` is disabled and `<ReflectionForm>` Save reads "Not yet"; the server rejects the write too.
- **Grace / streak:** in the `leaderboard` view — a break is a gap of >2 days; a one-day gap keeps the run. Filtered to `is_full = true` rows.

### Bible reader — free reading, verse selection, translations
- **Free reading:** `/bible` → `<BookPicker>` (three ways in: parsed reference, book search, browse by testament + section). `/bible/[book]` → `<ChapterGrid>`. `/bible/[book]/[chapter]` → `<ChapterView>`. `/bible/[book]/[chapter]/[verse]` → same, with `focus={start,end}` piped into `<ScriptureReader>`.
- **Reader:** `components/ScriptureReader.tsx` (902 lines — see §10). Server pre-wraps each verse via `lib/verseParse.ts::wrapVersesInHtml`. Client handles: rendering, highlight painting from `highlights` table, note markers from `verse_notes`, selection tracking (via native `Selection` API, though scripture is `user-select: none` — the toolbar reads from touched anchors), the verse toolbar, the note sheet, the compare sheet, share, share-as-image, and the focus-and-fade scroll on `/bible/…/[verse]`.
- **Verse selection toolbar:** `components/VerseToolbar.tsx` — bottom-anchored bar (not floating pill) with Highlight (5 named colours + Remove), Note, Copy, Share, Compare, Share-as-image. Reference line updates live.
- **Highlights & notes:** `highlights` and `verse_notes` tables; RLS = own rows only. Colours are named Shoal / Current / Coral / Fathom / Silt (`lib/highlights.ts`). Notes list on `/depth` (`components/NotesView.tsx`), tap-through to `/day/{n}` (which then also carries chapter context).
- **Compare (parallel translations):** `components/CompareSheet.tsx` (274 lines) — bottom sheet, per-translation row loaded independently via `/api/bible/verse-text` so one failure doesn't take the sheet down. FIRST_BATCH=5, MORE_STEP=5 for "Show more". Copy per row.
- **Translation switcher:** `components/TranslationSwitcher.tsx` — sits in the sticky `<ReadingHeader>` on every reading screen. Backed by `lib/translations.ts` (TRANSLATIONS list with `id, abbr, name, group, note, missing?, diverges?`). Persists to `profiles.preferred_bible_id`. `resolveTranslation()` falls back to KJV per-book when a translation lacks that book or numbers it on another tradition (Douay-Rheims Psalms).
- **Chapter data:** `lib/bible.ts` — server-side cache in `bible_cache` (Supabase) plus in-process memory cache; if the row isn't cached, hits API.Bible and writes back with the service-role key.

### Rhapsody of Realities devotional
- **Reader:** `/rhapsody` — server component, fetches today's row from `rhapsody_days` by `date = today`, plus its linked `rhapsody_editions` row for the file path, and mints a 30-minute signed URL to the PDF via the service-role key. Renders the article's verse block, the article body (split on double newlines), and an optional prayer block. Only "Open the original booklet" at the foot; the app-bar chevron carries the back.
- **Admin:** `/admin/rhapsody` → `<RhapsodyAdmin>` (661 lines). Upload/replace/delete monthly PDFs, map an article per date, extract text via `/api/admin/rhapsody/extract` (uses `unpdf` server-side).
- **Storage:** `rhapsody` bucket (private, signed URLs only).

### Community feed
- **Component:** `components/CommunityFeed.tsx` — reads the `community_feed` view (which joins `completions` + `profiles` and includes amen and comment counts). Sorted by `completed_at desc`, filter chips for Everyone / My cohort / a chosen cohort.
- **Row:** `components/ReflectionCard.tsx` — Avatar, name (linked to `/depth` on your own row only), Day N + date, verse block, reflection with `<MentionText>` (parses `@name` links), Amen button (`/api/react`), Comment thread (`/api/comment`), Report button on other people's rows.
- **Realtime:** subscribes to changes on `completions`, `reactions`, `comments`.

### Prayer board
- **Component:** `components/PrayerWall.tsx` (326 lines) — POST via `/api/prayer`, PATCH to mark answered, DELETE own request. Tabs: Open / Answered. Each row shows the requester, praying-count, an "I'm praying" toggle (writes to `prayer_prayed`).
- **Realtime:** subscribes to `prayer_requests`.

### Cohort system
- **Tables:** `cohorts`, `cohort_members` (many-to-many with per-cohort `role in ('member','leader')`), `announcements` (nullable `cohort_id` = global broadcast).
- **Public landing:** `/c/[slug]` — anyone can view; join card shifts by state (member / non-member-signed-in / signed-out).
- **Create:** `/cohorts/new`. On insert a trigger (`cohort_creator_is_leader`) auto-adds the creator as leader.
- **Manage:** `/cohorts/[slug]/manage` — leaders only (checked via `is_cohort_leader` DB function). Members list, remove-member, settings, announcement composer.
- **Announcements:** `/announcements` shows global + own-cohort. Trigger `notify_on_announcement` writes a per-user `notifications` row on insert.
- **Multi-membership:** yes — a user can be in many cohorts (via `cohort_members`). `profiles.cohort_id` is a "primary" cohort used only by the leaderboard's "My cohort" filter.

### /depth (progress, badges, highlights, notes)
- **Progress grid:** 90 cells, each an `<a href="/day/N">`. Cells fill according to state: **kept** (violet), **today** (sonar), **partial** (past-and-partially-ticked — violet fill from bottom, proportional to ticks/total), **past-and-not-kept** (recessed plate), **upcoming** (page ground).
- **Badges:** shown as a row in the Progress view. Definitions in `lib/badges.ts`: `first_day`, `streak_7`, `day_30`, `streak_30`, `day_60`, `day_90`. Awarded by the DB `award_badges` trigger on any full-day completion.
- **Cohorts:** list of the user's cohort memberships.
- **History:** past reflections, newest first.
- **Highlights / Notes:** see Bible reader.

### Admin panel
- **Dashboard `/admin`:** stat tiles (total users, new this week, completions today/week, open reports, pending testimonials, pending users, finishers, study notes written), plus link tiles into the sub-tools.
- **Users `/admin/users`:** search, filter=pending, per-row controls in `<UserAdminControls>`: Approve, Make admin, Remove. Delete calls `/api/admin/delete-user` (service-role).
- **Study notes `/admin/notes` + `/admin/notes/[day]`:** grid of 90 days; per-day title + body editor; `<NoteEditor>` upserts `study_notes`.
- **Reports `/admin/reports`:** batched, plain-select cross-lookup of target rows (deliberately no PostgREST joins — this project has hit HTTP 300 on ambiguous relationships). `<ReportActions>` resolves + optionally deletes the offending row.
- **Testimonials `/admin/testimonials`:** approve / unapprove / feature via `<TestimonialAdminControls>`.
- **Rhapsody `/admin/rhapsody`:** as above.

### Notifications inbox with realtime badge
- **Table:** `notifications` (kind: mention / comment / amen / announcement / badge / reminder; read boolean; link).
- **Feed:** `/notifications` renders newest first; visiting marks all read.
- **Badge:** `<Nav>` subscribes to a per-user Postgres-changes channel (`nav-notif-<uid>-<rand>`) on the `notifications` table and re-counts unread on any change. Small red badge on the bell icon; hidden at zero.

### Theme toggle (dark / light / system)
- **Component:** `components/ThemeToggle.tsx`. Persists to `localStorage.theme` (only reason localStorage is used in this app aside from a couple of specimens). Applies to `document.documentElement.dataset.theme`. "System" means removed from localStorage and driven by `matchMedia("(prefers-color-scheme: dark)")`.
- **Where it lives:** Theme picker rows inside `<MoreSheet>`.

---

## 5. Database

### Tables (schema in `supabase/schema.sql` unless noted)

`profiles`
- Cols: `id uuid PK → auth.users(id)`, `name text`, `photo_url text`, `bio text`, `start_date date default current_date`, `cohort_id uuid → cohorts(id) SET NULL`, `role text check('member','admin') default 'member'`, `approved boolean default true`, `email_reminders boolean default true`, `push_reminders boolean default true`, `reminder_hour int 0..23 default 7`, `preferred_bible_id text` (added by migration `2026_09_07_bible_cache_and_translations.sql`), `created_at timestamptz`.
- RLS: read for all; insert if `auth.uid() = id`; update by self or admin; delete admin only.

`cohorts`
- `id uuid PK`, `slug text unique`, `name text`, `description text`, `welcome_message text`, `start_date date`, `created_by uuid → auth.users SET NULL`, `created_at`.
- Index: `cohorts_slug_idx(slug)`.
- RLS: read all; insert if `auth.uid() = created_by`; update/delete via `is_cohort_leader(id)`.

`cohort_members`
- Composite PK `(cohort_id, user_id)`. FKs cascade. `role text check('member','leader') default 'member'`. `joined_at`.
- Index: `cohort_members_user_idx(user_id)`.
- RLS: read all; insert self or leader-of-that-cohort; delete self or leader; update leader only.

`completions`
- `id uuid PK`, `user_id → profiles cascade`, `day_number int 1..90`, `verse_reference text`, `verse_text text`, `reflection text`, `is_full boolean default true` (added by `2026_09_10_chapter_reads.sql`), `completed_at timestamptz default now()`. UNIQUE `(user_id, day_number)`.
- Indexes: `completions_day_idx(day_number desc, completed_at desc)`, `completions_user_idx(user_id)`.
- RLS: read all; own insert/update; delete own or admin.

`comments`
- `id uuid PK`, `completion_id → completions cascade`, `user_id → profiles cascade`, `body text`, `created_at`.
- Index: `comments_completion_idx(completion_id, created_at)`.
- RLS: read all; own insert; delete own or admin. Trigger `notify_on_comment_trigger` writes a notification.

`reactions`
- PK `(completion_id, user_id)`. FKs cascade. `created_at`.
- RLS: read all; own insert; own delete. Trigger `notify_on_amen_trigger`.

`prayer_requests`
- `id uuid PK`, `user_id → profiles cascade`, `cohort_id → cohorts SET NULL`, `body text`, `is_answered boolean default false`, `answered_note text`, `created_at`.
- Index: `prayer_created_idx(created_at desc)`.
- RLS: read all; own insert/update; delete own or admin.

`prayer_prayed`
- PK `(prayer_id, user_id)`.
- RLS: read all; own insert/delete.

`announcements`
- `id uuid PK`, `cohort_id → cohorts cascade` (nullable = global), `author_id → profiles SET NULL`, `title text`, `body text`, `created_at`.
- Index: `announcements_cohort_idx(cohort_id, created_at desc)`.
- RLS: read all; insert if `auth.uid() = author_id` AND (global-by-admin OR cohort-leader-of-that-cohort); delete admin or cohort leader. Trigger `notify_on_announcement_trigger`.

`badges`
- PK `(user_id, badge)`. `earned_at`.
- RLS: read all (system writes only, no insert policy for users).

`study_notes`
- PK `day_number int 1..90`. `title text`, `body text`, `author_id → profiles SET NULL`, `updated_at`.
- RLS: read all; all-verbs for admin.

`testimonials`
- `id uuid PK`, `user_id → profiles cascade`, `body text`, `approved boolean default false`, `featured boolean default false`, `created_at`.
- RLS: select if approved OR own OR admin; own insert; update admin; delete own or admin.

`reports`
- `id uuid PK`, `reporter_id → profiles SET NULL`, `target_type text check('completion','comment','prayer','testimonial')`, `target_id uuid`, `reason text`, `resolved boolean default false`, `created_at`.
- RLS: read admin; insert if `auth.uid() = reporter_id`; update admin.

`mentions`
- `id uuid PK`, `source_type text check('completion','comment','prayer')`, `source_id uuid`, `mentioned_user_id → profiles cascade`, `created_at`.
- Index: `mentions_user_idx(mentioned_user_id, created_at desc)`.
- RLS: read all; insert if `auth.uid() is not null`. Trigger `notify_on_mention_trigger`.

`push_subscriptions`
- `id uuid PK`, `user_id → profiles cascade`, `endpoint text unique`, `p256dh text`, `auth text`, `created_at`.
- RLS: `push_own` — all verbs, `auth.uid() = user_id`.
- **Note:** table exists but nothing in the app writes to it — flag in Open Questions.

`notifications`
- `id uuid PK`, `user_id → profiles cascade`, `kind text`, `title text`, `body text`, `link text`, `read boolean default false`, `created_at`.
- Index: `notifications_user_idx(user_id, read, created_at desc)`.
- RLS: own select / update / delete.

`events` (analytics)
- `id bigserial`, `user_id uuid`, `event text`, `meta jsonb`, `created_at`.
- Index: `events_created_idx(created_at desc)`.
- RLS: `insert_any`; read admin only.

`bible_cache` — added by `2026_09_07_bible_cache_and_translations.sql`
- `id text PK` (`<bible-id>|<passage>`), `content text`, `fetched_at timestamptz`, `hits int default 0`.
- RLS enabled; no policy — writes go through the service-role key (`lib/bible.ts`).

`highlights` — added by `2026_09_09_highlights_and_notes.sql`
- `id uuid PK`, `user_id → profiles cascade`, `day_number int 1..90`, `testament text('ot','nt')`, `book text`, `chapter int`, `verse_start int`, `verse_end int (≥ start)`, `colour text check('shoal','current','coral','fathom','silt')` (renamed from the old amber/mint/... by the two follow-up migrations), `created_at`.
- Indexes: `highlights_user_idx`, `highlights_chapter_idx(user_id, book, chapter)`.
- RLS: all four verbs restricted to `auth.uid() = user_id`.

`verse_notes` — added by `2026_09_09_highlights_and_notes.sql`
- Same locator columns as `highlights` + `verse_text text` (snapshot) + `body text` + `created_at`, `updated_at`. Trigger `touch_verse_notes_trigger` auto-touches `updated_at`.
- Indexes: `verse_notes_user_idx(user_id, updated_at desc)`, `verse_notes_chapter_idx`.
- RLS: own-only.

`chapter_reads` — added by `2026_09_10_chapter_reads.sql`
- `id uuid PK`, `user_id → profiles cascade`, `day_number int 1..90`, `book text`, `chapter int`, `read_at timestamptz`. UNIQUE `(user_id, day_number, book, chapter)`.
- Index: `chapter_reads_user_day_idx(user_id, day_number)`.
- RLS: select / insert / delete restricted to own.

`rhapsody_editions` and `rhapsody_days` — likely added by an earlier session (referenced by `app/rhapsody/page.tsx` and `<RhapsodyAdmin>`). Not in `supabase/schema.sql` or the migrations folder. **Flag in Open Questions.**

### Views (all in `supabase/schema.sql`, re-declared by `2026_09_10_chapter_reads.sql` to filter `is_full`)
- `leaderboard` — per-user days_completed / highest_day / current_streak, `is_full=true` only.
- `community_feed` — completions joined with profiles + amen/comment counts, only rows with a non-empty reflection.
- `finishers` — profiles with 90 distinct full days.
- `cohort_summary` — member_count + avg_days_completed per cohort.
- `verse_of_the_day` — most-picked `verse_reference` among today's completions.

### Functions
- `is_admin()`, `is_cohort_leader(uuid)` — RLS helpers (SECURITY DEFINER).
- `award_badges()` — trigger fn on `completions` insert/update. Only fires when `NEW.is_full = true`. Awards first_day, day_30/60/90, streak_7/30.
- `notify_on_comment`, `notify_on_amen`, `notify_on_mention`, `notify_on_announcement` — each writes into `notifications`.
- `cohort_creator_is_leader` — auto-adds creator to `cohort_members` as leader.
- `touch_verse_notes` — updates `updated_at`.

### Triggers
- `award_badges_trigger` on `completions` (after insert/update)
- `notify_on_comment_trigger` on `comments` (after insert)
- `notify_on_amen_trigger` on `reactions` (after insert)
- `notify_on_mention_trigger` on `mentions` (after insert)
- `notify_on_announcement_trigger` on `announcements` (after insert)
- `cohort_creator_trigger` on `cohorts` (after insert)
- `touch_verse_notes_trigger` on `verse_notes` (before update)

### Storage buckets
- **`avatars`** — public read. Users can upload/update files under their own `auth.uid()/…` prefix (RLS on `storage.objects`). Used by onboarding and `/me/edit`.
- **`rhapsody`** — private. Admin uploads PDFs, service-role key mints signed URLs on demand. Referenced only from the Rhapsody server routes; no public storage policy.

### Migrations (in order — `supabase/migrations/*.sql`)
1. `2026_09_07_bible_cache_and_translations.sql` — adds `bible_cache` table and `profiles.preferred_bible_id` column.
2. `2026_09_07_highlight_colour_names.sql` — begins colour rename from amber/mint/sky/rose/lavender to the Fathom-named set on `highlights.colour`.
3. `2026_09_07_highlight_colour_names_part_two.sql` — completes rename + tightens the CHECK constraint.
4. `2026_09_09_highlights_and_notes.sql` — creates `highlights` and `verse_notes` (RLS, indexes, `updated_at` trigger).
5. `2026_09_10_chapter_reads.sql` — creates `chapter_reads`, adds `completions.is_full`, rewrites `leaderboard` / `finishers` / `cohort_summary` views, rewrites `award_badges` gated on `is_full`.
6. `2026_09_10_chapter_reads_STEP1_tables.sql` and `..._STEP2_views.sql` — a two-file split of the same migration, likely committed for a phased run in Supabase. **Duplicate of #5 — flag in Open Questions.**

The tables that back Rhapsody (`rhapsody_editions`, `rhapsody_days`) aren't in this folder — they exist in the live DB (Rhapsody works) but must have been created via the Supabase console. Worth capturing in a migration so a fresh project isn't broken.

---

## 6. Auth and roles

### Sign up
`/signup` — email + password via `supabase.auth.signUp`. Password minimum 8 characters, enforced client-side. On success Supabase sends a confirmation email; user lands on a "check your email" state. When they click the link, `/auth/callback` exchanges the code and redirects to `?next=` (validated to same-origin) which is usually `/onboarding`.

### Sign in
`/login` — email + password via `supabase.auth.signInWithPassword`. A "Set a password" card at the foot handles legacy magic-link users. `/forgot-password` triggers a reset email; the link lands on `/reset-password` which uses the recovery session to call `updateUser`.

### Session refresh
`middleware.ts` runs on every request. Calls `supabase.auth.getUser()`, which rotates the refresh token and writes the new cookie pair onto the outgoing response. All redirects use that same response so refresh tokens don't die under load.

### Onboarding
`/onboarding` — required after sign-up for a first login (server pages call `requireProfile()` which redirects here if no `profiles` row). Sets `name`, `photo_url` (uploaded to `avatars` bucket), `start_date` (defaults to today). If the URL carries `?cohort=<slug>`, it also inserts a `cohort_members` row and forces `start_date` to the cohort's start.

### Roles / flags
- **`profiles.role`** — `'member'` (default) or `'admin'`. Set by hand in SQL (the seed comment at the bottom of `schema.sql` shows the pattern). `is_admin()` returns true; `requireAdmin()` gates admin routes; RLS `_admin` policies allow admin-only writes.
- **`cohort_members.role`** — `'member'` (default) or `'leader'`. A leader can manage that cohort (`/cohorts/[slug]/manage`) and post cohort announcements. `is_cohort_leader(uuid)` returns true for the leader, the original creator, or an admin. Auto-set for the creator by `cohort_creator_trigger`.
- **`profiles.approved`** — boolean, default `true`. Reserved for a moderation flow where new sign-ups need admin approval; `<UserAdminControls>` can flip it. `leaderboard`, `community_feed`, `finishers` filter to `approved = true`. **Currently every new sign-up is approved by default.**

### What each role sees
- **Signed-out:** landing / login / signup / forgot / reset / auth callback / welcome. Everything else redirects to `/login`.
- **Member:** everything except `/admin/*` (which redirects to `/today`). If they're a cohort leader, `/cohorts/[slug]/manage` for their cohort.
- **Admin:** all of the above plus `/admin/*` and its sub-tools. MoreSheet also shows an Admin dashboard link.

---

## 7. External services

- **API.Bible** — `lib/bible.ts`, base URL `https://api.scripture.api.bible/v1`. Key: `API_BIBLE_KEY`. Chapter fetches go through `bible_cache` first, then API.Bible on miss (writes back with `SUPABASE_SERVICE_ROLE_KEY`). Used by every scripture surface (`/read`, `/bible/*`, Compare).
- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client / server components, `SUPABASE_SERVICE_ROLE_KEY` for privileged writes (`lib/bible.ts` cache, `app/api/admin/*`, `app/rhapsody/page.tsx` signed URLs).
- **Resend** — auth memory says custom SMTP is configured in Supabase Auth (not called from app code). No `RESEND_*` env vars in the repo.
- **Crossway ESV / YouVersion** — not wired.
- **Google Fonts** — self-hosted at build time via `next/font/google`; nothing called at runtime.
- **CDN fonts (Rhapsody + OG cards)** — `app/api/og/route.tsx` and `app/api/og/verse/route.tsx` fetch Poppins TTFs and Source Serif 4 TTFs from `cdn.jsdelivr.net/fontsource` at edge render time, with a defensive fallback if the CDN returns HTML.

---

## 8. Realtime

Every channel is named uniquely with a `Math.random()` suffix (project convention — a fixed topic would let a strict-mode remount tear down its successor's subscription). All four are opened in `useEffect` and torn down with `supabase.removeChannel(channel)` in the returned cleanup.

| File | Channel prefix | Table | Event | Cleanup |
|---|---|---|---|---|
| `components/Nav.tsx` (unread bell count) | `nav-notif-<uid>-<rand>` | `notifications` | `*` filtered by `user_id=eq.<uid>` | in `useEffect` return |
| `components/PrayerWall.tsx` | `prayer-live-<rand>` | `prayer_requests` | `*` | in `useEffect` return |
| `components/LeaderboardView.tsx` | `leaderboard-live-<rand>` | `completions` | `*` | in `useEffect` return |
| `components/CommunityFeed.tsx` | `feed-live-<rand>` | (multiple — completions/comments/reactions) | `*` | in `useEffect` return |

Supabase's realtime publication includes `completions`, `comments`, `reactions`, `prayer_requests`, `notifications` (per `schema.sql` §REALTIME block).

---

## 9. Design system

**Fathom is applied.** Confirmed by tokens in `app/globals.css`:

- **Fonts** (all three self-hosted via `next/font/google`, wired in `app/layout.tsx`):
  - `--font-sans` — IBM Plex Sans (400/500/600, italic) — interface.
  - `--font-mono` — IBM Plex Mono (400/500) — every number, label, kicker.
  - `--font-serif` — Literata — scripture and scripture-adjacent (references, name-above-a-reflection).

- **Colour tokens** — bare `:root` for light, `[data-theme="dark"]` for dark:
  - Neutrals: `--bg`, `--text`, `--muted`, `--line`
  - Surfaces: `--card-bg`, `--card-border`, `--card-highlight` (transparent), `--card-shadow` (transparent), `--nav-bg`, `--nav-border`, `--soft-bg`, `--soft-border`, `--input-bg`, `--input-bg-focus`, `--input-border`, `--chip-bg`, `--chip-border`
  - Accents (light): `--accent #3B23B8` (violet), `--accent-strong #2A1B8C`, `--accent-soft rgba(59,35,184,0.09)`, `--pink #3B23B8` (retired, aliased to accent)
  - Second colour (light): `--sonar #067A5A`, `--sonar-soft rgba(6,122,90,0.10)`, `--on-accent #FFFFFF`
  - Semantic: `--danger`, `--danger-soft`, `--success` (= sonar), `--warning`
  - Highlights: `--hl-shoal-ground/rule`, `--hl-current-ground/rule`, `--hl-coral-ground/rule`, `--hl-fathom-ground/rule`, `--hl-silt-ground/rule`
  - Spacing: `--sp-1..7` (4/8/12/24/40/64/96)

- **Green:** the only defined green is `--sonar` and `--success` (which resolves to sonar). Every use in the stylesheet is a position/state indicator (a 2px rule, a 6×6 dot, a "today" mark, an "on" chip) — none is decorative fill. Under the 1%-of-screen budget. **No component uses raw Tailwind `text-green-*` / `bg-green-*` / `border-green-*`.** (Confirmed by grep.)

- **Shadows:** `--card-shadow` is `transparent` in both themes; the `.card` class in the CSS re-skinned to a recessed plate, not an elevated card. The one meaningful `box-shadow` in the whole stylesheet is `.chapter-tick-box:focus-visible` (focus ring) and a small selection state `inset 0 0 0 1px var(--sonar)`. Nothing is elevated with a drop shadow. **Passes.**

- **`backdrop-filter` / blur:** `grep` returns nothing in `globals.css`. Legacy component `.card` / `.glass-*` classes historically used blur; the CSS variables are now transparent so the class names remain but do not render a glass effect. **Passes.**

- **Gradients:** three uses in `globals.css`, all functional not decorative:
  - `.gauge` — a `repeating-linear-gradient` for tick marks on the whole-plan gauge (drawn scale, not decoration).
  - The custom `<select>` chevron — a pair of `linear-gradient`s that draw a caret.
  - One radial glow behind the splash screen mark (`components/SplashScreen.tsx`, kept off the 1%).
  No purple-to-blue hero gradients or accent-scatter fills. **Passes.**

- **Rounded containers:** many `.rounded-full` and `.rounded-2xl` remain on components (see grep results for the full list — 40+ hits). Under Fathom rules "square corners on containers, round only on things you touch." Pills on buttons and chips are correct. **The rounded containers to flag:**
  - `components/AnnouncementForm.tsx:44` — a `rounded-full` on a text input (container, not a touch target).
  - `components/CohortSettingsForm.tsx:63,92` — `rounded-full` on text inputs (name, description).
  - `components/CohortShareBox.tsx:29` — `rounded-full` on a read-only URL input.
  - `components/NoteEditor.tsx:49` — `rounded-full` on a title input.
  - `components/PrayerWall.tsx:227,230` — pill-shaped tab buttons for Open/Answered (arguably touch targets — probably fine).
  All are legacy from before Fathom collapsed the input shape to `rounded-xl`. Note the global `input, textarea, select { border-radius: 0 }` rule in `globals.css` means these `rounded-full` classes render as squares anyway — the classes are dead style, but worth cleaning.

---

## 10. Known code smells

### Files over 500 lines
- `components/ScriptureReader.tsx` — **902 lines.** Single component doing: DOM verse-wrapping, highlight painting, note markers, selection tracking, toolbar coordination, note-sheet coordination, compare-sheet coordination, share, share-as-image, focus-verse scroll/fade, plus optimistic-with-rollback for highlights and notes. A candidate for splitting: extract highlight-painting, extract selection detection, extract action handlers.
- `components/RhapsodyAdmin.tsx` — **661 lines.** Upload flow, per-day mapping, PDF text extract, drafts state. Reasonable given the scope, but self-contained.

### Duplicated logic that should be shared
- **`chapter-tick-row` / `.dw-verse` / gauge patterns** all duplicated between `ScriptureReader`, `ChapterView`, `ChapterTicker`, and the day view. Nothing egregious — mostly convention-following — but the per-verse styling assumptions live in three places (`ScriptureReader`, `ChapterView`, `verseParse.ts`).
- **Depth grid rendering** appears in `app/depth/page.tsx` and `components/DayPicker.tsx` with slightly different state (partial fill on the former, not the latter). Extract a `<NinetyDayGrid>` component.
- **Focus-verse offset** logic is inside `ScriptureReader`; if it's ever needed elsewhere it should move to a hook.
- **`chapter_reads` counting** happens in `/api/chapter-read` and `/api/complete` — same server-side query in two places. Small; not a real duplication.

### TODO / FIXME / commented-out
- **None found.** `grep -rE "TODO|FIXME|XXX|HACK"` in `app/`, `components/`, `lib/` returns nothing.

### `any` types
17 hits (`grep -rE ": any\b|as any"` across app+components+lib). Concentrated in Supabase result mappings (`{ data as any }`) where the row types haven't been declared. Not urgent — inference is fine at these boundaries — but the concentrated spots are:
- `app/cohorts/[slug]/manage/page.tsx` (member map)
- `app/depth/page.tsx` (`completions.filter((c as any).is_full…)` in the doneDays computation — that one is worth typing)
- `components/ReflectionCard.tsx`, `components/CohortsView.tsx` (item props typed as `any` before rendering)
- `lib/mentions.ts` (a couple of untyped supabase responses)

### Other things spotted
- **Empty API folders:** `app/api/announce/` and `app/api/report/` — no `route.ts` inside. Dead directories from earlier refactors; safe to delete.
- **Two versions of the `chapter_reads` migration** in `supabase/migrations/`: the single-file `2026_09_10_chapter_reads.sql` AND a two-file split `..._STEP1_tables.sql` + `..._STEP2_views.sql`. Both were applied in the live DB (probably by pasting one, then the split). One of them should go.
- **Public bucket names in memory but not in this schema:** `rhapsody_editions` and `rhapsody_days` tables aren't in `supabase/schema.sql` or in any migration file — they were created live via the Supabase console. A fresh project can't be rebuilt from this repo alone.
- **`push_subscriptions` table** has RLS but no writer anywhere in the app.
- **Two ROG-era relics** in tokens: `--pink` is aliased to the accent for backwards compatibility with call sites that still reference `text-rog-pink` / `bg-rog-pink`; and Tailwind `rog.*` colour classes still exist. Retiring them is a global rename and hasn't been done.

---

## 11. Repo shape

### Top three folder levels (excluding `node_modules`, `.next`, `.git`)
```
.
├── .claude/            (Claude Code local settings)
├── .vercel/            (Vercel CLI project link)
├── app/
│   ├── admin/
│   │   ├── notes/
│   │   ├── reports/
│   │   ├── rhapsody/
│   │   ├── testimonials/
│   │   └── users/
│   ├── announcements/
│   ├── api/
│   │   ├── admin/
│   │   ├── announce/        (empty)
│   │   ├── bible/
│   │   ├── chapter-read/
│   │   ├── cohort/
│   │   ├── comment/
│   │   ├── complete/
│   │   ├── og/
│   │   ├── prayer/
│   │   ├── react/
│   │   ├── report/          (empty)
│   │   └── reset-my-data/
│   ├── auth/
│   │   └── callback/
│   ├── bible/
│   │   └── [book]/
│   ├── c/
│   │   └── [slug]/
│   ├── cohorts/
│   │   ├── [slug]/
│   │   └── new/
│   ├── community/
│   ├── day/
│   │   └── [n]/
│   ├── depth/
│   ├── finishers/
│   ├── forgot-password/
│   ├── leaderboard/
│   ├── login/
│   ├── me/
│   │   └── edit/
│   ├── notifications/
│   ├── onboarding/
│   ├── prayer/
│   ├── read/
│   ├── reset-password/
│   ├── rhapsody/
│   ├── signup/
│   ├── testimonials/
│   ├── today/
│   └── welcome/
├── components/         (48 .tsx files)
├── lib/
│   ├── og/
│   └── supabase/
├── public/             (18 assets: brand marks, favicons, manifest.json)
└── supabase/
    └── migrations/     (7 SQL files)
```

### Counts
- **172 files** total (excluding `node_modules`, `.next`, `.git`).
- **~18,845 lines** across `.ts`, `.tsx`, `.css`, `.sql` (excluding the same folders).
- Longest source files: `components/ScriptureReader.tsx` (902), `components/RhapsodyAdmin.tsx` (661), `app/globals.css` (~1,400+).
- Migrations: 7 files (as of 2026-09-10).

---

## Open questions for Ash

1. **`rhapsody_editions` and `rhapsody_days` tables** are used by `/rhapsody` and `<RhapsodyAdmin>` but exist in the live DB only — no migration file. Should I capture them in a migration so the repo is a complete source of truth?
2. **Duplicate `chapter_reads` migrations** — the single-file `2026_09_10_chapter_reads.sql` and the two-file `..._STEP1_tables.sql` / `..._STEP2_views.sql` are the same migration. Both are on disk. Which do you want kept?
3. **Empty API folders** `app/api/announce/` and `app/api/report/` are cruft. Safe to delete?
4. **`push_subscriptions` table** has RLS + no writer. Was push planned and dropped, or is it queued?
5. **`profiles.approved` flag** defaults to `true` on sign-up. Is the moderation workflow expected to be manual (admin flips new sign-ups to approved via `<UserAdminControls>`), or was that flow abandoned? Currently the check is on but everyone passes it.
6. **ROG-era Tailwind classes** (`rog.pink`, `rog.purple`, etc.) still resolve — many components use `text-rog-purple`, `bg-rog-cream`, `border-rog-line`. Fathom tokens have taken over via CSS variables, but the class names remain. Should the app-wide rename to Fathom naming (`text-ink`, `bg-recess`, `border-line`) happen, or should the classes stay for stability?
7. **Legacy `rounded-full` inputs** — announcements, cohort settings, cohort share, note editor. The global input CSS makes them render square anyway, so it's cosmetic-only. Sweep them to `rounded-xl`?
8. **Vercel config** — there is no `vercel.json`. Two edge routes (`/api/og`, `/api/og/verse`) declare `runtime = "edge"` inline; everything else is Node. Is any function-timeout / cron / regional config expected in Vercel dashboard settings I should record here?
9. **`middleware.ts` matcher** — currently defaults to "every request" (which includes static assets). Is there a matcher config elsewhere or should we add one so `_next/static` and image assets skip the auth-refresh?

---

*Generated by the read-only discovery pass. No source files were modified.*
