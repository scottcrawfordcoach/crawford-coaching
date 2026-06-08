# Synergize Intake — Build Handoff (code-ready scope)

**For:** a local Claude Code / VS Code session with full repo + connector access.
**Companion:** [`synergize-intake-build-spec.md`](synergize-intake-build-spec.md) — the decisions doc. This handoff **resolves every `[DECIDE IN REPO]`** in that spec against the actual codebase, so you can build phases 1–6 without re-deciding. Read the spec for the *why* and the canonical document text (§6); read this for the *what to build*.
**Scope confirmed with Scott:** full **3-document** intake (Health Screen + Liability Waiver + Group Policies). Phases **1–6** (working, storing, gated intake). Phases **7–9** (copy-of-record PDF + auto-email, flagged-screen admin view, re-consent campaign) are a **fast-follow, not this build**.
**Status:** scope only — nothing applied/deployed. The build steps below include **🚩 GATED** operations that need Scott's explicit go-ahead at execution time.

---

## 0. Decisions resolved against the repo

| Spec `[DECIDE IN REPO]` | Resolution (grounded in repo) |
|---|---|
| Identity: how does the session expose identity? | Verify the Supabase access token server-side via `GET {SUPABASE_URL}/auth/v1/user` (exact pattern already in [`api/member-data.js`](api/member-data.js) and [`api/_capabilities.js`](api/_capabilities.js)). That yields the auth `user.id` + `email`. Resolve the `contacts` row by `auth_user_id = user.id` (the `contacts.auth_user_id` column + unique index were added in [`migrations/2026-05-auth-foundation.sql`](migrations/2026-05-auth-foundation.sql)). **Never** take `contact_id`/identity from the request body. |
| Table shape: Option A (one table) vs B (per-doc)? | **Option A — single `intake_submissions` table.** This is already locked by shipped client code: [`crawford-synergize-members.html`](crawford-synergize-members.html) `loadWaiverStatus()` queries `from('intake_submissions').select('signed_at, doc_version').eq('doc_type','liability_waiver')`. Build the table the client already expects. |
| RLS role names (`admin`/`client`/`subscriber`) | The project does **not** use Postgres custom roles for this — it uses the Supabase `authenticated` role + RLS scoped by `auth_user_id = auth.uid()` (see `contacts_self_select` in the auth-foundation migration). Members read/insert **their own** rows via RLS; **admin reads go through the service-role** `data-handler` (service-role bypasses RLS by design), not a broad RLS admin policy. No new role names. |
| Edge Function: one function or per `data-handler` convention? | Mirror the existing two-layer pattern: a **Vercel serverless function** (`api/intake-submit.js`, like `member-data.js`/`exercise-report.js`) verifies the session + enforces membership, then writes via a **new `data-handler` action** `intake_submit` (service-role insert). Keep the gateway rule: the only thing with Postgres credentials is `data-handler`. Reads for status/gating stay **client-side via RLS + anon key** (as `loadWaiverStatus()` already does). |
| Where the "current member" gate lives | Client-side soft-wall in the members-area entry script (`reveal()` path in `crawford-synergize-members.html`), reusing the existing `.gate` overlay pattern. Matches the current static-site architecture (no Next.js middleware here yet — that's the future Phase-3 migration). |
| PDF renderer (ReportLab vs Deno) | **Out of scope for this build** (phase 7). Defer. |

**Membership enforcement:** the intake submit endpoint must also confirm the caller is a member before accepting a signed record — reuse `capabilitiesFromToken()` from [`api/_capabilities.js`](api/_capabilities.js) and require the **`waiver`** capability. This is the server-side enforcement the capability design doc and CHANGELOG flagged as "waiver write-path enforcement when the intake flow is built."

---

## 1. Schema (phase 1) — 🚩 GATED (applies to live Supabase `yxndmpwqvdatkujcukdv`)

Create one migration (suggest `crawford-site/migrations/2026-06-intake-submissions.sql`, idempotent, `IF NOT EXISTS`). Concrete shape:

```sql
-- doc_type with forward room for the reserved future Growth-Zone disclaimer (spec §1).
do $$ begin
  if not exists (select 1 from pg_type where typname = 'intake_doc_type') then
    create type intake_doc_type as enum
      ('health_screen','liability_waiver','group_policies','online_activity_disclaimer');
  end if;
end $$;

create table if not exists public.intake_submissions (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null references public.contacts(id) on delete restrict,
  auth_user_id      uuid not null,                 -- denormalized = contacts.auth_user_id, for RLS
  doc_type          intake_doc_type not null,
  doc_version       text not null,                 -- e.g. '1.0'
  doc_text_hash     text not null,                 -- hash of the exact version text shown (computed server-side)
  responses         jsonb not null default '{}'::jsonb,  -- per-doc payload (§3 of spec)
  signature_name    text,                          -- liability_waiver: typed-name signature
  flagged           boolean not null default false,-- health_screen: any Part-A "yes"
  expires_at        timestamptz,                   -- health_screen: signed_at + 12 months
  reviewed_by       uuid,                          -- flagged-screen review (phase 8)
  reviewed_at       timestamptz,
  review_note       text,
  ip_address        inet,
  user_agent        text,
  signed_at         timestamptz not null default now(),
  record_emailed_at timestamptz,                   -- phase 7
  pdf_storage_path  text,                          -- phase 7
  created_at        timestamptz not null default now()
);

create index if not exists intake_submissions_contact_doc_idx
  on public.intake_submissions (contact_id, doc_type, signed_at desc);
create index if not exists intake_submissions_auth_user_idx
  on public.intake_submissions (auth_user_id);
```

Mandatory §1 capture columns are all present (who/what/version/hash/when/where/proof/delivery). Type-specific payloads live in `responses` jsonb (health-screen Parts A–D; waiver 7 clause affirmations; policies acknowledgement) per spec §3.

---

## 2. RLS + immutability (phase 2) — 🚩 GATED

```sql
alter table public.intake_submissions enable row level security;

-- Members read only their own records.
create policy intake_self_select on public.intake_submissions
  for select to authenticated using (auth_user_id = auth.uid());

-- Members may insert only their own (defense-in-depth; primary writes are service-role).
create policy intake_self_insert on public.intake_submissions
  for insert to authenticated with check (auth_user_id = auth.uid());

-- No UPDATE / DELETE policies for `authenticated` → signed records are immutable to members.
```

**Immutability guard (recommended):** add a trigger that blocks any change to the *signed* columns (`doc_type, doc_version, doc_text_hash, responses, signature_name, signed_at, contact_id, auth_user_id`) after insert, while permitting service-role updates to the **operational** columns only (`reviewed_by, reviewed_at, review_note, record_emailed_at, pdf_storage_path`). This keeps the evidentiary value intact (spec §4) without blocking the phase-7/8 review + delivery stamping. Corrections happen via a **new versioned record**, never by editing history.

**Verification (do explicitly):** sign in as one test member, confirm they see only their own rows (own > 0, others = 0), and confirm an `UPDATE`/`DELETE` from the `authenticated` role is denied.

---

## 3. Versioned document text + hashing (phase 3)

- Commit the canonical v1.0 text (spec §6) to the repo as the single source of truth: `crawford-site/intake/v1.0/health_screen.md`, `liability_waiver.md`, `group_policies.md`.
- The on-site form **renders from these**, and `api/intake-submit.js` **hashes these same files** server-side (e.g. SHA-256 of the exact rendered text) to fill `doc_text_hash`. The client never supplies the hash. Keep rendered text and hash source byte-identical.

---

## 4. Write path (phase 4) — 🚩 GATED (data-handler deploy)

**`api/intake-submit.js`** (new Vercel function; model on `member-data.js` + `_capabilities.js`). On `POST` it must, in order (spec §7):
1. Verify the Supabase access token (`/auth/v1/user`) → trusted `user.id`, `email`. Reject if unauthenticated (401).
2. `capabilitiesFromToken()` → require capability **`waiver`** (membership). Reject non-members (403).
3. Resolve `contact_id` from `contacts` where `auth_user_id = user.id` (via service-role `contact_lookup`).
4. Validate completeness for the submitted `doc_type`: waiver = all 7 clause booleans `true` + `signature_name` present; policies = `acknowledged === true`; health screen = required fields present.
5. Compute server-side: `doc_text_hash` (from the repo version text), `flagged` (health screen: any Part-A yes), `expires_at` (health screen: `signed_at + 12 months`).
6. Capture `ip_address`, `user_agent`, `signed_at` (server time).
7. Write the immutable row via a **new `data-handler` action `intake_submit`** (service-role insert into `intake_submissions`).
8. Return `{ ok, doc_type, status }` (cleared/flagged).

**`data-handler` `intake_submit` action** (lives in the **`crawford-coaching-mailer`** repo at `supabase/functions/data-handler/`, per the June-2026 restructure note in the root `CLAUDE.md`): inserts the validated row with the service-role client. Deploying `data-handler` **replaces the live gateway instantly** — 🚩 confirm with Scott before deploy. Optionally add an `intake_status` read action, but it's not required (status reads work client-side via RLS).

---

## 5. Forms (phase 5)

- [`synergize-forms.html`](synergize-forms.html) is the **approved mockup** (3-step: health screen → waiver → policies → `finish()`), currently **not wired** to persistence.
- Wire each step's submit to `POST /api/intake-submit` with the member's session token (`(await cc.getSession()).access_token` from `/auth/auth.js`), one record per `doc_type`. Disable the affirm/submit buttons until completeness is met (the mockup already disables `waiverbtn`/`polbtn`).
- Route it: add to [`vercel.json`](vercel.json) a rewrite `"/synergize/intake" → "/synergize-forms.html"` (the members-area `card-waiver` already links to `/synergize/intake`; that route does **not** exist yet).

---

## 6. "Current member" gating (phase 6)

In the members-area entry script, after the gate reveals, compute cleared-to-train (spec §5): a **current-version** `liability_waiver` AND `group_policies` exist, AND a `health_screen` exists at current version, **not expired** (`expires_at > now()`), and (if `flagged`) reviewed. Reads via the existing RLS + anon path (extend `loadWaiverStatus()` to all three docs). If not cleared, soft-wall: route to `/synergize/intake` before other features. Keep it a soft wall, not a hard lock.

---

## 7. Build sequence + gated-approval checklist

Order (spec §10, phases 1–6): **schema → RLS/immutability → versioned text + hash → `intake-submit` function + `data-handler` action → wire `synergize-forms.html` + route → gating.** Then stop; phases 7–9 are the fast-follow.

Operations that need Scott's explicit OK at execution time:

- 🚩 **Apply the schema + RLS migration** to live Supabase `yxndmpwqvdatkujcukdv`.
- 🚩 **Deploy `data-handler`** with the new `intake_submit` action (replaces the live gateway instantly; deploys from the `crawford-coaching-mailer` repo).
- 🚩 **(Phase 7, later) SMTP** for the copy-of-record email via `mail-sender` — separate confirm-before-send gate.
- Verify on a Vercel **preview** before production; the static pages + new `api/` function deploy with the site.

## 8. Out of scope here (fast-follow phases 7–9)

Copy-of-record PDF generation + auto-email on submit (§8), the flagged-screen admin review view (§5), and the re-consent campaign for existing members (§9). The schema already carries the columns these need (`record_emailed_at`, `pdf_storage_path`, `reviewed_*`), so they slot in without further migration.

## 9. External to-dos (Scott's, non-build — from spec §11)

Ontario legal review of the waiver wording (assumption-of-risk + gross-negligence carve-out); register "Synergize Fitness" as an Ontario business name before relying on these as a formal entity; optional scroll-through-before-accept on the waiver.
