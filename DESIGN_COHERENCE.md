# Design Coherence Audit

Written 2026-09-13. Read-only — nothing in the app was changed to produce this
file. Nothing should be fixed from it yet either; that's Part 2, and it's a
menu, not a to-do list, until you've picked from it.

**What "correct" means in this document.** Fathom is not a look I'm inventing
to grade the app against — it's already written down, in enormous, deliberate
detail, in [`app/globals.css`](app/globals.css). Whoever did the design
system passes (the git history calls them "Move 1" through "Move 6," then
"the Roll," then "the states pass") left comments explaining *why* each rule
exists, often with the broken thing it replaced named outright. So every
"correct answer" below is something the app's own CSS already asserts about
itself — I'm reporting where the JSX agrees with it and where it doesn't.

**Method.** I read `globals.css` in full (4,839 lines) to build the actual
spec, then checked every screen and shared component against it — spacing,
type, buttons, headers, footers, sheets, chips, list rows, labels, states,
icons, destructive actions, tap targets. Every finding below is anchored to
a file and a line number rather than a screenshot embedded in this file —
I couldn't get the actual image bytes onto disk from the browser tools
available to me, so real screenshots of every screen (signed-in, taken
2026-09-13) live in our conversation instead of in this document. Where a
screenshot visually confirms a finding below, I've noted it inline. The
file:line citations are exact enough to verify in an editor either way.

---

## Part 1 — The audit

### 1. Spacing

The system defines exactly seven steps — 4 / 8 / 12 / 24 / 40 / 64 / 96px,
named hair/tight/close/interior/major/page/world, mapped one-to-one onto
Tailwind's `mt-1/2/3/6/10/16/24` (`app/globals.css:102-121`). Nothing is
supposed to fall between them.

In practice, off-scale steps — Tailwind's own `4` (16px), `5` (20px), `8`
(32px), `12` (48px), `20` (80px), which don't correspond to anything on the
seven-step scale — are all over the app:

| utility | files touched | occurrences |
|---|---|---|
| `mt-4` | 36 | 70 |
| `mt-8` | 22 | 37 |
| `px-4` | 27 | 54 |
| `px-5` | 16 | 25 |
| `mt-5` | 8 | 12 |
| `gap-4` | 9 | 10 |
| `space-y-4` | 8 | 8 |
| `p-4` / `p-5` / `p-8` | 4 / 2 / 1 | 4 / 4 / 1 |

Heaviest single files: `components/RhapsodyAdmin.tsx` (23 off-scale hits —
`space-y-4` at :345, `mt-4` at :409, `px-4` at :413), `app/private/[id]/page.tsx`
(11, `mt-4` repeated at :126,128,148,150,166,168,186,188), `app/page.tsx` (9,
`mb-8`/`mt-5`/`mt-8`/`gap-4 mt-12`/`px-8 py-4` at :24,30,33,40,47,74),
`app/depth/page.tsx` (8), `components/ReferencePicker.tsx` (7),
`components/HighlightsView.tsx` (7), `app/welcome/page.tsx` (7).

The shell holds the line better than the screens do: `components/BottomNav.tsx`
uses no off-scale spacing at all, and `components/ReadingHeader.tsx` /
`components/DayHeader.tsx` stick to `mt-2`, `pt-3`, `gap-1/2`, `mb-6`, `px-3`,
`py-2` — all on-scale.

**The one that matters most because it's load-bearing:** `components/Nav.tsx:245`,
the shared app-bar container itself, uses `px-4 py-3` — `py-3` (12px) is
on-scale, but `px-4` (16px) is not, and it doesn't match the `px-6` (24px)
gutter that essentially every page's content container uses
(`<main className="max-w-3xl mx-auto px-6 py-10">`, e.g.
`app/bible/page.tsx:21`, `app/community/page.tsx:80`,
`app/day/[n]/page.tsx:163`). So the header's own edge doesn't line up with the
content beneath it, on every screen that uses the shared nav.

**Majority pattern:** on-scale spacing in the shell (nav chrome, tab bar,
reading header/toolbar); off-scale spacing in page content, worst in admin
and one-off/marketing pages. This is consistent with the "shape of the
problem" below — the shell was built/fixed during a system pass and has
stayed clean; individual screens built afterward reached for whatever Tailwind
number looked right in the moment.

### 2. Type

Three faces, one job each, by the CSS's own account: sans for chrome, mono
for data, serif for scripture. Eleven type sizes are actually named as CSS
classes (`.meta` 9.5px, `.chapter-mark` 10px, `.tab-label` 8.5px, `.chip`
13px, `.btn*` 14px, `.segmented-option` 13px, `.read-row .read-ref` 17px,
`.reference-jump-ref` 20px, `.reference-jump-label` 11px, `.bible-content`/
`.verse-text` 18px, `.chapter-tile` 14px, `.day-count` 34px).

Against those eleven, the app's JSX uses roughly **31 distinct font-size
values** — the seven standard Tailwind steps (`text-sm` 156 uses, `text-xs`
84, `text-lg` 6, `text-xl` 2, `text-2xl` 6, `text-3xl` 6, `text-base` 4) plus
about 24 arbitrary bracket values (`text-[15px]` 50 uses, `text-[28px]` 28,
`text-[34px]` 27, `text-[17px]` 14, `text-[13px]` 12, `text-[11px]` 10,
`text-[10px]` 9, `text-[19px]` 8, `text-[22px]` 7, `text-[26px]` 4,
`text-[14px]` 4, `text-[27px]` 3, down to singleton values at `[8px]`,
`[40px]`, `[38px]`, `[16px]`, `[12px]`, `text-7xl`, `text-6xl`). `text-[15px]`
in particular functions as a de facto body size used 50 times, and it isn't
defined anywhere in `globals.css`.

**Page headings are the clearest single symptom.** The closest thing to a
majority is `text-[28px] md:text-[34px] font-semibold tracking-[-0.03em]
text-rog-ink leading-tight`, copy-pasted verbatim into **25 files** —
Bible ([app/bible/page.tsx:22](app/bible/page.tsx:22)), Community
([app/community/page.tsx:81](app/community/page.tsx:81)), Notifications,
Preferences, Pulse, Sermons list, Onboarding, Login, Signup, and most of
`/admin/*`. But it's a copy-pasted string, not a shared component or class —
and several screens use something else entirely for what is, on every one of
these screens, the single biggest word on the page:

- **Today / the day view** — [app/day/[n]/page.tsx:201](app/day/[n]/page.tsx:201),
  `.day-count`: mono, 34px, weight 400, tabular. Right size, wrong face and
  weight — a deliberate choice per its own comment, but it means the loudest
  text on the app's most-used screen looks nothing like the loudest text
  anywhere else.
- **Depth / profile** — [app/depth/page.tsx:308](app/depth/page.tsx:308):
  `font-serif text-[26px] leading-tight` for the person's name; there's no
  page-title h1 at all, and the section headers below it
  (`app/depth/page.tsx:204,213,241,260,291`) are `text-[15px] font-semibold`
  — smaller than the majority h1 by nearly half.
