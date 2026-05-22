# Platform Auth Planning — Chat Summary

> Working session on getting the Growth Zone behind an auth layer as the first concrete step toward a functional platform. Followed on from `PLATFORM-STRATEGY.md`.

---

## The real problem

The strategy doc is unusually clear. Phase 1 (Auth) is correctly identified as the keystone. This isn't a strategy problem — it's an execution capacity problem. Design energy and implementation energy are different fuels, and the loose-ends pattern isn't a budget or hiring issue, it's a **scope-too-big** issue.

The reframe: instead of "build auth and the Growth Zone behind it," break it into the smallest shippable piece. One tool, one table, one login flow, deployable this week. Once that works end-to-end, the rest is repetition.

---

## What's actually needed to move forward

Three concrete things, in natural order:

### 1. Auth on the Growth Zone — magic link

- Magic link is right for this audience: no password reset support, no friction, Supabase native.
- **Send via Resend, not Supabase's built-in SMTP** — keeps deliverability consistent on the warmed-up sending domain. Worth the 15 minutes upfront.
- Set 30-day sessions. Coaching isn't a banking app.

### 2. Tier and tool mapping

This is a product decision, not a technical one. The technical implementation is identical regardless of which tools land in which tier — just a flag on each tool. Don't let this block auth work.

A reasonable shape (subject to your call):

- **Open / no login** — one tool that demonstrates the methodology and creates the "I want to save this" moment. Probably Core Values or Strengths.
- **Free with login** — same tool now saves results, plus maybe one more. Email capture tier.
- **Subscriber / client** — the remaining tools, plus access to past results across all tools.

### 3. Access for current clients

- Decide which of the 164 contacts get free client-tier access. Probably the 32 billing-enabled, possibly some non-billing relationships.
- **Pre-create their auth accounts** using existing email addresses, then send a "your account is ready, click here" magic link email. They never set a password.
- Tag them as client-tier in the database.

The schema change to support this: a `tier` column on `contacts` (`public` / `subscriber` / `client`) and a `user_id` foreign key to `auth.users`. That's it.

---

## What you do NOT need yet

- Stripe / subscription billing — set tier flags manually until subscribers ask to pay
- Admin UI to manage users — Supabase dashboard is your admin UI
- Welcome sequences, onboarding flows, password reset, account deletion UX — magic link sidesteps most of this
- Separate `subscribers` table — `tier` flag on `contacts` is enough

---

## Minimum sequence to ship

1. Add `user_id` and `tier` columns to `contacts`. 30-second migration.
2. Enable Supabase Auth, configure magic link with Resend SMTP.
3. Script to create auth users for the 32 billing-enabled clients, linked by email to existing `contacts` rows. Run once, manually.
4. Build the login page in the Next.js app — Supabase UI library handles this in ~20 lines.
5. **Pick one Growth Zone tool. Wrap it in auth check. Save results to new `growth_zone_results` table with `user_id`. Deploy.** ← This is the proof point.
6. Repeat step 5 for remaining tools, gating each by tier flag.
7. Send "your account is ready" emails to the 32 clients.

Estimated 3–5 focused half-days with Copilot. The biggest risk isn't code — it's the moment in step 5 where something doesn't work and you're not sure if it's auth, RLS, or Next.js. Paste the error here and we work through it together.

---

## RLS — what's actually required

Less advanced than security-blog culture suggests, but more disciplined than "I'll add RLS later."

### The technical pattern

- Every table with user-specific data needs RLS enabled and policies.
- For starting scope, that's `growth_zone_results`: "users can SELECT/INSERT/UPDATE/DELETE rows where `user_id` equals their auth ID." Four lines of SQL per operation. Copilot writes it correctly.
- `contacts` is more nuanced because it serves both CRM (admin reads everyone) and user accounts (clients read their own row only). Two policies handle it.
- Two roles total: admin, authenticated user. That's the whole RLS surface area for the foreseeable platform.

