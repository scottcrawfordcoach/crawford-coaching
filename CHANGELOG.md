# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog principles and uses reverse chronological order.

## [2026-06-09]

### Changed — Today's Workout card now reads the live schedule table (no more stale snapshot)

Durable fix for the staleness bug below: [`crawford-synergize-members.html`](crawford-synergize-members.html) `loadWorkout()` now fetches the **live `workout_schedule` table** via the public `data-handler` action (`?action=workout_schedule&from=<today>`, CORS-open, no auth) instead of the static `synergize-workout-schedule.json` snapshot. Rows are transformed into the same date-keyed shape the rest of the card logic uses, deriving `renderable` from the table's `built` flag — so a day becomes a launchable card the moment its workout is built/resolved, with **no schedule regeneration needed**. The static JSON is retained as a generated backup but no longer drives the card. `findNextSession()`/`renderWorkoutCard()` unchanged.

### Fixed — Today's Workout card showed the name but no launch link (stale schedule snapshot)

The members-area "Today's Workout" card reads the static [`synergize-workout-schedule.json`](synergize-workout-schedule.json) snapshot and only offers a launch link when that day's `renderable` is true. "Let's Get At It" (2026-06-09) was built + resolved in the live `workout_schedule` table (`built: true`, with `slug`/`workout_id`), but the snapshot was last generated 2026-06-06, so it still had `renderable: false` / empty `slug`+`workout_id` — the name showed, but the card fell back to the static "not posted yet" panel. Regenerated the JSON from the authoritative live table (same `build_json` logic as `schedule_sync.py`, JSON-only — no table/markdown changes). Forward-only refresh: 2 days flipped to launchable (2026-06-09 + one Nov day), zero regressions. Canonical refresh remains `schedule_sync.py --apply` in the Workout Schedule-AI project after building/scheduling a workout.

### Added — Flagged health-screen admin review (intake phase 8)

An ADMIN-only surface to review health screens that flagged a Part-A "yes" (spec §5) — the one piece of intake admin that's operationally important (a "yes" on a cardiac question shouldn't sit silently).