- **Welcome** — [app/welcome/page.tsx:125](app/welcome/page.tsx:125):
  `text-[30px] md:text-4xl font-semibold` — close to the majority but not it.
- **Finished** — [app/finished/page.tsx:45](app/finished/page.tsx:45):
  `font-serif text-[32px] md:text-[40px] leading-[1.12]` — different face,
  size, and weight all at once.
- **Rhapsody** — [app/rhapsody/page.tsx:93](app/rhapsody/page.tsx:93):
  `font-serif text-3xl md:text-4xl font-normal`.
- **The public cohort invite page** —
  [app/c/[slug]/page.tsx:132](app/c/[slug]/page.tsx:132): `text-5xl md:text-6xl
  font-bold` — the only `font-bold` (700) h1 in the app, at roughly double
  the majority's scale.
- **The sermon reader** — `.sermon-read-title`
  ([app/globals.css:3960](app/globals.css:3960)): serif, 400 weight, sized off
  the reader's own font-size slider rather than any fixed step.

**Weight tells a similar story.** `font-semibold` (107 uses) and `font-medium`
(58) are the real defaults; `font-bold` shows up 24 times, clustered almost
entirely in admin/stat contexts (`app/admin/page.tsx:54,102,106,110,114,118`,
`app/cohorts/[slug]/manage/page.tsx:75,79,83,87,116`,
`components/LeaderboardView.tsx:182`) as an unofficial "purple bold" emphasis
convention that isn't defined anywhere and isn't used by the equivalent
numbers on non-admin screens, which use `font-semibold` instead for the same
job.

**Face leakage:** serif (meant for scripture) shows up as a decorative
heading/label face in sheet titles and pickers —
[components/BookPicker.tsx:284](components/BookPicker.tsx:284),
[components/TranslationSwitcher.tsx:198](components/TranslationSwitcher.tsx:198),
[components/CompareSheet.tsx:141](components/CompareSheet.tsx:141),
[components/ReferencePicker.tsx:251](components/ReferencePicker.tsx:251) all
use `font-serif text-2xl font-medium` for what are UI chrome headings, not
scripture — plus [app/depth/page.tsx:308](app/depth/page.tsx:308) and
[app/onboarding/page.tsx:175](app/onboarding/page.tsx:175). Mono stays
disciplined everywhere except `.day-count`, where it's deliberately used as a
display face rather than metadata.

**Majority pattern:** sans, `text-[28px]/[34px]`, `font-semibold`,
`-0.03em` tracking is the closest thing to a house heading style, and it
covers about half the screens. The other half — Today, Depth, Welcome,
Finished, Rhapsody, the cohort invite page, the sermon reader — each made an
independent, defensible-in-isolation choice, with no grouping logic that
would predict which screens get which treatment.

### 3. Buttons

Three named classes exist: `.btn-primary`, `.btn-secondary`, `.btn-danger` —
all pills, all `px-6 py-3`, 14px, and the CSS comment is explicit that
`.btn-pink` was retired and everything routes through these three
(`app/globals.css:328-349`).

**Primary buttons** are named correctly almost everywhere (`app/login/page.tsx:70`,
`app/signup/page.tsx:69,102`, `app/onboarding/page.tsx:263`,
`app/finished/page.tsx:71`, `components/NoteEditor.tsx:66`,
`components/SermonEditor.tsx:418`, and eight more), but the class is routinely
resized with overrides — at least five distinct visual renderings beyond the
canonical one:
[components/TestimonialAdminControls.tsx:29](components/TestimonialAdminControls.tsx:29)
(`btn-primary text-xs px-4 py-2`),
[components/CohortsView.tsx:50](components/CohortsView.tsx:50)
(`btn-primary !py-2 !px-5 text-sm`),
[components/ReflectionCard.tsx:278](components/ReflectionCard.tsx:278)
(`btn-primary !text-[13px] px-4 py-2`),
[app/admin/users/page.tsx:44](app/admin/users/page.tsx:44) (`btn-primary
text-sm`), and [components/NewSermonButton.tsx:90](components/NewSermonButton.tsx:90),
which renders a completely different class (`sermon-pick-new`) for what is
still, functionally, the primary CTA in that spot.

**Secondary buttons** show the same pattern —
[app/depth/page.tsx:323](app/depth/page.tsx:323),
[components/DayHeader.tsx:77](components/DayHeader.tsx:77),
[components/DayPicker.tsx:145](components/DayPicker.tsx:145),
[components/RhapsodyAdmin.tsx:324,328,537,544,548](components/RhapsodyAdmin.tsx:324)
all override padding and font-size on top of `.btn-secondary`.

**There is no "quiet" button class, and where the app needs one it's built
four different ways:**
[components/ThemeToggle.tsx:44](components/ThemeToggle.tsx:44) (`tap-target
px-2 py-1 meta`, correctly tap-target-compensated),
[components/TestimonialAdminControls.tsx:36](components/TestimonialAdminControls.tsx:36)
(bare `text-danger px-2`, no compensation),
[components/ReportButton.tsx:36-53](components/ReportButton.tsx:36) (three
different tiny inline text-buttons in one file, on legacy `rog-*` tokens),
[components/PrayerWall.tsx:371-375](components/PrayerWall.tsx:371) (same
pattern, also on `rog-*` tokens). None share a height, a color source, or a
padding rule.

**Destructive buttons** are correctly `.btn-danger` in the places that matter
most — [components/ResetMyData.tsx:78,88](components/ResetMyData.tsx:78),
[components/CohortSettingsForm.tsx:147,152](components/CohortSettingsForm.tsx:147) —
but not everywhere: [components/TestimonialAdminControls.tsx:36](components/TestimonialAdminControls.tsx:36)'s
Delete is a naked `text-danger` word, not a bordered pill, so "delete"
sometimes looks like a serious action and sometimes looks like a hyperlink
depending which file you're in.

**Majority pattern:** the three named classes are the right instinct almost
everywhere they're reached for, but they're constantly resized with
`!important`/arbitrary-value overrides, and anything the system didn't
anticipate — a small text-only action, a delete link inside a list row — gets
reinvented from scratch, usually still on the pre-Fathom `rog-*` color
tokens.

### 4. Pills and chips

`.chip` is defined once: 34px pill, transparent, selected state is a **solid
ink fill**, deliberately not purple — "the accent is spent on the thing
you're reading, not on the filter you left switched on"
(`app/globals.css:1314-1354`). A separate, equally-valid `.segmented` /
`.segmented-option` exists for a different job (equal-width option groups —
testament tabs, yes/no toggles): square, accent-fill on selection. Both are
used correctly and consistently everywhere they appear
(`components/BookPicker.tsx:148,158`, `components/DepthTabs.tsx:37,46`,
`components/PreferencesForm.tsx:431,438`, `components/AdminFigureList.tsx:82,87,95`,
`components/ReferencePicker.tsx:277,285`).

