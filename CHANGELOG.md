# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog principles and uses reverse chronological order.

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
