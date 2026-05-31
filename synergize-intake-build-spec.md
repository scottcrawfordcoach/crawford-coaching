# Synergize Fitness — Digital Intake System
## Build Handoff Specification

> **Purpose:** Hand this to a build assistant (Cowork or VS Code) to implement the digital member intake: Health Screen, Liability Waiver, and Group Training Policies. Members complete these inside the authenticated Synergize members area; each completion is stored as a defensible record in Supabase and a copy-of-record PDF is emailed to the member automatically.
>
> **Status of this doc:** Planning + decisions. The build assistant writes the SQL and TypeScript. Everything needed to make consistent choices is captured here. Items the build assistant should decide *by inspecting the existing repo/schema* are flagged **[DECIDE IN REPO]**.

---

## 0. Context the build assistant needs

- **Stack:** Supabase (Postgres + Edge Functions, Deno/TypeScript) · Next.js on Vercel · existing magic-link auth already functioning in the members area.
- **Existing Supabase project ID:** `yxndmpwqvdatkujcukdv`
- **Existing tables (do not duplicate, link to these):** `contacts`, `contact_tags`, `enrollment`, `engagements`, plus mailer tables (`sent_campaigns`, `campaign_recipients`, `campaign_events`).
- **Existing Edge Functions:** `data-handler` (CRM gateway), `faq-bot`, `mail-sender`, `mail-tracker`, `mail-webhook`.
- **Existing delivery path:** branded email already sends via `mail-sender` + Gmail SMTP (Google Workspace). The intake copy-of-record should reuse this path, not invent a new mailer.
- **Auth model:** members authenticate via magic link; the session provides a trusted user identity. Records are written server-side from the session — **never trust a client-supplied identity for who signed.**

**[DECIDE IN REPO]** Confirm how the current members-area session exposes identity (Supabase Auth `user_id`? a `contacts` row id? an email claim?). Everything below assumes a resolvable link from session → `contacts` row. Wire the actual mechanism to match what already exists.

---

## 1. What the system must capture (decision-locked)

These data requirements are settled regardless of table structure. They exist because the legal robustness of a digital waiver in Ontario comes from recordkeeping, version control, clear consent, and provable agreement — not from the checkbox itself.

### Every completed document record must store:
- **Who:** linked `contact_id` / `user_id`, resolved server-side from the session (not from form input).
- **What:** which document (`doc_type`) and which **version** of it (`doc_version`, e.g. `1.0`).
- **Integrity:** a **hash of the exact text shown** at signing (`doc_text_hash`) — proves what wording the member actually agreed to, even if the canonical text later changes.
- **When:** `signed_at` timestamp (server time, UTC).
- **From where:** `ip_address` and `user_agent` (audit trail).
- **Proof of agreement:** the per-clause / per-question affirmations (see each doc below), the typed-name signature where applicable, and acceptance booleans.
- **Delivery record:** whether/when the copy-of-record email was sent (`record_emailed_at`, nullable) and a pointer to the stored PDF (`pdf_storage_path`).

### Versioning model (locked)
- The three documents as finalised = **v1.0**. The canonical text lives in the repo (see §6) and is the source of truth.
- A `doc_version` field on every record stores which version that member agreed to.
- Any future wording change increments the version (`1.1`, `2.0`). The version field + text hash together let you prove, for any member, exactly what they agreed to and when.
- **Re-consent:** when a doc version bumps, existing members are considered out-of-date for that doc (see §4 gating + §7 re-consent campaign).

### `doc_type` enum (locked, with forward room)
- `health_screen`
- `liability_waiver`
- `group_policies`
- *(reserved for future, not built now: `online_activity_disclaimer` — the Crawford Coaching Growth Zone self-directed disclaimer. Build the enum/type field so this slots in without migration.)*

---

## 2. Table structure — **[DECIDE IN REPO]**

This is the main decision to make against the existing schema, not in the abstract.

**Two viable shapes:**

**Option A — one `intake_submissions` table, typed by `doc_type`.**
All three docs write rows to one table. Shared columns (who/what/when/where/version/hash/pdf) are identical across types; the type-specific payload lives in a `responses jsonb` column.
- *Pros:* one place to query "is this member fully current?", less duplication, the `doc_type` enum already anticipates the future online disclaimer, simplest gating logic.
- *Cons:* the health-screen structured data and the waiver clause-checks live in `jsonb` rather than typed columns; slightly less rigid.