The filter chips named in the brief are where it comes apart. Within the
Community screen *alone* there are three different chip treatments doing the
identical "which filter am I on" job:

- Bare 34px `.chip` — [components/CommunityFeed.tsx:154,158](components/CommunityFeed.tsx:154)
  (Everyone / My cohorts).
- `.chip` with a **44px height override** —
  [app/community/page.tsx:105](app/community/page.tsx:105) (the top-level
  People switcher), [components/LeaderboardView.tsx:123,131](components/LeaderboardView.tsx:123)
  (cohort filter), [components/HighlightsView.tsx:139](components/HighlightsView.tsx:139).
- A 40px mono variant, `.parallel-toggle` —
  [components/ParallelBible.tsx:458,506,518,527](components/ParallelBible.tsx:458).

And two places apply chip-pill styling to things that aren't filters at all:
`.chip` classes on a text `<input>` in
[components/HighlightsView.tsx:184](components/HighlightsView.tsx:184) and
[components/NotesView.tsx:164](components/NotesView.tsx:164) (search fields
styled as pill buttons), and a mono/uppercase 9.5px chip variant in
[components/ReadingHeader.tsx:131](components/ReadingHeader.tsx:131) and
[components/TranslationSwitcher.tsx:158](components/TranslationSwitcher.tsx:158)
that shares nothing visually with the base 13px sans chip.

**The clearest regression, twice over:** `.chip[data-on="true"]` is
explicitly ink-fill by design, but
[components/PrayerWall.tsx:315-318,356](components/PrayerWall.tsx:315) (the
Open/Answered tabs and the "I'm praying" toggle) and
[components/Nav.tsx:204-207](components/Nav.tsx:204) (the desktop nav's
own section pills) both hand-roll `bg-rog-purple text-white` for the selected
state — the exact "purple instead of ink" pattern the CSS comment names as
the wrong answer. **Confirmed live:** on the Prayer screen, the "Open" tab
renders as a solid purple pill while the identical-job Feed/Prayer/
Leaderboard/Finishers/Cohorts switcher directly above it, and the Everyone/
My-cohort filter on Leaderboard, both render the same "selected" state as
solid ink-black — the two conventions sitting one scroll apart on the same
screen, not a subtle code-only distinction. `components/ShareCardSheet.tsx`'s `.share-picker-chip`
selection state does the same thing with an accent-colored border/text
(`app/globals.css:1802`).

**Cohort filters**, named in the brief, don't actually exist —
`components/CohortsView.tsx` has no chip/filter row at all, only a "+New
cohort" button.

**Bench mode row / lens strip:** neither `.chip` nor `.segmented` — its own
third pattern, `.bench-tabs`/`.bench-tab`
([components/BenchLayer.tsx:1008-1037](components/BenchLayer.tsx:1008),
CSS at `app/globals.css:2229-2259`): square, mono 10px uppercase, selected
state marked with the same 2px sonar top rule the bottom tab bar uses. This
makes four different "row of selectable things" languages in the app —
`.chip` (pill/ink-fill), `.segmented-option` (square/accent-fill), `.tab-item`
(bottom nav/sonar rule), `.bench-tab` (its own class, sonar rule) — each
individually reasonable, collectively a lot for five screens to be doing the
same job five different ways. **Confirmed live:** opening the Bench on a
verse shows a "MODE" row (Sermon Prep / Word Study / Devotional /
Everything) and a "LENSES" row (Translations / Words / Exposition /
Cross Refs / …) right beneath it, both mono-uppercase with solid dark
selected pills — close to each other, but neither looks like the `.chip`
filters on Community two taps away, nor the Old/New Testament `.segmented`
toggle on the Bible tab.

**Majority pattern:** the base 34px `.chip` is right where it's used plain;
almost every screen that needs a *taller* or *differently-colored* filter row
invented its own variant instead of adjusting the shared class, and two
genuinely important screens (Prayer, the desktop nav) never adopted `.chip`
at all.

### 5. Headers

At least **six distinct header shapes** are in use, only two of which are
actually documented as intentionally different (the general app bar and the
reading header, which the CSS explicitly says share `.safe-top-bar` because
"both of them are sticky and both of them therefore have the same problem" —
`app/globals.css:434-453`):

1. **App bar + local `<h1>`** — `<Nav profile={profile}/>`
   ([components/Nav.tsx:244](components/Nav.tsx:244), the shared
   `.glass-nav.safe-top-bar` bar) followed by a page-owned heading, copied
   near-verbatim into 25 files. It's not a shared component, just a repeated
   string, and several instances drift for no evident reason — many
   admin/utility pages prefix it with an unexplained `mt-3`
   ([app/admin/notes/page.tsx:17](app/admin/notes/page.tsx:17),
   [app/admin/rhapsody/page.tsx:45](app/admin/rhapsody/page.tsx:45),
   [app/pulse/page.tsx:94](app/pulse/page.tsx:94),
   [app/notifications/page.tsx:92](app/notifications/page.tsx:92),
   [app/announcements/page.tsx:33](app/announcements/page.tsx:33),
   [app/cohorts/new/page.tsx:81](app/cohorts/new/page.tsx:81)) while
   `app/bible/page.tsx:22`, `app/community/page.tsx:81`,
   `app/preferences/page.tsx:28`, `app/sermons/page.tsx:72` don't.
2. **Title + back button** — `BackControl`
   ([components/BackControl.tsx](components/BackControl.tsx)), with two
   deliberate, documented variants (`chip` and `bare`) plus a third,
   `on-dark`, for the cohort invite hero
   ([app/c/[slug]/page.tsx:121](app/c/[slug]/page.tsx:121)). This one is
   genuinely consistent.
3. **The reading header** —
   [components/ReadingHeader.tsx:89](components/ReadingHeader.tsx:89)
   (`.reading-bar.safe-top-bar`). Intentional, and correctly shares the app
   bar's safe-area handling.
4. **The day view's own header** —
   [components/DayHeader.tsx:32](components/DayHeader.tsx:32): prev/next
   chevrons, a day-picker button, a conditional "back to today" pill, in a
   plain `mb-6 flex` row — not sticky, not using `.safe-top-bar` or any
   shared header class. Because `isReadingRoute()`
   ([lib/routes.ts:13](lib/routes.ts:13)) doesn't cover `/day/[n]`, this
   screen keeps the full `Nav` app bar **and** the bottom tab bar stacked
   *above* this second, home-grown header — two headers on one screen, a
   shape nothing else in the app has.
