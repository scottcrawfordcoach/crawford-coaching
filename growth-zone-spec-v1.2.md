# Growth Zone Platform Spec v1.3

**Status:** Draft for review
**Supersedes:** v1.2
**Date:** May 2026

---

## 1. Product structure

Crawford Coaching offers four distinct products, plus a deferred fifth.

| Product | Type | Billing | Notes |
|---|---|---|---|
| 1:1 Coaching | Service | Per-package or ongoing | Bundles Growth Zone access during active relationship |
| WHOLE | 16-week course | Course fee | Bundles Growth Zone access during course |
| Synergize Fitness | Gym membership | Monthly | Includes Synergize Members Area (online tools) |
| Growth Zone | Subscription | Monthly or annual | Standalone product |
| Configurable Timer PWA | Standalone product | TBD | **Parked.** Built post-launch. White-label option for gym resale. |

---

## 2. Access matrix

The Growth Zone is a sign-in-only entity. Any signed-in account gets the free tier regardless of subscription. No stacking, no past-client carry-over except WHOLE alumni (time-limited).

| Client state | `/timer` (public) | GZ free tier | GZ full | Synergize Members Area | Pricing model |
|---|---|---|---|---|---|
| Guest (no account) | ✓ | ✗ | ✗ | ✗ | Free |
| Signed in, no subscription | ✓ | ✓ | ✗ | ✗ | Free |
| Active Synergize member | ✓ | ✓ | Optional, 30% off monthly | ✓ | Synergize fee + (optional) discounted GZ |
| Growth Zone subscriber | ✓ | ✓ | ✓ | ✗ | Monthly or annual |
| Active Coaching client | ✓ | ✓ | ✓ (excl. WHOLE content) | ✗ | Bundled in coaching fee |
| Active WHOLE participant | ✓ | ✓ | ✓ | ✗ | Bundled in course fee |
| WHOLE alumni (within claim window) | ✓ | ✓ | Optional, 30% off monthly | ✗ | Discounted GZ monthly |
| Past Coaching client | ✓ | ✓ | ✗ | ✗ | Standard rates apply if subscribing |
| Past Synergize member | ✓ | ✓ | ✗ | ✗ | Standard rates apply if subscribing |

### Override rule
Active subscription or active service status always wins. If a client is both Coaching-active and Synergize-active, Coaching bundling applies and no Synergize discount is calculated.

### Coaching active-status rule
Manually managed. A client is active while there's a working relationship. Edge cases (long-term client on a 3-month break, mid-renewal conversation, etc.) are handled by hand. When flipped to inactive, magic link expires and Growth Zone access is revoked.

---

## 3. Tool-by-tool access

### 3.1 Public tier (`/timer` page)

Available to anyone, no account required:

- **Online clock**
- **Single countdown timer**
- **Quick EMOM timer**
- **Invitation to Fully Configurable Timer & Workout Builders** — CTA linking to Growth Zone (sign-in)

### 3.2 Growth Zone — free tier (sign-in required, no subscription)

Available to any signed-in account at no cost:

**Personal growth exercises:**
- Core Values
- Character Strengths
- Feelings Naming Guide
- Life Audit *(TBD — candidate for addition)*

**Fitness tools (cloned from /timer):**
- Online clock
- Single countdown timer
- Quick EMOM timer

### 3.3 Synergize Members Area

A fitness-focused members surface for Synergize members. Accessed via member login on `/synergize`. Contains:

- Online clock
- Single countdown timer
- Quick EMOM timer
- Quick EMOM Workout Builder
- Class availability check
- Open Synergize WOD *(proposed)*
- Switch a Training Session Time *(proposed)*
- Invitation to Full Growth Zone — with Synergize discount

### 3.4 Growth Zone — full tier (paid subscribers, active Coaching, active WHOLE)

All free-tier content plus:

**Growth exercises (all):**
- Motivation Profile
- Task Triage
- Optimism / Explanatory Style (first paid unlock)
- AI Reports — contextual + comparative across exercises

