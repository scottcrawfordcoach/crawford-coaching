# Auth Foundation — Setup Checklist

Everything in this folder ships the front-end side of Phase 1 auth. To make it live, three things have to happen outside the repo: the Supabase schema migration, the Supabase Auth configuration, and the Vercel env vars.

The order below is the order that won't leave the site half-broken.

---

## 1. Apply the SQL migration

File: `migrations/2026-05-auth-foundation.sql`

Open the Supabase SQL editor on the project that owns the `contacts` table (`yxndmpwqvdatkujcukdv`) and run the whole file. It is idempotent — safe to re-run.

What it does:

- Adds `auth_user_id` (FK to `auth.users`, unique when set) to `contacts`.
- Adds `tier` (`public` / `email_captured` / `subscriber` / `client`, default `public`) to `contacts`.
- Adds boolean active-status flags: `synergize_active`, `coaching_active`, `whole_active`, `growth_zone_subscribed`, `whole_alumni_claimed`, `whole_alumni_claim_date`.
- Creates a trigger on `auth.users` INSERT that links the new auth user to the existing `contacts` row by email (or inserts a minimal contact at tier `public` if no row exists).
- Enables RLS on `contacts` with one policy: authenticated users can SELECT their own row only. All writes still go through service-role via `data-handler`.

After running, sanity-check with:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'contacts'
order by ordinal_position;
```

And confirm the trigger exists:

```sql
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;
```

---

## 2. Flip the active-status flags for existing Synergize members

Synergize members will be the first live auth users. Their `contacts` rows need `synergize_active = true` so the gate on `/synergize/members` lets them in.

This is a one-time backfill from whatever you currently use to track active billing. Once Stripe (or the existing billing source) is wired to data-handler in a future phase, those flips happen automatically.

For now, run something like:

```sql
update public.contacts
   set synergize_active = true
 where email = lower('member@example.com');
```

The same column also drives the email-gated Growth Zone auto-unlock described in spec v1.3 §3.5.

---

## 3. Configure Supabase Auth

In the Supabase dashboard, project `yxndmpwqvdatkujcukdv`:

- **Authentication → Providers → Email**: enable. Disable password sign-in (we are magic-link only). Enable "Confirm email".
- **Authentication → URL Configuration**:
  - Site URL: `https://www.crawford-coaching.ca`
  - Redirect URLs allow-list:
    - `https://www.crawford-coaching.ca/auth/callback`
    - `http://localhost:3000/auth/callback` (for `vercel dev`)
- **Authentication → Email Templates → Magic Link**: two options, both supported by the site's auth helper:
  - **Option A — default template (simplest).** Leave it alone. It uses `{{ .ConfirmationURL }}`, which sends the user to `/auth/callback#access_token=…&refresh_token=…`. The callback reads the hash and calls `setSession()`.
  - **Option B — modern `token_hash` template (Supabase's current recommendation).** Edit the template so the link reads:
    ```html
    <a href="{{ .RedirectTo }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Sign in to Crawford Coaching</a>
    ```
    The callback sees `token_hash` + `type` in the query string and calls `verifyOtp()`. Slightly cleaner because the access token never sits in the URL.
  - **Do not mix the two patterns** in the same template. Pick one. Either is fine — the code handles both. The Supabase Assistant will steer you toward Option B; the Next.js App Router code it offers does not apply (this site is static HTML).
- **Project Settings → Auth → SMTP Settings**: switch to custom SMTP, pointed at Resend (per `platform-auth-chat-summary.md`). Use the warmed-up `notifications@crawford-coaching.ca` sender (or similar) so deliverability matches the rest of the site's email.
- **Session length**: 30 days (`Authentication → Sessions → JWT expiry`). This is a coaching site, not a banking app.

---

## 4. Set Vercel environment variables

In the crawford-site Vercel project settings → Environment Variables (Production + Preview):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://yxndmpwqvdatkujcukdv.supabase.co` |
| `SUPABASE_ANON_KEY` | the public anon JWT from Supabase → Project Settings → API |
| `DATA_HANDLER_BEARER_TOKEN` | (already set; used by `/api/member-data`) |

`SUPABASE_ANON_KEY` is public-safe — it's the same key that ships in front-end Supabase apps. RLS is the gate.

After saving, redeploy (or push a new commit) so the env vars are picked up.

---

## 5. Smoke test on the deployed branch

Once everything above is in place, push to your `rebuild` (or equivalent) branch and walk through the flow on the Vercel preview URL.

1. Visit `/synergize` → click **Member Login** in the nav.
2. Land on `/sign-in`, enter the email on a `contacts` row where `synergize_active = true`.
3. See the "check your email" confirmation.
4. Open the magic-link email → click the link.
5. Land on `/auth/callback`, see the spinner, get redirected to `/synergize/members`.
6. Confirm the greeting shows your first name.
7. Click **Sign Out** in the nav, confirm you're bounced back to `/synergize`.

Edge cases worth poking at:

- Sign in with an email that has **no** `contacts` row → trigger should create one at tier `public` → role resolver returns `email_captured` → the gate on `/synergize/members` denies access with the "this area is for active members" message. Good.
- Sign in with an email that has a contact but `synergize_active = false` → same denial. Good.
- Sign in with an email that has `coaching_active = true` → access granted (per spec, active coaching outranks Synergize on the decision tree).
- Sign-link expiry / re-request flow: request a link, ignore it, request another, confirm only the latest works.

---

## 6. Not in this slice (intentionally)

- Stripe integration for Growth Zone subscriptions (Phase 1 step 4–5 of the spec).
- WHOLE alumni claim window mechanics (Phase 6).
- Account / billing self-service page (Phase 8).
- Growth Zone landing rebuild for public exposure (next pass).
- Wiring `class_schedule` / `workout_of_the_day` / `holiday_schedule` actions in `data-handler` if they don't exist yet — `/api/member-data` will simply return empty for any that aren't supported, and the members page falls back to its placeholder copy.

---

## 7. If something goes wrong

The simplest failure modes and how to read them:

- **Sign-in says "server misconfigured"** → `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing from Vercel env vars.
- **Magic-link email never arrives** → SMTP not set in Supabase, or Resend domain unverified.
- **Sign-in succeeds but gate denies you** → the trigger didn't fire (check `pg_trigger`), or `synergize_active` is still false on your row.
- **Gate denies you and the page says "we can't find your record"** → RLS policy didn't apply, or `auth_user_id` didn't get set. Check by running `select id, email, auth_user_id, synergize_active from public.contacts where email = 'you@example.com'` as service-role.

You can roll back the deployment in Vercel at any point — auth pages are net-new, the only edited file with user-facing surface area is `crawford-synergize.html` (added Member Login link).