- **Page** — new [`crawford-synergize-intake-review.html`](crawford-synergize-intake-review.html) at route `/synergize/intake-review` (`vercel.json`): lists flagged screens (awaiting-review first, then reviewed), shows the member, the exact Part-A questions they answered "yes," and the full health context (history / injuries / goals) in a collapsible. Each has a note field + "Mark reviewed". `noindex`.
- **Server gate** — new [`api/intake-admin.js`](api/intake-admin.js): verifies the session and **requires the `ADMIN` tag** before returning any data (health-screen responses are PII; the client gate is convenience only). `GET` lists flagged screens via `data-handler intake_flagged`; `POST {id, note}` marks one reviewed via `intake_review` (records `reviewed_by` = the verified caller, `reviewed_at`, `review_note` — operational columns the immutability trigger permits).
- Reads go through the service-role gateway (members' RLS only exposes their own rows; admin cross-member reads must be service-role, per the design). No schema change.

### Added — Synergize intake v1.1: medical-advice notes + required Media Consent

New version of the intake documents per `SYNERGIZE-INTAKE-v1.1-BUILD-BRIEF.md`. **v1.0 is untouched** — v1.1 is a new folder ([`intake/v1.1/`](intake/v1.1/)) and `DOC_VERSION` is bumped to `1.1`; existing signed rows keep their v1.0 hash, only new signers get v1.1.

- **Medical-advice notes (Change 1):** Health Screen now shows a doctor/physio note under **Part B** (`HISTORY_FLAG_NOTE`) and **Part C** (`INJURY_FLAG_NOTE`), mirroring the existing Part A note. Rendered in [`synergize-forms.html`](synergize-forms.html) from the canonical constants (not re-typed), so the shown text and the hashed text stay byte-identical.
- **Media Consent (Change 2):** Group Policies gains a **required** single-choice media-consent section (`none` / `background` / `any`) with Scott's verbatim copy. The choice rides inside the existing `group_policies` `responses` JSON as `media_consent` — **no `data-handler` or schema change**. "Complete intake" is gated on both the acknowledgement **and** a media choice; the server (`api/intake-submit.js`) rejects a missing/invalid value.
- **Re-versioning note:** `DOC_VERSION` is one constant across all three docs, so the **liability waiver re-versions to 1.1 with identical body text** and a freshly-computed (identical-input) hash. Expected.
- **Importers repointed to v1.1:** `synergize-forms.html`, `api/intake-submit.js`, and `api/_intake-pdf.js` (the copy-of-record PDF now also renders the recorded media-consent choice).
- Built on branch `feature/intake-v1.1`; verified on a Vercel preview before merge.

### Added — Synergize intake: copy-of-record PDF + auto-email on completion (phase 7)

When a member finishes the final intake document, the system now generates a combined **copy-of-record PDF** of all three documents and emails it to them.

- **First dependency on the site** — added [`package.json`](package.json) (`"type":"module"`, `pdf-lib`). The API functions were already ESM (no CommonJS), so this is consistent; static pages are unaffected.
- **PDF builder** — new [`api/_intake-pdf.js`](api/_intake-pdf.js): renders a branded, paginated PDF **from the stored rows** (so the artifact provably matches the immutable records) — masthead, member, a completion block ("Completed electronically … on [date], from [IP]"), the actual health-screen responses, each waiver clause with its affirmation, and the acknowledged policy text.
- **Finalize flow** — [`api/intake-submit.js`](api/intake-submit.js): on the `group_policies` submit, reads all three records (`data-handler intake_records`), builds the PDF, stores it privately, emails it via `mail-sender` (attachment support), and stamps `pdf_storage_path` / `record_emailed_at` (`data-handler intake_stamp`). **Best-effort**: the signed record is already persisted, so any PDF/storage/email failure is logged and swallowed — a signature is never lost to an SMTP/Storage hiccup (spec §7).
- **Storage** — new **private** Supabase bucket `intake_records` (service-role access only; members receive the PDF by email, not a public link).
- **Auto-email is now on** (you approved the SMTP gate): each completed intake sends one transactional email to the member via Resend. Requires `MAIL_SENDER_BEARER_TOKEN` (already set for exercise reports); email is skipped cleanly if unset.

## [2026-06-08]

### Changed — Intake status wording: "Completed on [date]", not "cleared to train"

[`crawford-synergize-members.html`](crawford-synergize-members.html): the completed-intake card said "Completed — you're cleared to train," which could read as a medical/fitness clearance judgement on the member's disclosed health info. Now shows the neutral "Completed on [date]" (date = when the last required document was signed). The underlying gating logic is unchanged.

### Fixed — Intake submit returned 401 "Invalid session" (stale cached token)

[`synergize-forms.html`](synergize-forms.html) captured the Supabase session **once at page load** and reused that access token for all three submits. Across a multi-step form (and a long-lived sign-in), supabase-js auto-refreshes the token in the background or it simply expires, so the cached token went stale and `api/intake-submit.js`'s server-side verify rejected it with 401 — and every retry re-sent the *same* stale token (the giveaway was repeated identical 401s in the logs). Confirmed not an env issue: `/api/auth-config` serves the correct project anon key. Fix: `submitDoc()` now resolves a **fresh** session via `cc.getSession()` immediately before each request (and routes to sign-in if the session is fully gone).

### Added — Synergize digital intake: front-end + go-live (phases 5–6)

Wires the intake flow end-to-end and takes it live. With the backend (below) in place, members can now complete the 3-document intake and the members area reflects their status.

- **Route** — [`vercel.json`](vercel.json): `/synergize/intake` → `synergize-forms.html` (the members-area `card-waiver` already linked here).
- **Form** — [`synergize-forms.html`](synergize-forms.html): the approved mockup is now wired. It imports the canonical [`intake/v1.0/documents.js`](intake/v1.0/documents.js) and **renders the PAR-Q, the 7 waiver clauses, and the policies from it** (so the shown text matches the hashed text), gates on a Supabase session (redirects to `/sign-in?next=…` if signed out), prefills name/email from the member's contact, collects the full structured payload per part, and **submits one immutable record per document** to `POST /api/intake-submit` with the session token (health screen → waiver → policies). The "emailed copy" promise was removed (PDF/email is phase 7).
- **Gating** — [`crawford-synergize-members.html`](crawford-synergize-members.html): `loadWaiverStatus()` now reads all three docs and computes **cleared-to-train** per spec §5 (current-version waiver + policies, plus a current, non-expired, reviewed-if-flagged health screen). The card shows *Completed — cleared to train* / *In progress* / *NOT COMPLETED*. Soft status, not a hard redirect (the re-consent campaign is a fast-follow).
- **Gateway deployed** — `data-handler` redeployed with the `intake_submit` action (version 30 → 31). Gateway health verified post-deploy (public actions 200; `intake_submit` 401 unauthenticated). The flow is now **live**.

### Added — Synergize digital intake: backend (phases 1–4 of the build handoff)

Stands up the storage + write path for the 3-document member intake (Health Screen, Liability Waiver, Group Policies), per [`synergize-intake-build-handoff.md`](synergize-intake-build-handoff.md). **Backend only — the on-site form, the `/synergize/intake` route, and members-area gating (phases 5–6) are not wired yet**, so nothing is user-facing until they are. Two 🚩 gated production steps (apply the migration; redeploy `data-handler`) must run before this path is live.

- **Canonical text + hashing source of truth** — new [`intake/v1.0/documents.js`](intake/v1.0/documents.js): the exact v1.0 wording (Part-A PAR-Q, 7 waiver clauses with the elevated assumption-of-risk clause, group policies) as one module the form renders from *and* the server hashes, so the shown text and `doc_text_hash` are byte-identical by construction. Human-readable mirrors in [`intake/v1.0/health_screen.md`](intake/v1.0/health_screen.md), [`liability_waiver.md`](intake/v1.0/liability_waiver.md), [`group_policies.md`](intake/v1.0/group_policies.md).
- **Schema (phase 1–2)** — new [`migrations/2026-06-intake-submissions.sql`](migrations/2026-06-intake-submissions.sql): Option-A single `intake_submissions` table (typed by `intake_doc_type` enum, with the reserved future `online_activity_disclaimer`), all §1 capture columns, RLS (`intake_self_select`/`intake_self_insert` scoped to `auth_user_id = auth.uid()`), and an immutability trigger freezing the signed columns after insert. Idempotent. **Not yet applied (🚩 gated).**
- **Write endpoint (phase 4)** — new [`api/intake-submit.js`](api/intake-submit.js): verifies the Supabase session, **requires the `waiver` capability** (server-side membership enforcement — the write-path gate the capability design flagged), resolves `contact_id` from the trusted session (never the body), validates completeness per doc, server-computes `doc_text_hash`/`flagged`/`expires_at`, captures IP + user-agent, and writes the immutable row via the new `data-handler` `intake_submit` action.
- [`api/_capabilities.js`](api/_capabilities.js): `capabilitiesFromToken()` now also returns the trusted `userId` (token auth uid) for the record's `auth_user_id`, avoiding a second token verification.

### Fixed — Members-area launch cards: near-black background + centred text

Both issues had one root cause: the three static launch cards (Interval Timer, Liability Waiver, Quick EMOM) use `<a class="member-card mcard mcard--launch">` as the **outer** element, so the anchor inherits `.member-card` properties that the expandable/workout cards avoid (their `.member-card` is a `display:block` `<article>` with the launch styling on an inner element).

- **Background:** the shared `.mcard__header, a.mcard--launch { background: none }` rule (element+class specificity) overrode `.member-card`'s slate on the outer anchor, so the near-black page (`--ink`) bled through. Fixed with `a.mcard--launch { background: var(--slate); }`.
- **Alignment:** the anchor also inherited `flex-direction: column` from `.member-card`, so the anchor's `align-items:center` centred the text horizontally and `justify-content:space-between` pushed the arrow to the bottom. Fixed by forcing `a.mcard--launch { flex-direction: row; }` — text now left-aligned with the arrow on the right, matching the workout/expandable cards.
- [crawford-synergize-members.html](crawford-synergize-members.html); hover state unchanged. **Needs a Vercel deploy to go live.**

### Added — Client-side member gate on the paid Growth-Zone tool pages

The paid tool pages (`/motivation`, `/optimism`, `/task-triage`) loaded `auth.js` **only** to attach the session token to the report request — so `api/exercise-report.js` server-enforced the AI-report generation (spend + PII), but the page and the interactive exercise itself were fully open to anyone, including anonymous/private-browser visitors. The "Members" tier chip was cosmetic with nothing behind it.

- **Added** [auth/tool-gate.js](auth/tool-gate.js) — a shared `gateTool(capability, { toolName })` module that drops a full-screen veil on load, resolves capabilities via `cc.getCapabilities()`, and either removes the veil (entitled) or shows a "Members only" gate with sign-in (anon) / upgrade (signed-in non-member) CTAs. Brand-styled, self-contained (inline styles, no page-CSS dependency).
- **Changed** [crawford-motivation.html](crawford-motivation.html), [crawford-optimism.html](crawford-optimism.html), [crawford-task-triage.html](crawford-task-triage.html): each now calls `gateTool('gz_paid_tools', …)` after the existing token-attach script.
- **Scope/Security:** this is the **UX layer** — it stops casual/anonymous use and makes the page match the card labelling, but the exercise HTML is still in page source, so it is **not** a hard boundary. The authoritative gate for spend + PII stays the server check in `api/exercise-report.js`. True page-level enforcement would require serving these pages behind an authenticated function (the Phase-3 static→Next.js migration). **Needs a Vercel deploy to go live.**
- **Left open by design:** the *Email Required* tier (`/core-values`, `/strengths`, `/feelings`) is not gated — those are email-capture tools, not member-only. Flagged for Scott in case he wants those gated too.

### Added/Changed — Surface a single Interval Timer entry point in the members area + Growth Zone

Step 5 added the `custom_timer` UX gate on the timer page itself (`#modeCustomTimerBtn` locks for non-members; `cc.hasCapability('custom_timer')` unlocks it), but never surfaced a way for members to *reach* the timer from their member areas. Now that the full custom builder is auth-gated on the timer page, a single un-gated "Interval Timer" card that links to `/timer` is enough — no separate locked custom-timer card needed.

- [crawford-synergize-members.html](crawford-synergize-members.html): new **Interval Timer** launch card (`id="card-timer"`, → `/timer`, new tab), mirroring the Quick EMOM Builder card; Synergize-orange tag label per the existing `.member-card__tag` style. Intentionally **ungated** (no `gateCard` line) — the timer page is public and gates its own custom-builder mode. Provides a card entry point alongside the existing nav-menu link.
- [crawford-growth-zone.html](crawford-growth-zone.html): consolidated to **one** timer card. Kept the orange-branded open **Interval Timer** card (`tool-card__link--physical` → `/timer`) and refreshed its copy to point members at the auth-gated full builder on the timer page; removed the redundant second "Create Custom Timer" paid card.
- **No new gating logic or capability names** — the authoritative gate remains the timer page's `hasCapability('custom_timer')` check. **Needs a Vercel deploy to go live.**

### Fixed — Magic-link sign-in from the members/Growth-Zone areas landed on the admin app

- **Root cause (Supabase Auth URL config, shared project `yxndmpwqvdatkujcukdv`):** the site canonicalises to `www.crawford-coaching.ca`, so `signInWithEmail()` builds `redirectTo = https://www.crawford-coaching.ca/auth/callback?next=…`. The Redirect URLs allow-list held only the **exact** `https://www.crawford-coaching.ca/auth/callback` (no wildcard), which does **not** match a URL carrying a `?next=` query string (Supabase separators are `.` and `/`; only `**` matches a query). On no match, Supabase silently falls back to the **Site URL** (`https://app.crawford-coaching.ca`, the admin app) — so every crawford-site magic link landed in the admin area, and the session never reached the `www` origin (hence the members area never granted access on a fresh machine). Confirmed via auth logs: all recent `/otp` + `/verify` events had `referer: app.crawford-coaching.ca`.
- **Fix (dashboard):** added two globstar Redirect URLs — `https://www.crawford-coaching.ca/auth/callback**` (the operative fix) and `https://crawford-coaching.ca/auth/callback**` (apex insurance). Existing entries and the Site URL left unchanged. **Live immediately** (GoTrue config, no deploy).
- **Hardening** [crawford-auth-callback.html](crawford-auth-callback.html): after `completeCallback()`, confirm a session actually exists on this origin before routing — if not (e.g. a future Site-URL fallback), show a clear "open the link on this page / request a new one" message instead of bouncing into a sign-in loop. Added `safeNext()` to restrict the post-login redirect to same-origin root-relative paths (rejects absolute + protocol-relative `//host` values). **Needs a Vercel deploy to go live.**

## [2026-06-07]

### Status — Capability Model Steps 1–5 merged & live in production (PR #1)

The capability work below (Steps 1, 2, 4, 5) shipped via **PR #1 → `main` (`31f4123`)** and is **live in production** (deploy READY 2026-06-07). Member access is billing-derived (see migration 003 + the `*_billed_through` sync in the mailer repo's log).

- **Verified on prod:** forged `/api/exercise-report` requests for paid exercises are rejected *before* any AI spend — no token → `401`, invalid token → `401`. The `gz_paid_tools` server gate works live. Resolver unit tests (11/11) and server↔client parity confirmed.
- **Step 3** (admin gating) confirmed already-correct — no code change.

**Still to come (not blocking):**
- Human walkthrough on prod of member vs non-member states (members-area cards, custom-timer mode, Growth-Zone upsells) — needs sign-in.
- **`waiver` write-path enforcement** when the `/synergize/intake` flow is built — use `api/_capabilities.js` `capabilitiesFromToken()` to verify session + `waiver` server-side (read is already RLS-protected).
- Monthly **billing → access sync** must be re-run each month — see `Accounts - AI/invoicing/MONTHLY-BILLING-SYNC.md` and the recurring calendar reminder (1st of each month).

### Added — Capability resolver in `auth.js` (Capability Model Step 1, UX layer)

- [auth/auth.js](auth/auth.js): added the client capability resolver per `crawford-coaching-mailer/CAPABILITY-REGISTRY.md`. New surface on `cc`: `getCapabilities()` / `hasCapability(name)` (async, current user), `resolveCapabilities(contact)` / `coarseRole(contact)` (pure), and `getCoarseRole()`. Resolution is **additive over every active membership** (not off winner-take-all `getRole()`): `SYNERGIZE_SUITE` ∪ `GZ_PAID_SUITE` ∪ `GZ_EMAIL_SUITE` ∪ admin bundles ∪ stripped `CAP_*` tags.
- **Synergize/coaching access is billing-derived:** a new `hasServiceAccess()` helper prefers the `*_billed_through` month-stamp (`>= current month`, so access auto-expires when unbilled even if a sync run is missed) and falls back to `*_active` only when there's no stamp — i.e. a deliberate comp/manual grant. `getContact()` now also selects `synergize_billed_through` / `coaching_billed_through`.
- **No UI wired yet** — this is the resolver only; consumers (members-area cards, EMOM builder, Growth-Zone card states) come in Step 2. `hasCapability()` is UX-only for every capability except `custom_timer` / `waiver` / `gz_paid_tools`, which get server enforcement in Steps 4–5.
- Verified with 11 unit checks (Node): synergize-only → full `SYNERGIZE_SUITE`; coaching+synergize stays additive; `CAP_CUSTOM_TIMER` on a non-member → `custom_timer`; lapsed stamp → empty; comp (active, no stamp) → suite; ADMIN superset; coarseRole public/member/admin; anon → empty.

### Added — Capability-gated card presentation (Capability Model Step 2, UX layer)

- [crawford-synergize-members.html](crawford-synergize-members.html): `reveal()` now calls `applyCapabilityGates(contact)` (uses `cc.resolveCapabilities`) to show only the launch cards the member is entitled to — `card-workout`→`wod`, `card-waiver`→`waiver`, `card-emom`→`emom_builder`. Members who enter via coaching/whole status (no Synergize suite) no longer see Synergize-only cards; class schedule + holiday hours stay (informational, area-gated). Added `id="card-emom"`.
- [crawford-growth-zone.html](crawford-growth-zone.html): the three paid cards (Motivation, Optimism, Task Triage) are tagged `data-cap="gz_paid_tools"`; a new auth module upgrades them to a live launch (drops `tool-card--paid`, badge → "Unlocked", CTA → the real action) **only** for entitled members. Non-members keep the locked card + "Unlock with Growth Zone" CTA (decision 6 — shown, not hidden). Auth failure is non-blocking (locked stays the safe default).
- **`custom_timer` intentionally NOT gated here** — it waits for the Step 5 server-enforced endpoint. These checks are UX-only; `waiver` / `gz_paid_tools` get real enforcement in Step 4.

### Added — Server enforcement for `gz_paid_tools` (Capability Model Step 4)

- **Added** [api/_capabilities.js](api/_capabilities.js) — server-side capability resolver (underscore-prefixed → not a Vercel route). Verifies the Supabase access token (`/auth/v1/user`), then resolves capabilities from the **service-role `contact_lookup`** (via `data-handler`), never from the request body. Mirrors the client resolver, billing-aware (`*_billed_through`).
- **Changed** [api/exercise-report.js](api/exercise-report.js): paid exercises (`motivation`, `optimism`, `task_triage`) now require a signed-in member with `gz_paid_tools` — checked **before** any contact upsert or AI/report generation. Missing/invalid token → 401; valid token without the capability → 403. Email-tier exercises (`core_values`, `character_strengths`, `feelings`) stay open (email capture). Added `Authorization` to allowed CORS headers.
- **Changed** the three paid exercise pages ([crawford-motivation.html](crawford-motivation.html), [crawford-optimism.html](crawford-optimism.html), [crawford-task-triage.html](crawford-task-triage.html)): attach the member's session token to the `exercise-report` POST so entitled members pass the server check.
- **No `data-handler` deploy required** — used the existing `contact_lookup` (returns `*` incl. `growth_zone_subscribed` / `*_billed_through` / tags). Verified: resolver parity (server vs client), and the no-token guard returns 401 with no network call / no spend. Cross-project note in `../CHANGELOG.md` (shared access contract).
- **`waiver` (the other Step 4 capability):** the read is already protected by Supabase RLS (`contacts_self_select` / per-user row policy), and the intake **write** flow (`/synergize/intake`) isn't built yet — so no waiver code change here beyond readiness. When the intake endpoint is built it must use `capabilitiesFromToken()` to verify session + `waiver` server-side. Deferred, not skipped.

### Changed — `custom_timer` UX-gated at the entry (Capability Model Step 5)

- [crawford-timer.html](crawford-timer.html): the "Create Custom Timer" mode is now **members-only** — gated client-side via `cc.hasCapability('custom_timer')`. **Fail-closed:** locked by default (dimmed, "🔒 Members only — included with Synergize"); a module unlocks it only when the resolver confirms `custom_timer` (Synergize suite / `CAP_CUSTOM_TIMER` / ADMIN). Non-entitled clicks route to `/synergize#custom-timer`. The **open base timer (clock, countdown, Quick EMOM) is untouched and fully public.**
- **Deliberate decision change (logged):** decision 4's "server-enforced" requirement is **downgraded to UX-gated** for `custom_timer` — it's a non-sensitive convenience UI woven into a fragile public monolith, so the strict "code never sent" extraction isn't worth the regression risk to the open timer (the real paid/PII surfaces are already protected: `gz_paid_tools` server-gated, `waiver` via RLS). If productized, rebuild as a server-enforced standalone app. See registry §3 + design §8.6. No engine refactor; no server/data-handler change.

### Changed — Synergize members "Holiday hours" card lists all closures in a 30-day window

- [crawford-synergize-members.html](crawford-synergize-members.html) `loadHolidayClosures()` now looks ahead **30 days** (was 60) via a named `CLOSURE_LOOKAHEAD_DAYS` constant, and **drops the previous 4-item cap** (`.slice(0, 4)`) so a full multi-day vacation is never truncated. The empty-state message updates to "No closures in the next 30 days," and a `member-feed__hint` line — "Ask the assistant about dates beyond this." — points members to the assistant for closures further out.

## [2026-06-06]

### Fixed — Today's Workout "next session" now shows the real upcoming day, not the next *built* one

- [crawford-synergize-members.html](crawford-synergize-members.html) `findNextSession()` no longer requires `renderable` — it returns the next *open* training day regardless of whether that workout has been built in the mailer yet. Previously it skipped every scheduled-but-unbuilt day, so with only a handful of workouts converted the "No session today" card leapt past ~two months of real sessions to the next published render (on Sat 6 Jun it showed "Next session · Tue, Aug 4 — Spicy Meatball" instead of Mon 8 Jun — Grace Kelly).
- The no-session render branch now mirrors the Today branch: `canLaunch: next.renderable` plus a `Full workout not posted yet` note for unbuilt days. The card shows the correct upcoming workout name + date as a soft fallback (summary in the expandable panel) and becomes a launch link automatically once that day's workout is converted. This intentionally supersedes the earlier "open *and* renderable" rule (2026-05-31) — safe because unbuilt names resolve to the mailer's branded "not posted yet" lookup page, not a 404.

## [2026-05-31]

### Changed — Synergize members cards redesigned as neat titled cards; Today's Workout + Liability Waiver wired up

- [crawford-synergize-members.html](crawford-synergize-members.html) member cards reworked from full-body cards into compact titled cards. Two behaviours: **expandable** cards (Class schedule, Holiday hours) reveal a detail panel in place via an accordion header (`.mcard__header` with `aria-expanded` + a chevron); **launch** cards (Today's Workout, Liability Waiver, Quick EMOM Builder) open their target in a new tab (`target="_blank" rel="noopener"`, ↗ icon). New `.mcard*` CSS block added before the footer styles; existing `.member-card` shell (slate bg, border, radius) retained.
- **Today's Workout** card now resolves the scheduled workout for the current date from a new guide file and opens the mailer's public render (`https://app.crawford-coaching.ca/workouts/{slug}/display`) in a new tab. Handles weekends/closures by pointing to the next session, and days flagged "No File" by showing the summary in an expandable panel instead of a (broken) render link.
- New [synergize-workout-schedule.json](synergize-workout-schedule.json) — a date-keyed guide (name, slug, summary, emphasis, equipment, status, renderable) generated from the Workout Schedule project's `workout-log-2026.md` (264 weekday rows incl. 25 closures). This is only the *guide*; the workout content itself lives in Supabase and is rendered by the mailer. **Regenerate when the workout log changes.**
- **Liability Waiver** card shows "Last completed {date}" or "NOT COMPLETED", read as the authenticated member via the Supabase client (anon key + RLS — members see only their own rows) from an `intake_submissions` table. The digital intake backend is not built yet (it remains a build spec), so the query currently returns nothing and the card shows NOT COMPLETED — this is the forward-compatible read path. Card links to `/synergize/intake`, which still needs a Vercel rewrite + the intake flow page before it resolves.
- No design-token changes; only existing brightened tokens used.

### Fixed — Members-area entry point + no-session workout card

- [crawford-synergize.html](crawford-synergize.html) hero "Member Login" pill is now auth-adaptive instead of hidden-when-signed-in: signed-in visitors see "Members Area" linking straight to `/synergize/members`, signed-out visitors see "Member Login" → sign-in. Previously the pill was hidden for signed-in members, leaving no link into the members area at all (the nav has no Members item).
- [crawford-synergize-members.html](crawford-synergize-members.html) `findNextSession()` now skips to the next *open and renderable* day, so on weekends/closures the Today's Workout card links to a real upcoming workout render rather than risking a 404 on a non-published slug.
- [crawford-synergize-members.html](crawford-synergize-members.html) logo `<img>` src in the nav and footer changed from relative `./extracted-images/cc-logo.png` to root-absolute `/extracted-images/cc-logo.png`. The page is served at `/synergize/members`, so the relative path resolved to the non-existent `/synergize/extracted-images/...` and the logo 404'd. (Companion fix to the mailer's workout display route — see `crawford-coaching-mailer/CHANGELOG.md` — so unbuilt workouts show a branded page instead of a 404.)
- [synergize-workout-schedule.json](synergize-workout-schedule.json) corrected the slug for "He Ain't Heavy, He's My Brother" (2026-06-01, 2026-08-17) from the derived `he-aint-heavy-hes-my-brother` to the mailer's actual stored slug `he-aint-heavy`. Confirmed that mailer slugs are set at creation and can be hand-shortened, so they are **not** reliably derivable from the title.

### Changed — Today's Workout card now links by name, not slug

- [crawford-synergize-members.html](crawford-synergize-members.html) the Today's Workout card now links to `app.crawford-coaching.ca/workouts/lookup?name=…` (the new mailer name-resolver) instead of building a `/workouts/{slug}/display` URL from a guessed slug. The mailer resolves the scheduled name to the real workout and redirects to its render — so days light up automatically as workouts are converted, with no schedule regeneration, and the per-day slug in `synergize-workout-schedule.json` is no longer used for linking (the `renderable` flag still gates whether the card is a launch link vs. an in-place summary). See `crawford-coaching-mailer/CHANGELOG.md` for the resolver route.

## [2026-05-24]

### Changed — Growth Zone card on homepage now has a photo background

- [crawford-homepage.html](crawford-homepage.html) `.door--growth .door__bg` switched from the flat `slate-mid → slate` diagonal gradient to a forest-walk photo (`./extracted-images/homepage-006.webp`, derived from a 3264×2448 source JPG resized to 1200×900 and saved at WebP quality 75, ~296 KB). The image shows an adult and small child walking hand-in-hand down a tree-lined path — fits the Self-Discovery framing of the card and brings the four homepage doors to visual parity (each now has a photograph rather than three photos + one gradient).
- `.door--growth .door__overlay` darkened slightly: top stop moved from `rgba(14,15,16,0.08)` to `0.25`, mid from `0.58 @ 56%` to `0.65 @ 55%`, bottom from `0.9` to `0.92`. The lift on the top stop is the load-bearing change — the original 0.08 was tuned for a near-solid dark gradient where the tag/title/desc could sit straight on the panel; against a busy mid-tone forest photo it left the "Self-Discovery" tag and title fighting the trees, so the top now contributes meaningful contrast without flattening the image. Bottom stops nudged up just enough to keep the CTA crisp on the path texture.
- Source JPG (`extracted-images/DSCF7388.jpg`) retained in the repo per existing convention — site references the WebP only.

## [2026-05-22]

### Added — Standalone Quick EMOM Workout Builder at /quick-emom

- New page [crawford-quick-emom.html](crawford-quick-emom.html) (1470 lines, single-file). Extracted the Quick EMOM Workout generator + player from the multi-mode `crawford-timer.html`, wrapped it in standard site chrome (Cormorant Garamond + Jost dark editorial nav, hero, footer), and stripped every multi-mode artifact (mode selector, custom interval timer, Quick EMOM Timer manual mode, countdown, clock, saved favourites, PWA install banner, header toolbar). The page stands on its own at `/quick-emom` so the builder can become a standalone product.
- Rewrite added in [vercel.json](vercel.json): `/quick-emom` → `/crawford-quick-emom.html`, slotted after the existing `/timer` rule.
- Page reuses [timer-emom-db.js](timer-emom-db.js) (150+ exercises across Bodyweight / Kettlebell / Dumbbell / Bands / TRX / Stability Ball / Slam Ball / Step / Sturdy Chair) — referenced as root-absolute `/timer-emom-db.js` so it resolves at any URL depth.
- Generator algorithm (`generateEMOM`, `selectDiverse`, `buildUniqueExercisePool`, `getBodyPartPreference`), disclaimer modal flow, preview renderer, `startEmomPlan` (circuit + block ordering, GET READY countdown), beep audio synthesis, and the rAF timer engine all ported verbatim. `updateUI` simplified to drop the `workoutName` input reference (no such input on the new page — title hard-coded as "QUICK EMOM"). `pause`/`resume`/`reset`/`finish` simplified to drop the `appMode` branches and the duplicate `emomTimerActionsBar` paths.
- Mode-switching glue (`switchToMain` / `switchToEmomConfig` / `switchToEmomActive`) replaced with three focused helpers — `showConfig()`, `showPreview()`, `showRunning()` — that toggle the four sections on the new page.
- `crawford-timer.html` was **not** modified in this pass. Per Scott's direction, the EMOM code stays in the timer page until the new standalone page is verified end-to-end on the deployed branch; once parity is confirmed, the dormant EMOM-Workout code (CSS lines 348-462, HTML lines 754-867, JS lines 2249-2658, plus the `EMOM_DB` script tag and `emomActions` action bar) will be stripped in a follow-up.

### Changed — Synergize members area: real data on Class schedule and Holiday hours cards

- [crawford-synergize-members.html](crawford-synergize-members.html) now shows live data on two cards that previously sat on placeholder copy.
- **Class schedule**: fetched directly from `data-handler?action=class_schedule` (the same public action the main `/synergize` page uses). Dropped the `/api/member-data` indirection for this feed — that wrapper was passing the data through unchanged but expected a `{ when, label }` shape the action never emits (real shape: `{ day, time, freeSpaces }`), so the card had been silently empty. Render groups by Mon/Wed, Tue/Thu, Friday — same grouping as the main page — and shows the max free spaces per (group, time) slot as `N spot(s)` or `Waitlist`. If every slot is full, an italic line below the list nudges members to email Scott for a waitlist.
- **Holiday hours**: 2026 closure list inlined as a static `HOLIDAY_CLOSURES` array (27 entries), mirroring the canonical table in `Coach-Scott-Bot/supabase/storage/website_assistant_knowledge/gym-holiday-closures.md`. The render filters to the next 60 days, sorts by date, and shows up to 4 upcoming closures with day-of-week + short date + reason. Fallback line ("No closures in the next 60 days.") when the window is clear.
- **Maintenance note**: [CLAUDE.md](../CLAUDE.md) already documents the closure-update cross-project sync. `crawford-site` is now one more place to update when a closure changes — alongside Accounts-AI's invoicing folder, Coach-Scott-Bot's knowledge bucket (the canonical source), and Workout Schedule AI. The inlined array carries a comment block pointing back to the canonical .md so the obligation is visible from the file itself.
- **WOD card** untouched — still shows the "Today's WOD will appear here once published." placeholder until `data-handler` ships a `workout_of_the_day` action. The new `loadFeeds()` flags this as a one-line TODO for that future wiring.
- `/api/member-data` left in place (still called by nothing now, but kept for the future WOD feed and any other authenticated feeds we route through there).

### Changed — Synergize members area: card swap + cleanup

- [crawford-synergize-members.html](crawford-synergize-members.html) member-card grid revised:
  - The 4th card switched from a generic "Interval timer / Open timer → /timer" to a direct entry point for the new builder: tag "Workout Builder", title "Quick EMOM Workout Builder", action "Build a workout" → `/quick-emom`. Body copy describes the value (150+ exercises, balanced EMOM in seconds) so members understand what they're getting.
  - The "Open timer" CTA on the **Workout of the day** card was removed entirely. The Interval Timer link lives in the persistent top nav on every page, so duplicating it on a member card was visual noise. The WOD card is now purely informational — the feed text appears once published.
- Class-schedule and Holiday-hours cards untouched.

### Changed — Synergize Member Login moved from nav to hero pill (auth-aware)

- [crawford-synergize.html](crawford-synergize.html): the Member Login entry has been lifted out of the desktop nav and the mobile overlay menu and re-anchored as a pill button in the top-right corner of the hero, below the fixed nav. This makes it a deliberate, discoverable affordance for existing members landing on the public Synergize page rather than a quiet nav link competing with seven other items.
- New `.hero-pill` style: pill-shaped (border-radius 999px), translucent dark background with backdrop blur, white border + text, a small syn-orange dot prefix as a visual hook, hover state flips to syn-orange. Responsive override at ≤900px tightens position and type size so it doesn't collide with the hamburger toggle.
- Auth-aware reveal: pill is hidden by default (opacity 0 / visibility hidden) and only unhides once a `cc.getSession()` check confirms the visitor has **no** active Supabase session. This avoids a flash of a login CTA for already-signed-in members. Imports the existing shared helper at [auth/auth.js](auth/auth.js); fails open (shows the pill) if the auth check itself errors, so the entry point to the member area is never silently lost.
- Cleanup: removed the now-orphaned `.nav__member` CSS rules (definition + `:hover` + the `@media (max-width:900px) { .nav__member { display:none; } }` override) — no remaining elements use the class.
- Href and `next=/synergize/members` query string preserved, so the existing magic-link → callback → `/synergize/members` gate flow is unchanged.

### Changed — Growth Zone landing replaced with canonical editorial design

- [crawford-growth-zone.html](crawford-growth-zone.html) replaced with the canonical dark editorial design (source: `cowork-brief-growth-zone-and-auth.md`). The previous tier-aware/member-state landing (with `--tier-open` / `--tier-free` / `--tier-paid` color tokens and the auth-driven re-render) is gone for now: per brief, the visual direction is being locked in first, with tier-aware UI to be merged in deliberately as a separate pass.
- Structure: hero ("Self-Discovery" eyebrow + "Growth *Zone*" title), Self-Discovery Exercises group (Wheel of Life, Core Values, Character Strengths, Motivation, Optimism), Working Tools group (Feelings Naming Guide, Task Triage, Interval Timer), tier legend bar with trust modal, upgrade band with Synergize bridge, footer.
- Existing SEO meta (description, canonical, `og:*`, `twitter:*`) was preserved by splicing it back into the new file's `<head>` — only the visible page changed; social preview cards continue to work.
- Three internal hrefs in the new file have no matching rewrite in [vercel.json](vercel.json) and need follow-up: `/wheel-of-life`, `/growth-zone/subscribe` (there is a `/subscribe`, but not the nested form), and `/privacy`. Per brief, hrefs were left as-is rather than rewritten.

### Changed — Site-wide www. domain consistency pass

- All `https://crawford-coaching.ca` and `http://crawford-coaching.ca` URL forms in the repo converted to `https://www.crawford-coaching.ca` for consistency with the canonical subdomain. **228 replacements across 41 text files** (HTML, JS, MD, JSON, XML), plus a follow-up pass that updated **12 URL-encoded share-link URLs** (`%2F%2Fcrawford-coaching.ca` → `%2F%2Fwww.crawford-coaching.ca`) in [crawford-writing.html](crawford-writing.html). Total: 240 URL replacements across 42 files.
- Affected (URL-form replacements only): all 16 blog posts under [blogs/](blogs/), the marketing pages ([crawford-homepage.html](crawford-homepage.html), [crawford-coaching.html](crawford-coaching.html), [crawford-about.html](crawford-about.html), [crawford-writing.html](crawford-writing.html), [crawford-writing-all.html](crawford-writing-all.html)), several exercise pages, [api/exercise-report.js](api/exercise-report.js), and all 12 source files under [writing-import/](writing-import/).
- [scripts/publish-writing-article.js](scripts/publish-writing-article.js) generator updated (10 URL constants), so new articles published from this script will inherit the `www.` form automatically rather than re-introducing the inconsistency.
- **Deliberately left untouched:** brand-text footer displays of the bare domain like `<div class="footer-brand">crawford-coaching.ca</div>` on the exercise pages and the email-template footer in [api/exercise-report.js](api/exercise-report.js), where the bare form is the visual brand mention; email addresses (`notifications@crawford-coaching.ca` etc.); [CHANGELOG.md](CHANGELOG.md) prose that documents prior fixes.

### Changed — Magic-link redirect: defensive validation + clearer troubleshooting

- Diagnosed the magic-link redirect bug where clicking the link lands the user on `https://yxndmpwqvdatkujcukdv.supabase.co/www.crawford-coaching.ca#access_token=…` with `{"error":"requested path is invalid"}`. Root cause is **not** in the client code (the client builds `emailRedirectTo` from `window.location.origin`, which always includes the scheme) — it's a Supabase **dashboard misconfiguration**: when the client's `emailRedirectTo` is not on the allow-list, Supabase silently falls back to the dashboard's Site URL, and if Site URL is set as a bare hostname (no `https://`), it gets resolved as a relative path on the Supabase host. That's exactly the broken URL shape observed.
- [auth/auth.js](auth/auth.js) `signInWithEmail()` now validates `emailRedirectTo` starts with `http(s)://` before calling `signInWithOtp()` — a future code regression that drops the scheme will throw a clear error instead of producing a confusing magic link. Inline comments document the Supabase dashboard requirement.
- [AUTH-SETUP.md](AUTH-SETUP.md) §7 ("If something goes wrong") expanded with a dedicated entry describing this exact failure mode and the two dashboard checks needed (Site URL with scheme, Redirect URLs allow-list including `/auth/callback`).
- **Dashboard action required (out of repo):** Confirm Supabase project `yxndmpwqvdatkujcukdv` → Authentication → URL Configuration has Site URL = `https://www.crawford-coaching.ca` (with scheme) and Redirect URLs allow-list includes `https://www.crawford-coaching.ca/auth/callback`. The code fix above is preventative; the live bug is fixed by this dashboard change.

### Fixed — Trailing NUL byte corruption in three files

- Stripped trailing NUL-byte padding (content was intact, NULs were after the final newline) from [CLAUDE.md](CLAUDE.md) (73 NULs, file went 12137 → 12064 bytes), [README.md](README.md) (39 NULs, 11935 → 11896 bytes), and [robots.txt](robots.txt) (5 NULs, 83 → 78 bytes). `file(1)` now identifies all three as plain text again instead of partly-binary `data`. Same pattern seen and cleaned earlier in this session in [crawford-growth-zone.html](crawford-growth-zone.html).

### Changed — scottmountain image moved into extracted-images/

- `scottmountain.webp` and `scottmountain.jpg` moved from repo root to [extracted-images/](extracted-images/) (via `git mv` so history is preserved), matching the convention documented in [README.md](README.md) that site image assets live under `extracted-images/` with paired `.jpg` + `.webp` files.
- Three references repointed to the new path:
  - [crawford-growth-zone.html](crawford-growth-zone.html) `og:image` → `https://www.crawford-coaching.ca/extracted-images/scottmountain.webp` (this supersedes the earlier short-lived "fix" in this session that moved the URL to the root path).
  - [crawford-about.html](crawford-about.html) JSON-LD `image` field → `https://www.crawford-coaching.ca/extracted-images/scottmountain.webp`.
  - [crawford-about.html](crawford-about.html) `<img class="about__photo">` → `./extracted-images/scottmountain.webp`.

### Fixed — Canonical domain

- Canonical domain corrected from `crawford-coaching.com` to `crawford-coaching.ca` across the repo. Affected files: [AUTH-SETUP.md](AUTH-SETUP.md), [CLAUDE.md](CLAUDE.md), [README.md](README.md), [sitemap.xml](sitemap.xml), [crawford-growth-zone.html](crawford-growth-zone.html) (canonical, og:url, og:image), [crawford-synergize-members.html](crawford-synergize-members.html) (`mailto:` addresses). 46 occurrences in total. The contradictory "legacy domain" lines in CLAUDE.md and README.md were also removed.
- Auth-setup recommendations updated: Supabase Site URL is now `https://www.crawford-coaching.ca`, redirect URL is `https://www.crawford-coaching.ca/auth/callback`, and the suggested Resend sender is `notifications@crawford-coaching.ca`.
- [robots.txt](robots.txt) replaced (the previous file was a corrupted 83-byte binary, not a valid robots file). New content allows all crawlers and points to the `.ca` sitemap.

## [2026-05-19]

### Added — Phase 1 Auth Foundation

First slice of the platform rebuild: magic-link auth, role resolution, and a gated Synergize Members Area. Synergize members are the first live auth users. Reference: `growth-zone-spec-v1.2.md` plus `platform-auth-chat-summary.md`.

- Supabase schema migration in [migrations/2026-05-auth-foundation.sql](migrations/2026-05-auth-foundation.sql):
  - `auth_user_id`, `tier`, and active-status booleans (`synergize_active`, `coaching_active`, `whole_active`, `growth_zone_subscribed`, `whole_alumni_claimed`, `whole_alumni_claim_date`) added to `public.contacts` (idempotent).
  - Trigger on `auth.users` INSERT that links the new auth user to the existing contacts row by email, or inserts a minimal contact at tier `public`.
  - RLS enabled on `contacts`; authenticated users can SELECT their own row only.
- New Vercel function [api/auth-config.js](api/auth-config.js) — returns `SUPABASE_URL` + `SUPABASE_ANON_KEY` to the browser.
- New Vercel function [api/member-data.js](api/member-data.js) — verifies a Supabase access token and proxies `class_schedule`, `workout_of_the_day`, and `holiday_schedule` actions through `data-handler`. Degrades gracefully when those actions aren't yet implemented.
- New shared browser auth helper [auth/auth.js](auth/auth.js) — wraps Supabase JS, exposes `cc.signInWithEmail`, `cc.completeCallback`, `cc.getRole`, `cc.signOut`, etc. Role resolution follows spec v1.3 §5.2 precedence.
- New page [crawford-sign-in.html](crawford-sign-in.html) at `/sign-in` — magic-link request form with success state. Auto-redirects already-signed-in users by resolved role.
- New page [crawford-auth-callback.html](crawford-auth-callback.html) at `/auth/callback` — exchanges the magic-link tokens, scrubs them from the URL, redirects to the surface inferred from `?next=` or resolved role.
- New page [crawford-synergize-members.html](crawford-synergize-members.html) at `/synergize/members` — gated members area with class schedule, WOD, holiday hours, timer, and a Growth Zone cross-promo. Gate denies non-active members with a friendly explanation. Sign Out lives in the nav.
- Added clean rewrites in [vercel.json](vercel.json) for `/sign-in`, `/auth/callback`, and `/synergize/members`.
- Setup checklist [AUTH-SETUP.md](AUTH-SETUP.md) — SQL migration, Supabase Auth + SMTP, Vercel env vars, smoke-test walk-through.

### Changed

- [crawford-synergize.html](crawford-synergize.html) gained a **Member Login** link in the desktop nav (between the page links and the Book Intro CTA) and in the mobile overlay. Routes to `/sign-in?next=/synergize/members`.
- [crawford-growth-zone.html](crawford-growth-zone.html) rebuilt as a marketing landing with three-tier architecture per spec v1.3:
  - New hero with Wheel of Life as the primary "Start here" CTA (route exists in nav but the page itself is the next build).
  - Three side-by-side tier cards: **Open** (Wheel + Timer), **With Email** (Core Values, Strengths, Feelings), **Subscription** (Motivation, Optimism, Task Triage, AI reports, longitudinal tracking, advanced builder). Locked tools are surfaced as locked previews with "Soon" tags.
  - Tier-aware re-render driven by [auth/auth.js](auth/auth.js): anonymous visitors see the marketing landing + email capture form; email-captured / Synergize visitors see an "unlocked" state with direct CTAs to their tools; paid subscribers see the full-access state. Sign In / Sign Out swap in the nav based on session.
  - Email capture form posts to `/api/subscribe` with `offer: growth-zone` and `subscriptions: { newsletter, growth_zone }` so the data-handler records both intents.
  - Pricing transparency section names the Synergize 30%-off-monthly, coaching-bundled, and WHOLE-bundled rules without committing to a number.
  - Philosophy note from the previous page preserved (these aren't formal assessments).
  - SEO meta block extended: description, canonical, OG, Twitter Card, og:image.

### Notes

- All writes still go through `data-handler` via service-role; the site never touches Postgres directly. The browser uses the public anon key + RLS to read its own contacts row.
- Auth is opt-in for now: only `/synergize/members` is actually gated. Existing public pages are unchanged.

## [2026-04-15]

### Added
- Added a shared favicon link (`/timer-favicon.png`) across site pages and writing article pages for consistent browser tab branding.
- Updated [scripts/publish-writing-article.js](scripts/publish-writing-article.js) so newly generated writing article pages include the shared favicon automatically.

### Changed
- Refreshed primary logo assets for cleaner edge rendering and improved dark-background legibility:
  - [cc-logo.png](cc-logo.png)
  - [extracted-images/cc-logo.png](extracted-images/cc-logo.png)
- Increased site-wide dark-theme text contrast by updating shared color tokens across pages and generator templates:
  - `--mist: #7a8fa3` → `#a4b6c8`
  - `--pale: #c8d4de` → `#dde8f2`
  - `--white: #f5f3ef` → `#ffffff`
- Temporarily disabled the header "Start Here" CTA visuals while preserving underlying markup and links for quick re-enable later:
  - [crawford-homepage.html](crawford-homepage.html) desktop nav CTA and mobile overlay CTA now use the native `hidden` attribute.
  - [crawford-assistant.html](crawford-assistant.html) desktop nav CTA and mobile overlay CTA now use the native `hidden` attribute.

### Fixed
- Replaced corrupted/encrypted [sitemap.xml](sitemap.xml) with a valid XML sitemap and expanded URL coverage to match current clean routes and writing pages (32 URLs total).

## [2026-04-30]

### Added
- Added [api/unsubscribe.js](api/unsubscribe.js) to process newsletter unsubscribe links using `?r={recipient_id}` and complete unsubscribes through the mail tracker backend.

### Changed
- Updated [crawford-unsubscribe.html](crawford-unsubscribe.html) to auto-handle unsubscribe links with an `r` query param:
  - Hides the email lookup step while processing.
  - Shows clear success/fallback states.
  - Falls back to manual email preference lookup if token processing fails.

## [2026-04-09]

### Changed
- Restructured Growth Zone page into two distinct groups:
  - **Personal Growth Exercises** (Core Values, Character Strengths, Motivation, Optimism) with "Guided self-reflection" subtitle.
  - **Tools** (Interval Timer, Feelings Naming Guide) with "Practical resources" subtitle.
  - Added insight callout encouraging users to complete more exercises for richer cross-exercise reports.
  - Demoted card headings from `<h2>` to `<h3>` (group headers are now `<h2>`).
- Improved assistant page mobile layout in [crawford-assistant.html](crawford-assistant.html):
  - Collapsed header on mobile (hidden subtitle and "Open in New Tab" link).
  - Applied `calc(100dvh)` sizing to the iframe for maximum chat area.
  - Hidden footer on small screens (≤600px) to maximise chat space.

### Removed
- Removed redundant `chat-widget.js` embed from [crawford-assistant.html](crawford-assistant.html) — the floating widget is unnecessary on the dedicated assistant page.

## [2026-04-03]

### Added — SEO Improvements
- Meta descriptions added to [crawford-homepage.html](crawford-homepage.html), [crawford-coaching.html](crawford-coaching.html), and [crawford-about.html](crawford-about.html).
- `sitemap.xml` created with 29 URLs (14 main pages + 15 blog posts), priority-weighted.
- `robots.txt` created with `Allow: /` and sitemap reference.
- Open Graph and Twitter Card meta tags added to [crawford-homepage.html](crawford-homepage.html), [crawford-coaching.html](crawford-coaching.html), and [crawford-about.html](crawford-about.html).
- Canonical URL (`<link rel="canonical">`) added to [crawford-homepage.html](crawford-homepage.html), [crawford-coaching.html](crawford-coaching.html), and [crawford-about.html](crawford-about.html).
- JSON-LD structured data added:
  - `Organization` schema on [crawford-homepage.html](crawford-homepage.html).
  - `Service` with `OfferCatalog` (4 coaching packages) on [crawford-coaching.html](crawford-coaching.html).
  - `Person` with credentials (ICF ACC, ISSA CPT) on [crawford-about.html](crawford-about.html).

### Changed — SEO Improvements
- Improved homepage `<title>` from generic to keyword-rich.
- Converted hero sections from CSS `background-image` to `<img>` tags with descriptive `alt` text on [crawford-homepage.html](crawford-homepage.html) and [crawford-coaching.html](crawford-coaching.html) for crawlability and accessibility.
  - Preserved zoom animation on homepage hero.
  - Wide-screen breakpoint on coaching hero uses `object-fit: contain` with `object-position: 60% center`.
- Fixed heading hierarchy (H2 → H3) for card/article titles across:
  - [crawford-homepage.html](crawford-homepage.html) (3 door titles).
  - [crawford-coaching.html](crawford-coaching.html) (4 package questions).
  - [crawford-writing.html](crawford-writing.html) (3 featured post titles).
  - [crawford-writing-all.html](crawford-writing-all.html) (15 archive post titles).
  - Build scripts updated to emit `<h3>` for future articles: [scripts/publish-writing-article.js](scripts/publish-writing-article.js), [scripts/rebuild-writing-hub.py](scripts/rebuild-writing-hub.py).
- Converted all site JPG images to WebP (quality 82) for improved page speed:
  - `homepage-001`, `homepage-002`, `homepage-003`, `homepage-005`, `coaching-001`, `synergize-002`, `synergize-003`, `scottmountain`.
  - Updated all `<img>` and CSS `background-image` references across [crawford-homepage.html](crawford-homepage.html), [crawford-coaching.html](crawford-coaching.html), [crawford-synergize.html](crawford-synergize.html), [crawford-about.html](crawford-about.html), and [crawford-whole.html](crawford-whole.html).
  - File size savings ranged from 6% to 39% (average ~20%).

### Fixed
- Synergize page timer link updated from old standalone Vercel deployment URL to internal `/timer` route in [crawford-synergize.html](crawford-synergize.html).

## [Unreleased]

### Added
- Added rebuild support to the writing publish workflow in [scripts/publish-writing-article.js](scripts/publish-writing-article.js):
  - `readAllArticles()` to load and sort all imported articles.
  - `rebuildWritingHub()` to regenerate the canonical top-3 Writing preview section.
  - `rebuildArchivePage()` to regenerate [crawford-writing-all.html](crawford-writing-all.html) with all published posts.
  - `--rebuild-only` mode to refresh Writing pages without publishing a new article.
- Added keyword `tags` frontmatter to all imported article markdown sources in [writing-import/](writing-import/) for archive filtering and metadata consistency.
- Added local writing import automation script [scripts/publish-writing-article.js](scripts/publish-writing-article.js) to ingest a markdown source file and:
  - Generate a new article page (`blogs/crawford-writing-<slug>.html`).
  - Insert a new post card on [crawford-writing.html](crawford-writing.html).
  - Add a matching clean route rewrite in [vercel.json](vercel.json).
- Added legacy importer [scripts/import-legacy-blog-html.js](scripts/import-legacy-blog-html.js) for scraped GoDaddy-style blog exports containing `window._BLOG_DATA`.
- Added source template for future imports: [writing-import/article-template.md](writing-import/article-template.md).
- Replaced Writing placeholder with an SEO-oriented writing hub in [crawford-writing.html](crawford-writing.html), including:
  - Blog listing card with image thumbnail.
  - Sidebar subscribe form.
  - Built-in share links for article and page distribution.
  - Structured data (`Blog`) and social metadata (`og:*`, `twitter:*`).
- Added first imported article page [blogs/crawford-writing-1-need-beneath-the-want.html](blogs/crawford-writing-1-need-beneath-the-want.html) with:
  - Rewritten long-form HTML content matched to site styling.
  - Article SEO metadata and `BlogPosting` structured data.
  - On-page share actions (copy link, LinkedIn, Facebook, X, email).
- Added writing thumbnail asset [extracted-images/writing-1-need-beneath-the-want.webp](extracted-images/writing-1-need-beneath-the-want.webp) sourced from [blogs/Blog Import/1.webp](blogs/Blog Import/1.webp).
- Embedded floating "Ask Scott" assistant widget on all main site pages via external script:
  - [crawford-homepage.html](crawford-homepage.html)
  - [crawford-coaching.html](crawford-coaching.html)
  - [crawford-whole.html](crawford-whole.html)
  - [crawford-synergize.html](crawford-synergize.html)
  - [crawford-growth-zone.html](crawford-growth-zone.html)
  - [crawford-about.html](crawford-about.html)
  - [crawford-contact.html](crawford-contact.html)
  - [crawford-writing.html](crawford-writing.html)
  - [crawford-timer.html](crawford-timer.html)
  - Script source: `https://website-assistant-sandy.vercel.app/chat-widget.js`
- Integrated timer page and route on main site deployment:
  - [crawford-timer.html](crawford-timer.html)
  - `/timer` rewrite in [vercel.json](vercel.json)
- Timer runtime support files with namespaced filenames:
  - [timer-emom-db.js](timer-emom-db.js)
  - [timer-manifest.json](timer-manifest.json)
  - [timer-sw.js](timer-sw.js)
  - [timer-favicon.png](timer-favicon.png)
  - [timer-icon-192.png](timer-icon-192.png)
  - [timer-icon-512.png](timer-icon-512.png)
  - [timer-brand.png](timer-brand.png)
- Added editable timer exercise source file [exercises.csv](exercises.csv) and sync script [scripts/sync-timer-data.js](scripts/sync-timer-data.js).
- Phase 2 baseline mobile safety block added to all 8 content pages:
  - [crawford-homepage.html](crawford-homepage.html)
  - [crawford-coaching.html](crawford-coaching.html)
  - [crawford-whole.html](crawford-whole.html)
  - [crawford-synergize.html](crawford-synergize.html)
  - [crawford-growth-zone.html](crawford-growth-zone.html)
  - [crawford-about.html](crawford-about.html)
  - [crawford-contact.html](crawford-contact.html)
  - [crawford-writing.html](crawford-writing.html)
- Phase 2 refinement pass completed across all 8 content pages with page-specific layout cleanup for mobile widths.

### Changed
- Updated writing pages to canonical layout behavior:
  - [crawford-writing.html](crawford-writing.html) now consistently shows top 3 most recent posts, search in-view, and a View All route.
  - [crawford-writing-all.html](crawford-writing-all.html) now consistently renders all imported posts from source metadata.
- Fixed archive thumbnail pathing in [crawford-writing-all.html](crawford-writing-all.html) from relative blog paths to root paths so images resolve correctly from `/writing/all`.
- Standardized branding logo asset to `cc-logo.png` across user-facing pages:
  - Renamed timer asset `timer-brand.png` to `cc-logo.png`.
  - Updated logo references across top-level pages and published article pages.
  - Updated generated article template logo references in [scripts/publish-writing-article.js](scripts/publish-writing-article.js).
- Updated homepage WHOLE product-door heading text in [crawford-homepage.html](crawford-homepage.html) from `Whole` to `WHOLE` for product-name consistency.
- Added clean rewrite route in [vercel.json](vercel.json) for `/writing/1-the-need-beneath-the-want`.
- Updated existing Growth Zone timer entry point in [crawford-growth-zone.html](crawford-growth-zone.html) to use internal `/timer` route.
- Added image overflow safety via `img { max-width: 100%; }` across all pages.
- Added touch-target minimum sizing (44px) for major CTAs, buttons, and mobile overlay CTAs.
- Added input minimum sizing and readable mobile font sizing for form-heavy pages.
- Added mobile label/readability floor for utility labels and footer metadata.
- Updated hero viewport behavior on hero-driven pages at mobile widths:
  - Switch from fixed `height: 100vh` behavior to mobile-safe `height: auto` with clamped `min-height`.
- Improved mobile overlay menu accessibility by moving focus off hidden overlay links before applying `aria-hidden`, then returning focus to the menu toggle.
- Increased mobile hamburger toggle hit area to `44px × 44px` across all pages.
- Refined page-specific mobile layout behavior:
  - Homepage hero actions, door card heights, and signup layout.
  - Coaching package headers, metadata layout, and CTA sizing.
  - WHOLE hero actions, question bridge spacing, capture form, and footer alignment.
  - Synergize phase timeline layout, quote spacing, and tool callout CTA sizing.
  - Contact page column collapse timing, action widths, and signup stacking.
  - Growth Zone card grid minimums, card padding, and footer alignment.
  - About page photo framing and CTA width.
  - Writing page spacing, supporting text size, and CTA width.

### Validated
- No editor diagnostics errors reported after Phase 2 baseline and refinement updates.
- Browser-driven validation passed on all 8 pages for mobile nav open/close behavior, Escape handling, link-click close behavior, and ARIA state sync with no `Blocked aria-hidden` warnings.
- Generated per-page QA screenshots in [qa-screenshots](qa-screenshots) for visual inspection.

### Next
- Manual live QA on deployed Vercel routes to confirm real-device behavior.
- Extend SEO meta/OG/canonical/JSON-LD coverage to remaining pages (WHOLE, Synergize, Growth Zone, Contact, Timer, individual blog posts).

## [2026-03-30]

### Added
- New Character Strengths page [crawford-strengths.html](crawford-strengths.html) with a VIA-style 48-question quiz, 3-screen flow (intro → quiz → results), full site navigation, footer, and chat widget.
- New Core Values exercise page [crawford-core-values.html](crawford-core-values.html) with full site navigation and footer.
- Clean URL rewrites added to [vercel.json](vercel.json) for `/strengths` and `/core-values`.
- Character Strengths and Core Values cards activated on [crawford-growth-zone.html](crawford-growth-zone.html) (removed coming-soon state, linked to live pages).
- Converted inline subscribe forms to Mailchimp JSONP on:
  - [crawford-homepage.html](crawford-homepage.html)
  - [crawford-contact.html](crawford-contact.html)
  - [_Coach-Scott-Bot/widget-preview.html](_Coach-Scott-Bot/widget-preview.html)

### Fixed
- Centred strengths quiz screens by adding `display: flex; flex-direction: column` to `.intro`, `.quiz`, and `.results` in [crawford-strengths.html](crawford-strengths.html).

## [2026-03-27]

### Added
- Mobile hamburger navigation on all 8 content pages:
  - [crawford-homepage.html](crawford-homepage.html)
  - [crawford-coaching.html](crawford-coaching.html)
  - [crawford-whole.html](crawford-whole.html)
  - [crawford-synergize.html](crawford-synergize.html)
  - [crawford-growth-zone.html](crawford-growth-zone.html)
  - [crawford-about.html](crawford-about.html)
  - [crawford-contact.html](crawford-contact.html)
  - [crawford-writing.html](crawford-writing.html)
- New mobile nav components added per page:
  - `.nav__toggle` hamburger button.
  - `.nav__overlay` fullscreen menu.
  - Per-page overlay CTA and active-link state.
- Accessibility and interaction improvements:
  - `aria-expanded` and `aria-hidden` state syncing.
  - Escape key closes menu.
  - Menu closes when a nav link is selected.
  - Body scroll lock while menu is open.
  - Focus-visible outlines on toggle and overlay links.

### Changed
- Unified mobile nav behavior at `max-width: 900px`:
  - Desktop nav links/CTA hidden.
  - Hamburger toggle shown.
- Removed conflicting legacy `nav__links` hide declarations where they overlapped with new nav logic.

### Validated
- No editor diagnostics errors reported in all updated pages after nav implementation.