5. **The sermon reading header** — a third, undocumented one-off,
   [components/SermonReader.tsx:210](components/SermonReader.tsx:210)
   (`.sermon-read-head`, `app/globals.css:3874`): its own 3-column grid, not
   sticky, doesn't use `.safe-top-bar` or `.glass-nav` at all. Defensible on
   its own terms (a sermon being preached shouldn't have app chrome over it),
   but the spec only documents two shared chrome systems, and this is a
   third that shares nothing with either. **Confirmed live:** opening a
   saved sermon shows a small mono `BACK … DEEP WATERS … ⋮` strip that looks
   nothing like the app bar it replaces — no avatar, no Today/Bible/People
   tabs, a different typographic weight entirely.
6. **The admin/editor "back-at-the-bottom" pattern** —
   [components/SermonEditor.tsx:444](components/SermonEditor.tsx:444) puts
   its `BackControl` at the *foot* of the form rather than the top, unlike
   every other editor/admin screen.

Two real typography outliers reaching for shape (1) but missing the
responsive step: [app/me/edit/page.tsx:172,192](app/me/edit/page.tsx:172)
(`text-[27px]`, `-0.025em`, `leading-[1.14]`, no `md:` step) and
[app/private/[id]/page.tsx:109](app/private/[id]/page.tsx:109) (right at
28px, but missing `md:text-[34px]`).

**Majority pattern:** one real shared shape (app bar + ad hoc `<h1>`) copied
by hand into 25 files, plus two genuinely-documented exceptions (reading
header, BackControl), plus three more chrome systems (day view, sermon
reader, sermon editor) that nobody reconciled against either.

### 6. Footers and action bars

Better news here. `.bottom-glass` (the tab bar,
[components/BottomNav.tsx:80](components/BottomNav.tsx:80)), `.verse-bar`
(the verse toolbar, [components/VerseToolbar.tsx:126](components/VerseToolbar.tsx:126)),
and `.toast` (`app/globals.css:3035`) all correctly share the same
opaque-ground-plus-hairline language — no shadow, no blur, no floating pill,
anywhere. The one outlier is `.prefs-nudge`
([app/globals.css:3592](app/globals.css:3592)), which deliberately inverts to
a dark banner (`background: var(--text)`) rather than the light-ground
pattern every other bottom bar uses — a legitimate "this is different, it's
talking to you" choice, but it is the one bottom-pinned bar that doesn't
match its neighbors.

Route-level chrome hiding is done three separate ways rather than one:
`isReadingRoute()` ([lib/routes.ts:13](lib/routes.ts:13)) drives
`Nav`/`BottomNav` for `/read*` and `/bible/[book]/[chapter]`;
`data-surface="reading"` is set independently on `/day/[n]` and `/rhapsody`
but doesn't hide chrome there (it's a scroll/selection marker, not a
chrome flag — easy to conflate, and worth knowing they're not the same
switch); and the sermon reader hides `Nav` a third way, by simply never
rendering it. None of this is visibly broken today, but there's no single
place that answers "does this screen have chrome," which is exactly the kind
of thing that quietly breaks the next time someone adds a screen.

### 7. Sheets, modals and pickers

There is one real, consistent **visual shape** — bottom sheet, square
corners, `.sheet-backdrop` at a flat `rgba(6,5,12,0.6)` with no blur, a
`.sheet` panel with a hairline top border and a hand-drawn grabber pill — and
it's followed correctly by six different components:
[components/ReferencePicker.tsx:212-233](components/ReferencePicker.tsx:212),
[components/TranslationSwitcher.tsx:170-194](components/TranslationSwitcher.tsx:170),
[components/DayPicker.tsx:61-83](components/DayPicker.tsx:61),
[components/MoreSheet.tsx:173-204](components/MoreSheet.tsx:173),
[components/CompareSheet.tsx:112-138](components/CompareSheet.tsx:112),
[components/VerseNoteSheet.tsx:56-86](components/VerseNoteSheet.tsx:56).
**Confirmed live** on the More sheet: dim flat backdrop, square panel,
hand-drawn grabber, every row in sentence case — matches the spec exactly.

The catch: it's not **one shared component**. All six independently
hand-copy the same ~15 lines of backdrop+panel+grabber JSX. A real shared
primitive already exists —
[components/SelectSheet.tsx:103-142](components/SelectSheet.tsx:103), used
correctly elsewhere for form selects — but none of the six sheets above
import it, and it's missing the grabber pill the other six all add by hand.
`.verse-sheet`, the CSS class the design system defines specifically for the
verse-grid picker (`app/globals.css:1462-1472`), is dead code — no component
actually references it; the verse grid (step 3 of `ReferencePicker`) uses
`.sheet` instead.

Three real outliers, worst first:

- **`components/ShareCardSheet.tsx:212-224`** — its panel isn't `.sheet` at
  all, it's a custom `.share-sheet` class that doesn't exist anywhere in
  `globals.css`, so its position/background/max-height (92vh, vs. 85vh/80vh
  everywhere else) are all duplicated by hand as inline styles. No grabber,
  no title heading, a literal "Cancel" button styled with an unrelated class
  (`chapter-pager-prev`), and — because it returns `null` when closed instead
  of translating a persistently-mounted panel like every other sheet — it
  can't animate open or closed at all.
- **`components/PhotoCropper.tsx:37-38`** — centered, not a bottom sheet;
  backdrop is a plain `bg-black/70`, not `.sheet-backdrop`'s themed color; the
  panel is hardcoded `bg-white`, so it ignores dark mode entirely.
- **`components/VerseToolbar.tsx:126-133`** — not really a sheet at all, a
  persistently-mounted bar with no backdrop/scrim, which is by design, but
  worth naming as its own category rather than a variant of the others.

`components/BookPicker.tsx` and `components/NoteEditor.tsx`, both named in
the brief, turned out not to be sheets on inspection — they're plain page
content with no backdrop or open/close state.

**Majority pattern:** one real shape, reimplemented six times instead of
shared once, plus one genuinely different modal (photo cropper), one that
skipped the system's own CSS classes for reasons that aren't visible in the
code (share sheet), and one dead CSS class nobody's using.

### 8. List rows

`.card-list > .card` exists specifically to turn "a stack of things people
wrote" into one hairline-separated list instead of a stack of boxes
(`app/globals.css:362-371`). It's used correctly in exactly the place its own
comment names as the example —
[components/CommunityFeed.tsx:178](components/CommunityFeed.tsx:178) wrapping
`ReflectionCard`. `.mark-list`/`.mark-row` (highlights/notes) and `.read-row`
(the reading plan) are the other two purpose-built row systems, and both are
followed exactly:
[components/HighlightsView.tsx:204,208](components/HighlightsView.tsx:204),
[components/NotesView.tsx:176,181](components/NotesView.tsx:176),
[app/day/[n]/page.tsx:249-283](app/day/[n]/page.tsx:249).

Everywhere else, the majority pattern is actually a **different, unlabeled
pattern**: a boxed `.card` inside a `space-y-*`/`gap-*` wrapper — i.e., "a
stack of separate boxes," precisely what `.card-list`'s own comment says a
list of authored content should stop being:

- [components/PrayerWall.tsx:323,337](components/PrayerWall.tsx:323) — even
  though the CSS comment names "a prayer list" by name as a `.card-list` use
  case.