**Productivity tools** (full suite, TBD list)

**Exercise & timer tools (all):**
- Fully Configurable Timer
- Advanced Workout Builder

**Proposed — premium tier:**
- Smart Journal

**Excluded for Coaching clients:** WHOLE programme content

---

## 4. Pricing

### 4.1 Plans

| Plan | Price | Notes |
|---|---|---|
| Growth Zone monthly | TBD | Standard rate |
| Growth Zone annual | TBD | No discounts apply, ever |
| Synergize Fitness | Existing rate | Unchanged |

### 4.2 Discount mechanics

**Synergize → Growth Zone discount**
- 30% off Growth Zone **monthly only**
- Active while Synergize billing is active
- Growth Zone billed as add-on line item on Synergize monthly invoice
- Pause Synergize → next GZ invoice reverts to full price
- Leave Synergize entirely → standard customer (any plan)

**WHOLE alumni → Growth Zone discount**
- 30% off Growth Zone **monthly only**
- **Limited-time claim window** at course end (window length TBD — suggest 30 or 60 days)
- Once claimed within the window, discount is **permanent for that subscription**
- If subscription lapses and is later restarted, discount does not return
- Discount is positioned as a "stay connected" course-completion offer

**Stacking rule**
No stacking. Highest single discount wins. Active-service bundling overrides any discount.

---

## 5. Authentication & access logic

### 5.1 Auth method
Magic link only. No passwords.

### 5.2 Access decision tree (in order of precedence)

```
1. Is Coaching status = active?       → Full Growth Zone (excl. WHOLE)
2. Is WHOLE status = active?          → Full Growth Zone
3. Is Growth Zone subscription active?→ Full Growth Zone
4. Is Synergize status = active?      → Synergize Members Area
                                        + Growth Zone if subscribed (30% off)
5. Has WHOLE alumni discount claimed
   and GZ subscription active?        → Full Growth Zone (at 30% rate)
6. Signed in, no paid/bundled status? → Growth Zone free tier
7. No account / not signed in?        → Free /timer only
```

### 5.3 Status tracking
- **Coaching active flag** — manual via `contacts` table (existing)
- **WHOLE active flag** — manual or course-tied
- **Synergize active flag** — tied to Synergize billing state
- **Growth Zone subscription** — Stripe state of truth
- **WHOLE alumni claim** — boolean + claim_date on contact record

---

## 6. Page change list

### 6.1 Existing pages — what changes

| Page | Change |
|---|---|
| `/growth-zone` | Replaced with sign-in landing page. Existing members sign in via magic link; new visitors see the value proposition + account creation (free). |
| `/synergize` | Add "Member Login" button in nav/hero. Authenticated link enters Synergize Members Area. |
| `/timer` | Trimmed to free-tier scope: clock, single countdown, quick EMOM (with trial of generator + favourites). Upgrade CTAs added. Custom timer + advanced builder removed. |
| Top nav | "Growth Zone" link goes to new gated landing. Consider adding "Sign In" link for returning members. |

### 6.2 New pages / surfaces to build

| Surface | Purpose |
|---|---|
| `/growth-zone/app` (or similar) | Authenticated Growth Zone hub for paid/bundled users. Replaces what's currently the open `/growth-zone`. |
| `/synergize/members` (or in-place section) | Synergize Members Area — full timer tools, EMOM builder, class check, holiday schedule, WOD viewer |
| Sign-in flow | Magic link request → email → token validation → role resolution → redirect to correct surface |
| Stripe webhook handler | Subscription state changes update `contacts` flags |
| WHOLE alumni claim flow | Course-end email with one-click claim within window |
| Account/billing surface | View subscription status, switch monthly/annual, cancel, view invoices |

### 6.3 Tools that move tier

| Tool | From | To |
|---|---|---|
| Custom Configurable Timer | Free `/timer` | Synergize Members Area + Growth Zone |
| Quick EMOM Workout Builder | Free `/timer` | Synergize Members Area + Growth Zone (with free trial in /timer) |
| Synergize Workout of the Day | Not yet built | Synergize Members Area only |
| Class availability check | Currently via assistant | Synergize Members Area (direct surface) |
| Holiday schedule | Currently scattered | Synergize Members Area (canonical) |

