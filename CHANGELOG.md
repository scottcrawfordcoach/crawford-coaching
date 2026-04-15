# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog principles and uses reverse chronological order.

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