- [components/CohortsView.tsx:57,80](components/CohortsView.tsx:57) —
  **confirmed live**: the two cohort cards on screen sit as separate boxed
  plates with visible daylight between them, each carrying its own "VIEW →"
  in tracked uppercase mono — exactly the retired label style, in exactly
  the row that also skips `.card-list`.
- [app/notifications/page.tsx:101,111](app/notifications/page.tsx:101) —
  **confirmed live**: same boxed-plate-with-gap shape, distinctly different
  from the admin user list one section over, which is genuinely one
  hairline-separated list.
- [components/LeaderboardView.tsx:155,164](components/LeaderboardView.tsx:155)
- [app/admin/reports/page.tsx:117,124](app/admin/reports/page.tsx:117)
- [app/admin/testimonials/page.tsx:24,31](app/admin/testimonials/page.tsx:24)

**Admin rows specifically are not internally consistent.**
`AdminPersonRow`/`AdminUserRow`/`AdminMemberRow` correctly share a dedicated
grid row system, `.admin-row` (`app/globals.css:3660-3730`), and
`AdminFigureList.tsx:155` hand-duplicates the same markup rather than reusing
the shared component (a maintenance smell, not a visual one — it looks
right, it just isn't shared). But `app/admin/reports/page.tsx` and
`app/admin/testimonials/page.tsx` don't use `.admin-row` at all — they use
the boxed-`.card` idiom above. So "admin" is at least two competing row
languages, plus a third, unrelated use of `.card` as day-tiles/stat-tiles in
the admin dashboard itself.

**Labels:** four stray uppercase-tracked labels turned up in exactly the
components that also skip `.card-list` —
[components/CohortsView.tsx:96](components/CohortsView.tsx:96) ("View →"),
[components/PrayerWall.tsx:349](components/PrayerWall.tsx:349) ("Testimony"),
[app/admin/reports/page.tsx:126](app/admin/reports/page.tsx:126),
[app/admin/testimonials/page.tsx:34](app/admin/testimonials/page.tsx:34)
(status badges) — all plain labels set the way the CSS comment says the old
"kicker" style was deliberately retired (see §9 below). The two regressions
cluster in the same files, which is itself informative: whatever touched
Prayer, Cohorts, and admin/reports last did both at once, off the current
system.

**Majority pattern:** the three purpose-built row systems are followed
exactly wherever the row's job matches one of the three named use cases
(feed, highlights/notes, reading plan). Every other list in the app —
prayer, cohorts, notifications, leaderboard, two of five admin lists — uses
an unlabeled "boxed card in a gapped stack" pattern instead, which reads as a
stack of objects rather than one list, and is the single largest, most
consistent divergence found in this audit.

### 9. Labels — mono/small-caps vs. sentence case

The system used to set all metadata in uppercase, tracked small caps (the
CSS calls this "kicker") and deliberately retired it — the comment above
`.meta` narrates the reasoning at length: it measured well for contrast but
"promoted the quietest thing in the system into the loudest," and "a column
of tracked caps at full contrast is the house style this design set out to
leave behind" (`app/globals.css:484-498`). The replacement, `.meta`, is mono
and small but set in whatever case it was written in — sentence case for
prose-adjacent labels, not shouted.

A short, named list of exceptions still uses the old uppercase-tracked
treatment deliberately: `.tab-label` (bottom nav), `.chapter-mark` (scripture
apparatus), `.reference-jump-label`, `.kept-chip`. All four are chrome or
scripture apparatus, not body labels.

Outside that named list, four plain labels still use the retired treatment,
and all four sit in the same files flagged in §8 for skipping `.card-list`:
[components/CohortsView.tsx:96](components/CohortsView.tsx:96),
[components/PrayerWall.tsx:349](components/PrayerWall.tsx:349),
[app/admin/reports/page.tsx:126](app/admin/reports/page.tsx:126),
[app/admin/testimonials/page.tsx:34](app/admin/testimonials/page.tsx:34).

**Majority pattern:** `.meta` (mono, sentence case) everywhere the system was
actually touched during the states/kicker-retirement pass; the four
exceptions above are leftover from before that pass, in exactly the corners
that also missed the list-row consolidation.

### 10. Empty, loading and error states

This is the one category where the system-wide passes clearly held. It's
also the category where the brief's own prediction — "these are usually the
least consistent part of any app because they're written last" — turns out
to be wrong for this app specifically, because someone wrote a dedicated
pass for exactly this ("the states pass," `39ab08f`).

**Loading.** The spec is a 1px sonar rule that fades in after a 200ms delay
(so nothing flashes on a fast load), no spinners, no skeletons
(`app/globals.css:2967-3000`). `components/LoadingRule.tsx` is the one
shared implementation, and it's used correctly, verbatim, in at least ten
places: the three route-level `loading.tsx` files
([app/bible/loading.tsx:17](app/bible/loading.tsx:17),
[app/bible/[book]/loading.tsx:17](app/bible/[book]/loading.tsx:17),
[app/today/loading.tsx:17](app/today/loading.tsx:17)), the reading-specific
wrapper `components/ReadingLoading.tsx`, and inline in
`components/CommunityFeed.tsx:180`, `PrayerWall.tsx:325`,
`LeaderboardView.tsx:157`, `FinishersView.tsx:50`, `CohortsView.tsx:59`,
`app/notifications/page.tsx:103`, `components/OfflineShell.tsx:484`.

Two places didn't get the memo:
[components/ReaderPane.tsx:270-273](components/ReaderPane.tsx:270) hand-rolls
a plain `<p role="status">Loading {book} {chapter}…</p>` for a chapter
re-fetch inside the parallel/compare reading pane — no sonar rule, no
delay-gate — even though the sibling screen one route up
(`ReadingLoading`) does the same job correctly. And
[app/onboarding/page.tsx:287](app/onboarding/page.tsx:287) still has the
literal string `"Loading..."` in a centered full-screen `<div>` — the single
remaining occurrence of that phrase anywhere in the codebase (confirmed by a
whole-tree grep). `app/sermons/page.tsx`, a server component, has no loading
treatment at all — of every list screen in the app, it's the only one that
shows nothing while its data is in flight.

**Empty.** The spec (`app/globals.css:3001-3021`, `.empty`) is explicit and
narrow: left-aligned, not centered; one short line of body prose; no
illustration, no centered icon. Roughly 30 call sites get this exactly
right — `CommunityFeed.tsx:182` ("Nothing shared yet."),
`PrayerWall.tsx:327`, `LeaderboardView.tsx:159`, `FinishersView.tsx:52`,
`CohortsView.tsx:61`, `app/notifications/page.tsx:105`,
`app/admin/reports/page.tsx:119`, `app/admin/users/page.tsx:54`,
`app/admin/testimonials/page.tsx:26`, `AdminFigureList.tsx:149`,
`app/sermons/page.tsx:85`, `BookPicker.tsx:180`, `PulseCheckOn.tsx:34`, and
more — all sharing the same voice (short, imperative, no exclamation marks)
as well as the same markup.

Two scoped variants exist deliberately alongside it rather than instead of
it: `.bench-empty` (mono, 11.5px, no padding — used 27 times inside dense
Bench lens panes) and `.sermon-pick-empty` (used only in
`components/BenchSermonPicker.tsx`). Both are reasonable for their much
denser contexts, but it means "empty" now has three unrelated typographic
treatments depending which surface you're on.

**Error / not-found.** The real outlier here is
[components/CohortGone.tsx](components/CohortGone.tsx) — the cohort
not-found screen breaks from `.empty`'s left-aligned, inline convention
entirely: `min-h-screen flex items-center justify-center`, a 28-34px heading,
serif body copy, a centered button row. It's the single largest visual
outlier in this whole audit — every other "nothing here" moment in the app
is a small left-aligned line inside a list; this one is a centered
full-viewport hero. Toasts (`.toast`, save/progress confirmations on the
reading surface) are consistent everywhere they're used
(`ChapterPager.tsx:271`, `ParallelBible.tsx:566`, `DevotionalReader.tsx:705`,
`ScriptureReader.tsx:1259`, `PreferencesForm.tsx:380`) — no outliers found
there. Inline fetch-error text is less disciplined: the majority pattern is
a bare `<p className="text-danger">{error}</p>` above the list
(`CommunityFeed`, `CohortsView`, `LeaderboardView`, `FinishersView`,
`app/admin/reports/page.tsx:110`) rather than folding into `.empty` the way
`ChapterView.tsx:147`/`ReaderPane.tsx:273` do — so "empty because there's
nothing" and "empty because the fetch failed" get two different treatments
depending which screen you're on.

**Majority pattern:** loading and empty states are, credibly, the most
consistent category in the app — a direct result of the dedicated pass that
targeted them by name. The exceptions (the onboarding spinner-text, the
ReaderPane hand-rolled loader, the sermons list's missing loading state, and
CohortGone's centered hero) are small in number and easy to name precisely,
which is unusual for this category and worth knowing going in.

### 11. Icons

The app's own comments describe a single hand-built icon vocabulary, and in
practice there are **four uncoordinated ones**:

1. **The real system** — `components/icons.tsx`, five icons (today / bible /
   people / depth / more), viewBox 16, `strokeWidth="1.25"`, no fills except
   two small deliberate accents. This is well-specified and consistently
   used — but only for the tab bar and the More sheet
   (its sole consumers, via `lib/nav.tsx`).
2. **A CSS rule with nothing rendering into it** — `.act svg` (14px,
   stroke-width 1.7, `app/globals.css:1368`) is defined for the
   amen/reply/report row under community content, but
   [components/ReflectionCard.tsx:219,225](components/ReflectionCard.tsx:219)
   renders those as plain text (`<span>Amen 3</span>`) — no icon at all,
   anywhere in the codebase, uses this rule. The documented icon treatment
   for one of the app's most-used interactions simply isn't there.
3. **Two independent, hand-drawn kebab menus** that don't share a size or a
   philosophy with `icons.tsx` or each other:
   [components/AdminPersonRow.tsx:126](components/AdminPersonRow.tsx:126)
   (18px, 1.6px-radius filled dots) and
   [components/SermonReader.tsx:237](components/SermonReader.tsx:237) (20px,
   1.7px-radius filled dots) — both filled rather than stroked, directly
   against `icons.tsx`'s own "no fills, drawn not set" header comment.
4. **Unicode glyphs standing in for icons** — chevrons and arrows rendered as
   literal text characters rather than SVG: `ChapterPager.tsx:266` (`→`/`✓`),
   `CohortsView.tsx:97` ("View →"), `.reference-jump-arrow`
   (`&rarr;`), `.reading-caret` (`app/globals.css:1613`, a 13px text glyph
   used in `ReaderPane.tsx:202` and `ReadingHeader.tsx:156`). Internally
   consistent as a family, but it means "the little arrow that means go" is
   sometimes an SVG and sometimes a character, with no rule for which.

No icon library is installed (`package.json` has no `lucide-react`,
`heroicons`, or `react-icons`), so this isn't "two systems fighting" — it's
one well-made system that only ever got applied to the tab bar, plus three
more ad hoc solutions invented separately as new screens needed an icon and
didn't reuse `icons.tsx`'s pattern.

**Majority pattern:** there is no majority — the tab bar is the only place
with a real, consistent icon system; everywhere else that needs a small
mark, one gets invented on the spot.

### 12. Destructive actions

Color is solved. Confirmation is not. Thirteen destructive controls were
checked; eleven correctly use `.btn-danger` or `.text-danger`, and the
specific anti-pattern the CSS comment names by name — `.btn-secondary`
paired with a raw `text-red-*` override — has been fully eliminated from the
codebase; a whole-tree grep for raw `text-red-*`/`bg-red-*`/`border-red-*`
turns up nothing.

But three different confirmation behaviors coexist with no visible rule for
which action gets which:

| Control | Styling | Confirmation |
|---|---|---|
| Reset my activity ([ResetMyData.tsx:78](components/ResetMyData.tsx:78)) | `.btn-danger` | Two-step inline "are you sure?" |
| Delete cohort ([CohortSettingsForm.tsx:147](components/CohortSettingsForm.tsx:147)) | `.btn-danger` | Two-step inline |
| Remove user / delete admin user, sermon, rhapsody edition | token-correct | native `window.confirm()` |
| Delete testimonial ([TestimonialAdminControls.tsx:38](components/TestimonialAdminControls.tsx:38)) | `text-danger px-2` | **none — fires immediately** |
| Delete prayer, reflection comment, verse note | `text-rog-muted hover:text-danger` (danger color only appears on hover) | **none — fires immediately** |
| Delete devotional note ([DevotionalReader.tsx:806](components/DevotionalReader.tsx:806)) | inline `style={{color:"var(--danger)"}}`, bypassing both `.btn-danger` and `.text-danger` | none |

So a full account data reset gets a two-step confirmation and a visually
serious button, while deleting someone else's testimonial, prayer, comment,
or note fires on a single tap with a control that, at rest, doesn't even
look red. That's a real inconsistency in how "are you sure" is handled, not
just in how red is applied — flagging it here since the brief asked whether
destructive actions are "treated the same way everywhere," and behavior is
part of that even on an otherwise style-focused pass.

Two clear miscolorings:

- [components/OfflineDownload.tsx:148,164](components/OfflineDownload.tsx:148) —
  the confirmed action of a local-data-wipe flow ("Delete it") is styled
  `.btn-primary`, not `.btn-danger`. It has a two-step confirm panel, so
  behaviorally it's careful — visually, it looks exactly like "Save" or
  "Continue."
- [components/PrayerWall.tsx:348](components/PrayerWall.tsx:348) — the
  "Testimony" (answered-prayer) callout uses raw `bg-white border
  border-green-200`, not the `--success`/`--success-soft` tokens used one
  line above it for the identical concept. This is the one place in the
  entire codebase where the raw-Tailwind-color regression the CSS comments
  warn about still exists, just in green rather than red.

**Majority pattern:** destructive controls are colored correctly almost
everywhere; they are not gated consistently, and the one clearly-miscolored
control (OfflineDownload) is arguably the single highest-stakes action in
the app to have styled wrong, since it destroys the user's local data.

### 13. Tap targets

The system's compensation pattern (`.tap-target::after`, `.chip::after`,
per-class `min-height`/`min-width`) is applied correctly almost everywhere
it's needed: `Nav.tsx`'s bell/avatar, `DayHeader.tsx`'s prev/next,
`ThemeToggle.tsx`, `AdminPersonRow.tsx`'s overflow button, every `.chip`/
`.act`/`.verse-action`/`.hl-swatch`/chapter-pager control. Two clear misses:

- [components/DayPicker.tsx:101-114](components/DayPicker.tsx:101) — the
  90-day picker grid renders each day as `aspect-square` inside a
  `grid-cols-10` layout with no `min-height`/`min-width`/`.tap-target`
  anywhere, which works out to roughly 34–38px square on a typical sheet
  width — under the 44px floor. Its structural twin, the Bible chapter grid,
  solves the exact same "small square number in a dense grid" problem
  correctly via `.chapter-tile { min-height: 44px; min-width: 44px }`
  ([app/globals.css:1157](app/globals.css:1157),
  [components/ChapterGrid.tsx:113](components/ChapterGrid.tsx:113)) — the
  fix already exists in the codebase, it just wasn't reused here.
- [components/VerseToolbar.tsx:141-148](components/VerseToolbar.tsx:141) —
  the Bench's "second tap to close" grab handle
  (`.verse-grab { min-height: 24px; padding: 4px 0 8px }`,
  `app/globals.css:1979`) comes out to roughly 36px tall, under the floor,
  with no vertical compensation (it's full-width, so only the horizontal
  axis is safe).

**Majority pattern:** tap-target compensation is a well-understood, well
-applied pattern in this codebase — these two are narrow, nameable
exceptions rather than a systemic gap, and one of them has a working
reference implementation two components away.

---

## The shape of the problem

Your guess is right, but the git history makes it more specific than "every
feature was its own pass." This app didn't drift continuously from one
baseline — it went through **several real, system-wide consistency passes**,
each of which genuinely reached every screen that existed at the time:

- `89631c2` **"Fathom: new design system"** — the rebrand itself.
- `670a388`–`b1dbc2a` **"Move 1" through "Move 6," then "the Roll"** —
  typography, elevation, buttons, the seven-step spacing scale, the one
  accent color, state legibility, applied "across every remaining surface."
- `f6d609d` **"Retire .kicker, square the rank badge"** — the uppercase
  small-caps retirement documented in §9.
- `39ab08f` **"The states pass: loading, empty, error, focus, toasts,
  sheets, controls"** — a dedicated system-wide sweep of exactly the
  categories this audit covers.
- `c242c11` **"The last emoji leave, and the icons become one vocabulary"** —
  an icon consolidation pass.

Everything built **before** these passes landed is, unsurprisingly, the most
conformant code in the app: the reading surface, the tab bar, `CommunityFeed`,
`HighlightsView`/`NotesView`, the day-reading rows, `SelectSheet`. These
screens were standing when the sweeps happened, so they got swept.

Everything built **after** the last relevant pass is where the divergence
concentrates, because there hasn't been a second sweep since. In
chronological order, the features that shipped after "the states pass" and
"the icon pass" are: Deep Waters Elite / the Bench (`51bd520` onward), Church
Pulse (`37f2f03`), the sermon workspace (`e72a55f`, `32c8243`), two Bibles
side by side (`bf71ceb`), and a long tail of cohort/admin/prayer polish. Cross
-reference that list against this audit's findings and it lines up almost
exactly: the Bench invented its own third "row of tabs" language
(`.bench-tab`) because the chip/segmented system already existed before it
was built but nobody reached for it; the sermon reader and sermon editor each
invented their own header because the reading-header pattern predates them
but wasn't reused; Prayer, Cohorts, Notifications, and two of five admin list
pages never adopted `.card-list` because they were written (or last
substantially touched) independently of the row-consolidation work; the
desktop nav and several quiet/destructive buttons are still on the
pre-Fathom `rog-*` color tokens because nobody had a reason to revisit them
once they worked.

There is a second, smaller pattern layered on top: even inside code that
*does* reach for the right class, the class gets resized with `!important`
and arbitrary-value overrides — `.btn-primary text-xs px-4 py-2`,
`.chip !min-h-[44px]` — because the exact size needed for a given spot wasn't
quite what the shared class gives, and the fix each time was a local
override instead of a second variant on the class itself. This is a
different failure mode from the first one (it's not "skipped the system," it's
"reached for the system and then fought it") and the fix looks different too —
see Tier 1 below.

So: not one continuous drift, and not "every screen for itself" — a system
that was correctly, repeatedly reconciled, followed by a growing set of real
features that each shipped as its own vertical slice with no reconciliation
pass since. The corners that need the most work are exactly the newest,
highest-value ones: the Bench, Pulse, Prayer, Cohorts, and admin.

---

## Part 2 — Proposed fix, in tiers

Tiers are ordered by how much a user would feel the change, not by how much
work each one is — some low-feel tiers are genuinely quick, some are not.
Every tier is a consolidation: one shared thing replacing several
lookalikes, not several lookalikes restyled to match. Nothing here should be
started without your go-ahead, and tiers are meant to be committed and
revert-able independently, per your instruction.

### Tier 0 — Fix regardless of what else you choose · ✅ done (2026-09-13)

Two items were miscolored in a way that's a correctness risk, not just a
consistency one:

- [components/OfflineDownload.tsx:164](components/OfflineDownload.tsx:164) —
  the confirmed step of a local-data-wipe was `.btn-primary`; now
  `.btn-danger`.
- [components/PrayerWall.tsx:348](components/PrayerWall.tsx:348) — raw
  `border-green-200`/`bg-white` is now `border-[var(--success)]`/
  `bg-[var(--success-soft)]`, the same tokens already used one line below
  for the identical concept.

Both are pure color swaps — no layout or behavior change. Type-checked
clean (`tsc --noEmit`); the dev server recompiled with no errors. The
`OfflineDownload` delete flow needs the offline Bible actually downloaded to
reach visually (a service-worker-gated state I couldn't force in this
session), so that one is confirmed by the diff and the type-check rather
than a screenshot; the PrayerWall change has no live "answered + testimony"
prayer to screenshot against right now either, for the same reason —
neither carries any risk beyond a class name, so I didn't manufacture test
data in your database to force a screenshot.

### Tier 1 — Invisible to a user, but the seam that reopens every other fix · ✅ done (2026-09-13)

Added the missing size variants to `app/globals.css`, right after their
base classes, as pure additions — nothing existing was touched, so no
button or chip anywhere in the app looks any different yet:

- **`.btn-sm`** (`app/globals.css:954`) — compose with `.btn-primary`,
  `.btn-secondary`, or `.btn-danger` (e.g. `className="btn-primary
  btn-sm"`) for the smaller size that a dozen-plus places were reaching for
  with a one-off `!important` override.
- **`.btn-quiet`** (`app/globals.css:966`) — the "quiet action" shape Tier 2
  needs to move `TestimonialAdminControls`, `ReportButton`, and
  `PrayerWall`'s bare-text destructive/quiet actions onto; guarantees the
  44px tap target the four existing one-offs don't all have. Colour still
  comes from a utility laid on top (`.text-danger`, `.meta`, etc.).
- **`.chip-tall`** (`app/globals.css:1388`) — 44px-tall `.chip`, for the
  `!min-h-[44px]` overrides on Community's People switcher, Leaderboard's
  cohort filter, and Highlights' colour filter.
- **`.chip-mono`** (`app/globals.css:1395`) — the mono/uppercase/tracked
  chip variant `ReadingHeader` and `TranslationSwitcher` were building by
  hand.

Deliberately left the existing override call sites untouched, as scoped —
this tier was additive only, so Tier 2/3 can migrate onto these classes
opportunistically as each screen is touched, rather than bundling a dozen
JSX edits into one low-visibility commit. Type-checked clean.

### Tier 2 — Low risk, high hit-rate · ✅ done (2026-09-13)

Everything in §8 and §9 that never touches the reading surface, the Bench,
or anything a user would call "the app working":

- Moved Prayer, Cohorts, Notifications, Leaderboard, and the two straggling
  admin list pages (`app/admin/reports`, `app/admin/testimonials`) onto
  `.card-list` instead of boxed `.card` + gap. Notifications needed a small
  restructure beyond a class rename — its `.card` div was nested a level
  inside the `<Link>` rather than being the sheet's direct child, which
  `.card-list > .card` requires, so the card classes moved onto the `Link`/
  `div` itself.
- Consolidated `AdminFigureList.tsx`'s hand-duplicated row markup onto
  `AdminPersonRow` — confirmed live at `/admin/figures/completions-today`,
  pixel-identical to the admin user list that already used the shared
  component.
- Fixed all four stray uppercase-tracked labels (§9) to `.meta` sentence
  case: Cohorts' "View →", Prayer's "Testimony", the admin reports
  target-type line, and the admin testimonials status badges.
- Routed `TestimonialAdminControls.tsx`'s bare-text Delete through
  `.btn-quiet text-danger` (the class Tier 1 added). Left its Approve/
  Unapprove/Feature buttons' own size overrides untouched — those weren't
  part of what this tier promised, and touching them wasn't necessary to
  fix the one thing that was.

Type-checked and linted clean across the full project. Confirmed live:
Cohorts, Notifications (including the subtle hairline — visible on zoom,
correctly quiet at normal size), and Leaderboard all now read as one list
instead of a stack of boxes. Admin reports/testimonials and the Prayer
testimony callout have no current data to screenshot against (empty
tables), so those two rest on the type-check plus the identical, already-
verified pattern used elsewhere — I didn't create test rows in your
database just to force a screenshot.

**Cost:** moderate — touches eight files, but each is a swap of wrapper
markup, not a rewrite of behavior. **Risk: low.** These lists have no
complex interaction state; a broken row here is visually obvious immediately
and easy to catch in review.

### Tier 3 — Medium risk, most visible

- **One shared sheet component.** Extend `SelectSheet` (already the closest
  thing to canonical, already used elsewhere) with the grabber pill the
  other six sheets add by hand, then move `ReferencePicker`,
  `TranslationSwitcher`, `DayPicker`, `MoreSheet`, `CompareSheet`, and
  `VerseNoteSheet` onto it instead of each hand-copying the same ~15 lines.
  Bring `ShareCardSheet` in line with the shape at the same time (real
  `.sheet-backdrop`/`.sheet`, a real title, a mount/unmount that can
  animate) since it's the furthest outlier and the most visible one (it's
  the share flow).