### The trap to avoid

A table with RLS *disabled* in Supabase is readable by anyone on the internet who finds the project URL. **Every new table gets RLS enabled at creation**, even if the only initial policy is "deny all." Make this a habit.

### The deliberate test before shipping

Create a second account. Log in as that account. Try to read or modify the first account's data through every path you can think of — browser dev tools, direct API calls, URL manipulation. If you can't access the other user's data, RLS is working. 30 minutes; the single highest-value security practice for your stage.

---

## Policy documents — what's actually required

### Required

- **Privacy policy on the website.** Required under PIPEDA the moment personal information is collected, which already happens via the contact form. If one doesn't exist, this is more urgent than anything else here. ~800 words: what's collected, why, where stored, who has access, retention, access/deletion requests.
- **Terms of service for the Growth Zone.** Brief. What the service is, not medical/therapeutic advice, account termination, limitation of liability. ~500 words.
- **Breach response checklist (private).** One page for yourself — who to notify under PIPEDA (Privacy Commissioner if real risk of significant harm, plus affected individuals), evidence preservation, credential rotation. Won't use it; having written it once means it's thought through.

### Not required at this stage

SOC 2 reports, formal DPAs, vendor risk matrices, designated DPO. Those are for when enterprise clients ask. They won't, yet.

---

## Realistic threat model

For a sole operator at this scale, the entire game is:

1. **Accidental exposure** — misconfigured RLS, leaked key in a commit, public URL with no auth → RLS + credential hygiene
2. **Account compromise** — someone gets into Supabase admin or email → **2FA on Supabase, GitHub, Google Workspace. Today, before any auth work.**
3. **Targeted attack** — genuinely unlikely at your scale; don't optimise for it
4. **Vendor breach** — can't prevent; choose reasonable vendors (already done)

---

## Privacy positioning — the honest version

Canadian-only contractor requirement was reconsidered as somewhat trite given the existing stack already routes through Vercel, Resend, GitHub, Anthropic, OpenAI. The defensible story is sharper than "Canadian-only":

- **Data residency:** Supabase Canadian region (real, intact)
- **Data minimization by design:** only collect what's used; no ad-tech monetization layer
- **Single operator with named accountability:** short, honest list of who has access
- **Auditable, inspectable system:** built it, know how it works
- **Purpose-built rather than general-purpose:** the underrated differentiator — proprietary suitability is a stronger pitch than privacy hygiene

Defensible claim shape: *"Your data is handled with deliberate minimalism. Stored in Canada, processed only by infrastructure providers under data processing agreements, never sold or shared, never used to train AI models. Tools were built specifically for coaching work, not adapted from general-purpose marketing software."*

Avoid: "data never leaves Canada" (it does, in transit), "no AI training" without checking each vendor's terms, "end-to-end encrypted" unless actually implemented.

---

## On hiring help (deferred)

Conclusion: **not needed for Phase 1.** This work is within reach with Copilot + Claude support. Revisit hiring once Phase 1 is shipped and the implementation pattern is proven — the right time to bring in a contractor is when the spec is clearer and the trust threshold can be tested on lower-stakes work before more sensitive data (wellness logs, coaching sessions) enters the system.

If/when hiring does happen:
- Drop Canadian-only as a hard filter (keep as mild preference for timezone/PIPEDA literacy)
- Real filters: credential hygiene, willing to work against a dev-only Supabase project, signs a real confidentiality agreement (not generic NDA), demonstrable Supabase RLS track record
- Start with a fixed-scope trial, not a relationship

---

## Immediate next decisions

1. Confirm tier-and-tool mapping: which tool is the open/no-login one? Which is the free-with-login hook?
2. 2FA audit on Supabase, GitHub, Google Workspace (do this today regardless of anything else)
3. Privacy policy + ToS — could be drafted as a separate next deliverable
4. Then: schema changes (`user_id`, `tier`), magic link config with Resend, login page, pick one tool, ship it