**Option B — separate tables (`waivers`, `health_screens`, `policy_acknowledgements`).**
- *Pros:* each can have typed columns suited to its shape (esp. the health screen's many fields); cleaner if the health screen will be queried/reported on heavily.
- *Cons:* triplicates the who/what/when/version/hash/pdf scaffolding; "is the member current on all three?" becomes a 3-table join.

**Recommendation:** Lean **Option A** unless the existing schema strongly favours separate tables, *with one carve-out* — the health screen's structured responses are clinical-ish and may warrant either typed columns or a well-defined `jsonb` schema regardless. The deciding factor is how the rest of this Supabase project is modelled: **match the existing convention.** If `engagements`/`enrollment` already use a typed-row + jsonb-payload pattern, use Option A. If the project favours narrow purpose-built tables, Option B fits better.

**Whichever is chosen, the §1 capture requirements are mandatory on every record.**

---

## 3. Per-document data shape

### 3a. Health Screen (`health_screen`) — store full structured responses
Locked decision: **store the actual answers**, not just completion. Reason: the answers are coaching-critical (injuries, conditions, goals) and they're the disclosure that the waiver's "accuracy of disclosure" clause relies on. The two documents reference each other; the screen IS the disclosure.

Structured payload:
- **Details:** name, email (both pre-filled from account, editable, stored as submitted), age, sex, height.
- **Part A — Activity Readiness:** 7 questions, each `true`/`false` (yes/no). Store as an ordered array or keyed object `a1..a7` so question text maps to the versioned doc.
- **`flagged` (boolean):** computed — `true` if any Part A answer is "yes". This is the operational trigger (see §5).
- **Part B — Health History:** the set of conditions, each selected/not, plus a free-text "other".
- **Part C — Injury Screen:** per body area (neck, shoulder L/R, hip L/R, knee L/R, ankle L/R, lower back, other), one of: none / acute (strain-sprain) / chronic.
- **Part D — Goals (free text):** current activity; goals / "what can I do to help you"; anything else.

**Renewal:** health screens expire. Add `expires_at` = `signed_at + 12 months` (annual renewal is the common standard). Gating (§4) treats an expired screen as not-current.

**Sensitivity:** this is health information. RLS is mandatory (see §4). Member reads only their own; only `admin` (Scott) reads others. Flagged screens especially must not be broadly readable.

### 3b. Liability Waiver (`liability_waiver`) — per-clause affirmation
Locked decision: **per-clause checkboxes**, the digital equivalent of initialling each paragraph. Stronger evidence than one blanket checkbox.

Payload:
- **7 clauses**, each stored as an explicit `true` affirmation with the clause key (`voluntary_participation`, `accuracy_of_disclosure`, `non_disclosure`, `assumption_of_risk`, `supervision_questions`, `following_safety_guidance`, `termination`). All 7 must be `true` to submit.
- **Typed-name signature:** `signature_name` (string).
- The **assumption-of-risk clause** is the legally load-bearing one — it is visually elevated in the UI and carries the explicit risk enumeration. (Text in §6.)
- No witness field (deliberately dropped — a logged digital flow is stronger than a friend's witness signature).

### 3c. Group Policies (`group_policies`) — single acknowledgement
Payload:
- One acknowledgement boolean (`acknowledged: true`), must be true to submit.
- This is a policies acknowledgement, not a waiver — kept as a separate record because policies (pricing, cancellation) update on a different cadence than the waiver or screen.

---

## 4. Row Level Security (intent — **[DECIDE IN REPO]** exact policy SQL)

RLS is **mandatory**, especially for the health screen. Intent:

- **Member (role `client`/`subscriber`):** may `INSERT` their own records (where the row's `user_id` = their session identity) and `SELECT` only their own records. No `UPDATE`/`DELETE` on signed records — these are immutable once written (a signed record must not be editable after the fact, or its evidentiary value collapses).
- **Admin (Scott):** may `SELECT` all records (needed to review flagged screens, confirm current status, run re-consent). Whether admin can `UPDATE`/`DELETE` — **[DECIDE IN REPO]**; recommend no destructive ops on signed records even for admin (append-only; corrections happen via a new versioned record, not by editing history).
- **Edge Function (service role):** writes records server-side. The service-role key bypasses RLS by design — so the **identity resolution must happen in the function from the verified session**, never from client input.
- **Immutability:** consider a DB-level guard (trigger or revoked update grant) so signed records can't be silently altered. This matters for the "provable agreement" requirement.

**[DECIDE IN REPO]** Align role names (`admin`/`client`/`subscriber`) with whatever the existing auth setup already uses. Don't invent new role names if the project already has them.

---

## 5. Operational: flagged screens + "is the member current?"

### Flagged health screens
- When `flagged = true` (any Part A "yes"), the screen needs Scott's review before the member is cleared to train.
- Add review fields: `reviewed_by` (nullable), `reviewed_at` (nullable), `review_note` (nullable).
- **Admin view:** a simple list of flagged-and-unreviewed screens. This is the one piece of admin UI that genuinely matters operationally — a "yes" on a cardiac question should not just sit silently in a table.

### "Current member" status (gating logic)
A member is **cleared to train** when ALL of:
- A `liability_waiver` record exists at the **current** version.
- A `group_policies` record exists at the **current** version.
- A `health_screen` record exists, at current version, **not expired** (`expires_at > now()`), AND (if flagged) reviewed.

**Gating UX (recommended, soft wall):** on members-area entry, if not cleared, route to the intake flow before other features. Stronger for liability than a passive request — no active member trains without current, unexpired, signed docs on file.

**[DECIDE IN REPO]** Where the gate lives (middleware, layout guard, route check) depends on the existing Next.js members-area structure. Implement to match.

---

## 6. Canonical document text (v1.0 — source of truth)

> The build assistant should store these as versioned content in the repo (e.g. `intake/v1.0/health_screen.md`, `liability_waiver.md`, `group_policies.md`). The **text hash** stored on each record is computed from the exact rendered text of the version the member saw. Keep the rendered text and the hash source identical.

### Health Screen v1.0

**Part A — Activity Readiness** (yes/no each):
1. Has a doctor ever told you that you have a heart condition, or that you should only do physical activity under medical supervision?
2. Do you experience chest pain when you are physically active?
3. In the past month, have you had chest pain when you were not being physically active?
4. Do you ever feel faint, lose your balance from dizziness, or lose consciousness?
5. Do you have a bone or joint problem that could be worsened by exercise?
6. Are you currently taking any medication prescribed for blood pressure or a heart condition?
7. Are you aware of any other reason you should not take part in physical activity?

Flag note shown if any "yes": *If you answered "yes" to any of the above: we ask that you speak with your doctor before beginning, and let your coach know. This isn't a barrier to training — it just helps us coach you safely and adapt where needed.*

**Part B — Health History** (each yes/no): High or low blood pressure · History of heart disease · Heart disease · Diabetes · Asthma · Weight concerns · Osteoporosis · Arthritis · Fibromyalgia · Pregnancy · Depression · Other (describe).

**Part C — Injury Screen** (per area — none/acute/chronic): Neck · Shoulder L/R · Hip L/R · Knee L/R · Ankle L/R · Lower back · Other.

**Part D — Goals** (free text): current activity/training; goals + how can I help; anything else.

### Liability Waiver v1.0

*Please confirm you have read and agree to each item below, then sign.*

**Voluntary participation.** I am taking part in physical activity with Synergize Fitness of my own free will. I confirm that I am physically able to participate, and that where the health screen indicated I should seek medical advice, I have done so or accept responsibility for choosing to proceed.

**Accuracy of disclosure.** I confirm that the information in my Synergize Fitness Health Screen is accurate and complete, and that I have disclosed all medical conditions, previous and current injuries, and any other issues that could be made worse by a guided fitness program, before beginning physical activity.

**Non-disclosure.** I understand that Synergize Fitness, its coaches and staff cannot be held liable for injuries or complications arising from a pre-existing condition, injury, or medical issue that I failed to disclose.

**Assumption of risk.** *(Displayed conspicuously — elevated styling, "please read carefully" flag.)* I understand that physical activity and fitness training carry inherent risks, and that these risks include — but are not limited to — muscle, joint, and ligament injuries; aggravation of pre-existing or undisclosed conditions; cardiac events; and, in rare cases, serious injury or death. I voluntarily accept these risks as a condition of participating. I agree that my coach, Synergize Fitness, and anyone associated with it will not be liable for injury, loss, or damage arising from my participation in physical and athletic training with Synergize Fitness, except where caused by gross negligence.

**Supervision and questions.** I recognize that Synergize Fitness operates an open-floor training program with a coach present to assist and supervise at all times. I understand it is my responsibility to raise any questions, comments, or concerns about specific exercises, and to seek guidance when I want it.

**Following safety guidance.** I agree to follow the reasonable safety-related guidance of Synergize Fitness staff — including direction on exercise form, technique, and the safe performance of movements — recognizing that this guidance exists to keep me and others safe while I train at my own pace and ability.

**Termination of membership.** I understand that Synergize Fitness reserves the right to end any membership at the owner's discretion.

Signature: typed full name + auto-dated.

### Group Training Information & Policies v1.0

Welcome to Synergize Fitness. We combine training with coaching principles to make exercise accessible, sustainable, and fun.

In our boutique, private gym space, we run small groups of up to eight people per session — occasionally extended in fair weather, when we can make good use of the outdoor space. The social side is an important part of building exercise into your life for good, and we work hard to build a strong group dynamic.

While clients may have personal goals to work on, the main focus of these sessions is regular, mobility-based strength and conditioning for healthy living — we don't generally track performance metrics.

Workouts are posted for each session, but these are not classes where you need to keep up with the group. You're welcome to train at your own pace and do what you can on any given day. Instruction, modifications, and correction are offered as needed.

**Payments and refunds**
- Sessions are billed monthly, in advance.
- With limited space, a pay-per-session model isn't generally practical.
- E-transfer is preferred, but cheques or cash are also welcome.
- Accountability to yourself and the group matters — missed sessions are forfeit.
- If Synergize Fitness cancels a session, it will be rescheduled, refunded, or deducted from the next month's invoice. We make every effort to avoid cancelling.
- Clients may request to skip a month and retain their place in the group, at Synergize Fitness's discretion.
- Clients may withdraw at any time and receive a refund for the remaining sessions that month.
- New clients who cancel after no more than three sessions are entitled to a full refund.

**Conduct**
- Treat others respectfully — this goes without saying.
- While friendly competition is sometimes welcome, Synergize Fitness is a non-competitive environment where everyone works at their own level and pace.
- We work hard to coach each client according to their needs; the right amount and type of coaching varies greatly from person to person and day to day. We respectfully ask that clients avoid coaching or correcting one another.
- Clients who don't conduct themselves respectfully, or who continually disrupt others' training, may be asked to leave the group. In that case, a refund is given for any remaining sessions.

Footer (copy-of-record): *Synergize Fitness · crawford-coaching.ca/synergize · scott@crawford-coaching.ca · 613-329-3114*

---

## 7. Edge Function contract (submit handler)

A single Edge Function (or one per doc type — **[DECIDE IN REPO]** to match `data-handler` conventions) handles intake submission. Recommended: mirror the existing `data-handler` gateway pattern.

**On submit, the function must (in order):**
1. **Verify the session** and resolve the trusted `contact_id`/`user_id` server-side. Reject if unauthenticated.
2. **Validate completeness:** waiver = all 7 clauses true + signature name present; policies = acknowledged true; health screen = required fields present. Reject incomplete.
3. **Compute** `flagged` (health screen) and `doc_text_hash` (hash of the exact version text).
4. **Capture** `ip_address`, `user_agent`, `signed_at` (server time).
5. **Write** the immutable record (service role).
6. **Generate the copy-of-record PDF** (see §8) and store to Supabase Storage (`pdf_storage_path`); set bucket private.
7. **Email the PDF** to the member via the existing `mail-sender` path; set `record_emailed_at`. (Locked decision: auto-email on submit.)
8. **Tag update (optional but recommended):** flip the member's CRM tag (e.g. `intake_2026_pending` → `intake_2026_complete`) to drive the re-consent campaign (§9) and the "current" status.
9. Return success + the cleared/flagged status to the client.

**Failure handling:** if PDF or email fails, the record must still persist (the signed record is the legal artifact; email is delivery). Log delivery failures for retry; don't lose the signature because SMTP hiccuped.

---

## 8. Copy-of-record PDF (locked: auto-emailed on submit)

The copy-of-record is a standalone artifact — it leaves the site, so it must be self-identifying and self-evidently a *completed* record, not a blank template.

**Must contain:**
- Synergize Fitness branding + full contact footer.
- Document name + **version** (e.g. "Liability Waiver v1.0").
- Member name + email.
- **The exact content agreed to** — for the waiver, the full clause text with each clause shown as affirmed; for the health screen, the member's actual responses; for policies, the acknowledged text.
- **Completion metadata:** "Completed electronically via the Synergize Fitness members area on [date/time], from [IP]." This line is what makes it read as a real signed record.
- Rendered **from the stored row**, so the PDF and the DB record are provably the same thing.

**Implementation note:** local Python tooling uses ReportLab, but this runs in a Deno Edge Function. **[DECIDE IN REPO]** options: render HTML→PDF (e.g. a headless approach or a Deno-compatible PDF lib), or hand off to a small serverless renderer. Reuse the mailer's branded HTML assets where possible. Output: one combined PDF of all three docs, or three attachments — recommend **one combined PDF per intake** for the member's convenience, with clear section breaks.

**Design:** this is the second presentation of the same brand — fuller footer + completion block vs. the lean on-site form. Same visual language as the mockup.

---

## 9. Re-consent campaign (existing members → updated docs)

Existing members need to complete the new digital docs (and any future version bump uses the identical mechanism):
1. Tag all active members `intake_2026_pending` in the CRM.
2. Send a branded campaign via the existing mailer asking them to log in and complete the intake.
3. On completion, the Edge Function flips the tag to `intake_2026_complete`.
4. Filter on the outstanding tag to send reminders only to non-completers.

This reuses existing mailer + CRM tag infrastructure — no new system.

---

## 10. Build sequence (recommended order)

1. **Schema** — create table(s) per the §2 decision, with §1 mandatory columns, §3 payloads, §5 review/expiry fields. Seed the `doc_type` enum (incl. reserved future type).
2. **RLS** — policies per §4. Test member-isolation and admin-read explicitly. Verify members cannot read others' health screens.
3. **Versioned text** — commit v1.0 docs (§6) to repo; build the hashing helper.
4. **Edge Function** — submit handler per §7, minus PDF/email (write + validate + flag + status first).
5. **Forms** — port the approved mockup into the members area as the lean on-site forms, wired to the function. (Mockup file: `synergize-forms.html` — current approved styling/interaction.)
6. **Gating** — "current member" logic + soft-wall routing per §5.
7. **Copy-of-record** — PDF generation + auto-email per §8. (Can land just after core submit works.)
8. **Flagged-screen admin view** — the one operational admin screen per §5.
9. **Re-consent campaign** — tag + mailer + tag-flip per §9.

Phases 1–6 deliver a working, storing, gated intake. 7–9 complete the loop.

---

## 11. Non-blocking external to-dos (not build tasks — Scott's)

- **Ontario legal review** of the waiver, focused on the assumption-of-risk clause and the deliberate gross-negligence concession. The digital design is sound; the wording is what gets scrutinised, read strictly against the business.
- **Register "Synergize Fitness"** as an Ontario business name before these documents are relied upon as naming a formal entity. (Until then, operating as Scott Crawford, sole proprietor, trading as Synergize Fitness.)
- **Optional build add:** scroll-through-before-accept on the waiver (disable affirmation until the clause has been scrolled into view) — kills the "I never saw it" argument. Optional for this risk level.

---

## 12. Decisions already locked (do not re-litigate)

- Three documents: Health Screen, Liability Waiver, Group Policies. In-person Synergize Fitness only for now.
- Entity name: **Synergize Fitness** throughout.
- Witness line: **removed.**
- Waiver: **per-clause affirmation** (7 boxes), typed-name signature.
- Assumption-of-risk: **expanded + conspicuous**, with explicit risk enumeration and gross-negligence carve-out.
- "Following safety guidance" clause: **narrowed** to reasonable safety-related guidance (not blanket obedience), to match the do-what-you-can coaching ethos.
- Policies: up to **eight** per session; no train-frequency line; contact = `crawford-coaching.ca/synergize` + `scott@crawford-coaching.ca`.
- Health screen: **store full structured responses.**
- Copy-of-record: **auto-email PDF on submit.**
- Identity: resolved **server-side from session**, never client-supplied.
- Records: **immutable** once signed; corrections via new versioned record.
- Future: online Crawford Coaching Growth Zone disclaimer is a **light general-information disclaimer**, reserved in the `doc_type` enum, **not built now.**