- **One shared page-header component**, replacing the 25-file copy-pasted
  `<h1 className="text-[28px] md:text-[34px] font-semibold …">` string, so
  the next screen gets it by import instead of by copy-paste-and-hope.
- Fix the two clear tap-target misses (`DayPicker`'s day grid, using the
  same fix `.chapter-tile` already applies two components away; the Bench's
  `.verse-grab` handle).

**Cost:** real, but bounded — six sheets and ~25 header call sites, each a
mechanical swap once the shared component exists. **Risk: medium.** These
are touched on nearly every screen, so a regression is maximally visible —
this is the tier to go slowest on, with the most manual testing, and to
ship as its own commit separate from Tier 2's lower-stakes changes.

### Tier 4 — Higher risk, deliberately last

- Reconcile the four "row of selectable things" languages (§4): `.chip`,
  `.segmented-option`, `.tab-item`, `.bench-tab`. Not all four need to
  become one — `.tab-item`'s sonar-rule language is arguably right for
  chrome and `.bench-tab` copied it on purpose — but Prayer's and the
  desktop nav's purple-fill selected states (a direct, named regression
  against the ink-fill rule) should move onto `.chip` itself.
- Reconcile the Bench/sermon workspace's bespoke headers
  (`.sermon-read-head`, the day view's stacked double-header) against the
  shared header component from Tier 3, once that component exists and has
  proven itself on lower-stakes screens.
- Decide on one confirmation rule for destructive actions (§12) — right now
  three coexist (two-step inline, native `confirm()`, none) with no visible
  logic for which action gets which. This is a judgment call, not a style
  fix, and belongs to you: which destructive actions are serious enough to
  gate, and with which mechanism.
- Icons (§11): decide whether the two hand-drawn kebab menus adopt
  `icons.tsx`'s vocabulary, and what — if anything — renders into the
  `.act svg` rule that currently has no icon behind it.

**Cost:** the most spread out — touches the newest, most actively-developed
surfaces (Bench, Pulse, sermons), which are also the ones you specifically
asked to be careful with. **Risk: real.** This is the tier where "is this
actually the same job, or does it only look similar" needs a real answer
before merging anything, and where I'd want your sign-off screen-by-screen
rather than tier-by-tier.

### What's explicitly out of scope, per your rules

No behavior changes, no new dependencies, no copy changes (casing
corrections in Tier 2 excepted, since that's a labeling convention, not
copy), and nothing that touches the reading surface's actual mechanics, the
parallel Bible, the adjustable divider, or the safe-area fixes — Tier 3's
shared header adopts the *shape* already used by 25 screens, it doesn't
change what the reading header or `DayHeader` themselves do. Each tier
commits on its own, so a bad one reverts without touching the others.
