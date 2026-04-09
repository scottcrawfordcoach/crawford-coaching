# Crawford Site

Static multi-page marketing/coaching website deployed on Vercel.

## Project Context Summary

### Purpose
- Serve as the public digital front door for Crawford Coaching.
- Present offers, build trust, and convert visitor interest into meaningful actions.

### Scope
- Core pages and offers: homepage, Coaching, WHOLE, Synergize, Growth Zone, About, Contact.
- Writing ecosystem: article publishing pipeline, writing hub, and full archive.
- Utility and engagement surfaces: integrated timer route and site-wide assistant widget embed.
- Conversion pathways: contact actions, newsletter/signup touchpoints, and route-level CTA flows.

### Function
- Operates as a static, Vercel-routed site with clean URL rewrites.
- Uses scripts to publish and maintain writing content and archive consistency.
- Captures user intent and engagement signals across offers, content, and tools.

### Relevance To Cloud CRM + Data Handler
- Treat this project as an upstream intent and engagement source system.
- Use its page, offer, content, and CTA interactions to inform normalized CRM entities.
- Align cross-project data access through a single Supabase Data Handler Edge Function with service-role-only privilege and bearer-token mediated downstream access.

## Project Layout

- [index.html](index.html): Redirects to the homepage HTML file.
- [crawford-homepage.html](crawford-homepage.html): Main landing page.
- [crawford-coaching.html](crawford-coaching.html): Coaching page.
- [crawford-whole.html](crawford-whole.html): WHOLE program page.
- [crawford-synergize.html](crawford-synergize.html): Synergize Fitness page.
- [crawford-growth-zone.html](crawford-growth-zone.html): Growth Zone hub — split into Personal Growth Exercises (Values, Strengths, Motivation, Optimism) and Tools (Timer, Feelings Guide).
- [crawford-core-values.html](crawford-core-values.html): Core Values sorting exercise.
- [crawford-strengths.html](crawford-strengths.html): Character Strengths quiz (VIA-based).
- [crawford-motivation.html](crawford-motivation.html): Motivation & Self-Determination exercise.
- [crawford-optimism.html](crawford-optimism.html): Optimism & Explanatory Style exercise.
- [crawford-feelings.html](crawford-feelings.html): Feelings Naming Guide.
- [crawford-assistant.html](crawford-assistant.html): Dedicated assistant page (embeds the Ask Scott chat via iframe).
- [crawford-about.html](crawford-about.html): About page.
- [crawford-contact.html](crawford-contact.html): Contact page.
- [crawford-writing.html](crawford-writing.html): Writing hub page (posts, subscribe, share links).
- [blogs/](blogs/): Writing article pages and legacy import source files.
- [blogs/crawford-writing-1-need-beneath-the-want.html](blogs/crawford-writing-1-need-beneath-the-want.html): First imported article page.
- [crawford-timer.html](crawford-timer.html): Integrated interval timer page (canonical route: `/timer`).
- [vercel.json](vercel.json): Route rewrites for clean URLs.
- [extracted-images/](extracted-images/): Site image assets.
- [CHANGELOG.md](CHANGELOG.md): Ongoing project change log.

## Routing

Vercel rewrites map clean paths to static HTML files:

- `/` -> `/crawford-homepage.html`
- `/coaching` -> `/crawford-coaching.html`
- `/whole` -> `/crawford-whole.html`
- `/synergize` -> `/crawford-synergize.html`
- `/growth-zone` -> `/crawford-growth-zone.html`
- `/core-values` -> `/crawford-core-values.html`
- `/strengths` -> `/crawford-strengths.html`
- `/motivation` -> `/crawford-motivation.html`
- `/optimism` -> `/crawford-optimism.html`
- `/feelings` -> `/crawford-feelings.html`
- `/assistant` -> `/crawford-assistant.html`
- `/about` -> `/crawford-about.html`
- `/contact` -> `/crawford-contact.html`
- `/writing` -> `/crawford-writing.html`
- `/writing/1-the-need-beneath-the-want` -> `/blogs/crawford-writing-1-need-beneath-the-want.html`
- `/timer` -> `/crawford-timer.html`

## Writing Import Workflow

- Source imports are currently staged in [blogs/Blog Import/](blogs/Blog Import/) (for example [blogs/Blog Import/1.html](blogs/Blog Import/1.html)).
- Published article thumbnails should be copied into [extracted-images/](extracted-images/) with stable, SEO-friendly filenames.
- Writing hub cards in [crawford-writing.html](crawford-writing.html) should point to clean rewritten HTML article pages and include share actions.
- For faster publishing from a single source file, use [writing-import/article-template.md](writing-import/article-template.md) and run:

```bash
node scripts/publish-writing-article.js --source writing-import/my-article.md
```

- This command creates a new `blogs/crawford-writing-<slug>.html` article page, prepends a post card on [crawford-writing.html](crawford-writing.html), and adds the matching rewrite in [vercel.json](vercel.json).
- Optional `tags` frontmatter (comma-separated) is used for keyword chips and Writing library filtering/highlighting.

### Legacy HTML Batch Import

For scraped legacy posts (for example the first 15 historical posts), convert old HTML exports into publish-ready markdown frontmatter files:

```bash
node scripts/import-legacy-blog-html.js --source "blogs/Blog Import/1.html"
```

or process a whole folder:

```bash
node scripts/import-legacy-blog-html.js --dir "blogs/Blog Import"
```

Then publish each generated markdown file:

```bash
node scripts/publish-writing-article.js --source writing-import/<slug>.md
```