---

## 7. Build sequence

**Phase 1 — Foundation (must ship before any monetisation)**
1. Resolve service-role-key exposure in `/api/exercise-report` Vercel function
2. Magic link auth flow (request → email → validate → session)
3. Role resolution logic from `contacts` flags + Stripe state
4. Stripe products + monthly/annual plans for Growth Zone
5. Stripe webhook → `contacts` subscription state sync

**Phase 2 — Replace `/growth-zone`**
6. Repurpose promo landing as canonical `/growth-zone`
7. Build `/growth-zone/app` authenticated hub
8. Move existing exercises behind access checks
9. Implement contextual + comparative report logic for paid tier
10. Optimism unlock as first paid-only exercise

**Phase 3 — Synergize Members Area**
11. Add member login button to `/synergize`
12. Build `/synergize/members` surface
13. Move custom timer + EMOM builder + class check + holiday + WOD viewer in
14. Wire 30% discount mechanic in Stripe (coupon active while Synergize active)

**Phase 4 — Trim `/timer`**
15. Remove custom timer + advanced builder from free `/timer`
16. Add EMOM generator + favourites trial mechanic
17. Wire upgrade CTAs

**Phase 5 — WHOLE alumni mechanic**
18. Course-completion email with claim CTA
19. Claim window enforcement (date-bounded)
20. Permanent-on-claim discount logic in Stripe

**Phase 6 — Polish & expand**
21. Account/billing self-service
22. Productivity tools and additional Growth Zone content
23. Advanced Workout Builder additional formats

**Parked**
- Configurable Timer PWA standalone product (build after Phase 6 stabilises)
- Standalone EMOM workout generator product
- Practitioner model + white labelling
- Premium Smart Journal + AI Coach

---

## 8. Open questions for build phase

Carried forward from v1.1, plus new:

1. WHOLE alumni claim window length — 30 days? 60? 90?
2. Growth Zone monthly and annual price points
3. EMOM generator free trial scope — number of generations? time-limited? saved favourites cap?
4. Synergize Members Area route — `/synergize/members` vs in-place authenticated section on `/synergize`
5. Top-nav sign-in link placement and label
6. Sign-in flow UX for new free-tier accounts — single magic link covers all GZ free tools; confirm account creation copy and friction level
7. Do guests get any AI reports, or are reports paywalled entirely?
8. Account dashboard scope — minimum viable feature set
9. Magic link expiry duration and re-request flow
10. Coaching client manual flip mechanism — admin UI or direct DB update for now?
11. Synergize Members Area tools — WOD viewer source (existing data feed or new?)
12. Analytics events for paywall interactions and conversion funnel

---

## 9. What changed from v1.2

- Growth Zone is now sign-in required at all tiers (no anonymous email-gate)
- Free tier within GZ: Core Values, Character Strengths, Feelings Guide (+ Life Audit TBD) + basic timer tools
- Motivation Profile and Task Triage moved from email-gated free tier → GZ full tier (paid/bundled)
- Timer tools cloned across three surfaces: /timer (public), GZ free tier, Synergize Members Area
- Access matrix updated: new "Signed in, no subscription" state added
- Decision tree step 6 updated: email-capture → sign-in
- /growth-zone landing updated: email-gate → sign-in/account creation

## 10. What changed from v1.1

- Timer split: free clock/countdown/quick-EMOM, paid custom/advanced
- Configurable Timer PWA elevated to separate product (parked)
- Synergize and Growth Zone now formally separate products with discount bridge
- 30% Synergize-active discount mechanic defined
- WHOLE alumni discount: time-limited claim window, permanent once claimed
- Past coaching clients explicitly defined as standard customers
- Synergize Members Area defined as a stripped-back Growth Zone surface
- No-stacking rule confirmed
- Discount applies to monthly only — annual is always full price

