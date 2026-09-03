# Deep Waters

A 90 day Bible reading plan web app. Old Testament + New Testament every day, KJV, community reflections, live leaderboard, finisher wall, and auto-generated share cards.

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (auth, Postgres, storage, realtime)
- Tailwind CSS
- @vercel/og for share card generation
- API.Bible for KJV chapter text

## Setup (about 30 minutes total)

### 1. Install locally

```bash
npm install
cp .env.local.example .env.local
```

### 2. Create a Supabase project

1. Go to https://supabase.com and create a free account.
2. New project. Name it `deep-waters`. Pick a region close to you (London for UK).
3. Save the database password somewhere safe.
4. Once ready, go to Project Settings → API. Copy:
   - `Project URL` → paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - `anon public` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → paste as `SUPABASE_SERVICE_ROLE_KEY`

### 3. Run the schema

**Fresh project:**
1. In Supabase, open the SQL Editor (left sidebar).
2. Open `supabase/schema.sql`, copy the whole thing, paste into the editor, Run.

**Upgrading from an earlier version (you already ran the old schema):**
1. Run `supabase/migrate_v1_to_v2.sql` first.
2. Then run `supabase/schema.sql`.

### 3b. Make yourself admin

After you've signed up once, run this in the SQL Editor (replace the email):

```sql
update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'you@example.com');
```

Sign out and back in. You'll see **Admin** in the nav.

### 4. Get a free API.Bible key

1. Go to https://scripture.api.bible/ and sign up.
2. Create an app. Free tier gives 5000 requests/day.
3. Copy your API key → paste as `API_BIBLE_KEY` in `.env.local`.

### 5. Configure auth email

By default Supabase sends magic-link emails from its own domain. That works, but for production set up a custom SMTP:
- In Supabase: Authentication → Email Templates → check the copy is right.
- (Optional) Authentication → SMTP Settings → connect your own SMTP for branded emails.

### 6. Set the site URL

In Supabase: Authentication → URL Configuration:
- Site URL: `http://localhost:3000` for dev
- Redirect URLs: add `http://localhost:3000/auth/callback` and later your production `https://yourdomain.com/auth/callback`

### 7. Run it

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this project to a GitHub repo.
2. Go to https://vercel.com and import the repo.
3. Add all env vars from `.env.local` to Vercel project settings.
4. Deploy.
5. Update `NEXT_PUBLIC_SITE_URL` and Supabase Auth URLs to your Vercel domain.

## Cohorts

A cohort is a group of people starting Deep Waters on the same day.

- Any signed-in user can create one at `/cohorts/new`.
- They get a shareable link: `yourdomain.com/c/august-2026`.
- Anyone visiting that link can join. Their start date is set automatically to the cohort's start date.
- Leaderboard and Community feed have filter buttons: **Everyone**, **My cohort**, or pick a specific cohort from the dropdown.

Use cohorts to run named groups (e.g. "BLW Luton July 2026", "Youth Church Cohort", "Family Circle").

## The reading plan

Baked into `lib/plan.ts`. OT + NT interleaved: roughly 10 OT chapters + 3 NT chapters per day. Both streams finish on day 90. Everyone reading in sync based on their `start_date`.

## Branding

Colors and fonts live in `tailwind.config.ts`. Logo is `public/logo.png` (replace with a higher-res version any time). Font is Poppins from Google Fonts.

## Extending

- **More cohorts**: users pick their own start date. Cohorts happen naturally.
- **Different translations**: swap `KJV_BIBLE_ID` in `lib/bible.ts` for another Bible ID from API.Bible.
- **Push notifications**: add web-push or wire up OneSignal.
- **Admin dashboard**: build a `/admin` route protected by a role check.

## Troubleshooting

- **Magic link doesn't arrive**: check Supabase Auth logs. Check spam folder.
- **Bible text not loading**: check `API_BIBLE_KEY` is set and API.Bible dashboard shows requests.
- **Share card fails**: check the profile photo URL is publicly accessible (Supabase storage bucket must be public).
- **Leaderboard not updating live**: check the realtime publication was created (schema.sql runs it).