Notes:
- The importer looks for `window._BLOG_DATA` inside legacy HTML exports.
- If a sibling image exists (same basename, `.webp`), it is copied into [extracted-images/](extracted-images/) using `writing-<slug>.webp`.

## Timer Integration

- Canonical timer route is now `/timer` on this main site deployment.
- Existing on-site timer entry points now target `/timer`.
- Timer runtime files are namespaced (for example `timer-sw.js`, `timer-manifest.json`, `timer-emom-db.js`) to avoid collisions with future site assets.
- Exercise content editing source-of-truth is [exercises.csv](exercises.csv), with generated runtime data synced via [scripts/sync-timer-data.js](scripts/sync-timer-data.js).

## Assistant Widget Integration

- The floating "Ask Scott" assistant widget is embedded site-wide on all `crawford-*.html` pages, including [crawford-timer.html](crawford-timer.html).
- Embed source is external and intentionally separated from this repo:
	- `https://website-assistant-sandy.vercel.app/chat-widget.js`
- This keeps assistant deployment/versioning independent while enabling a persistent on-page widget across the main site.

## Current Status

### Completed: Mobile Phase 1 (Navigation)

Implemented fullscreen hamburger overlay nav on all 8 content pages.

Included behavior:
- Mobile toggle below 900px.
- Fullscreen overlay menu.
- Per-page active link + CTA.
- Escape-to-close.
- Close-on-link-click.
- Body scroll lock while menu is open.
- Focus-visible styles for keyboard users.

See [CHANGELOG.md](CHANGELOG.md) for the detailed update list.

### Completed: Mobile Phase 2 (Layout and Readability)

Completed work:
- Mobile-safe hero height behavior on hero-driven pages.
- Label/readability minimums for small screens.
- 44px touch-target sizing for key interactive elements.
- Input sizing improvements for mobile forms.
- Cross-page image overflow safety.
- Page-specific mobile refinement for dense sections, grids, forms, and CTA layouts.

Next recommended step:
- Manual live QA on the Vercel deployment (desktop + real mobile devices) across all routes, with a quick follow-up patch pass for anything found.

## Local Preview

Option 1 (Python):

```bash
python -m http.server 8080
```

Then open:
- `http://localhost:8080/crawford-homepage.html`

Option 2 (Vercel dev, to test rewrites):

```bash
vercel dev
```

Then open:
- `http://localhost:3000/`
- `http://localhost:3000/coaching`
- `http://localhost:3000/whole`

## Working Conventions

- Keep HTML pages in sync when changing shared UI patterns.
- Default policy: every meaningful code or content change must include a matching update in [CHANGELOG.md](CHANGELOG.md).
- Update [CHANGELOG.md](CHANGELOG.md) in the same working session as the implementation (do not defer changelog updates to a later pass).
- Prefer small, verifiable steps and validate pages at mobile breakpoints after each batch.

## SEO Reference

### Domains
- Primary: `www.crawford-coaching.com`
- Legacy/alias: `crawford-coaching.ca`
- Canonical URLs and OG tags use `https://www.crawford-coaching.com`.

### Pages with full SEO coverage
These pages have meta descriptions, OG/Twitter cards, canonical URLs, and JSON-LD structured data:
- [crawford-homepage.html](crawford-homepage.html) — JSON-LD `Organization`
- [crawford-coaching.html](crawford-coaching.html) — JSON-LD `Service` with `OfferCatalog`
- [crawford-about.html](crawford-about.html) — JSON-LD `Person` with credentials
- [crawford-writing.html](crawford-writing.html) — JSON-LD `Blog` (added during writing hub build)

### Pages needing SEO extension
These pages do not yet have meta descriptions, OG/Twitter cards, canonical URLs, or JSON-LD:
- [crawford-whole.html](crawford-whole.html)
- [crawford-synergize.html](crawford-synergize.html)
- [crawford-growth-zone.html](crawford-growth-zone.html)
- [crawford-contact.html](crawford-contact.html)
- [crawford-timer.html](crawford-timer.html)
- [crawford-strengths.html](crawford-strengths.html)
- [crawford-core-values.html](crawford-core-values.html)
- Individual blog post pages (15 in [blogs/](blogs/))

### Heading hierarchy
- Each page has one `<h1>` (the page title/hero).
- Card/article titles within a section use `<h3>` (not `<h2>`), since each section heading is an `<h2>`.
- Build scripts ([scripts/publish-writing-article.js](scripts/publish-writing-article.js), [scripts/rebuild-writing-hub.py](scripts/rebuild-writing-hub.py)) already emit `<h3>` for generated article cards.

### Image format
- All site images use WebP format. Do not add new JPGs — convert to WebP first.
- Source JPGs are retained in the repo but are not referenced by any pages.
- Hero images on homepage and coaching pages use `<img>` tags (not CSS `background-image`) for crawlability.
- Hero on [crawford-whole.html](crawford-whole.html) still uses CSS `background-image` (not yet converted to `<img>` tag).

### Sitemap and robots
- [sitemap.xml](sitemap.xml) — manually maintained; update when adding new pages or blog posts.
- [robots.txt](robots.txt) — references sitemap at `https://www.crawford-coaching.com/sitemap.xml`.

## Suggested Session Startup Checklist

1. Read [CHANGELOG.md](CHANGELOG.md).
2. Confirm current branch has no unexpected changes.
3. Pick a focused phase target (for example: hero fixes only).
4. Apply across all affected pages.
5. Validate and update [CHANGELOG.md](CHANGELOG.md).
