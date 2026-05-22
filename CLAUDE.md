# Claude Code — Crawford Site Behaviour Guide

This file governs how Claude Code operates in this project. Read it at the start of every session.

---

## What This Project Is

The public marketing and coaching website for Crawford Coaching, deployed as a static site on Vercel at `https://www.crawford-coaching.ca`. It combines service/offer pages, interactive growth tools, a writing hub with published articles, a timer utility, and an embedded AI assistant.

Architecture: flat static HTML files with Vercel URL rewrites for clean paths, plus four serverless API functions in `api/` for contact capture, subscription, and exercise-report delivery.

---

## Page Inventory

### Core pages

| Clean URL | File | Purpose |
|---|---|---|
| `/` | `crawford-homepage.html` | Main landing page |
| `/coaching` | `crawford-coaching.html` | 1:1 coaching offer (Committed/Decisive packages) |
| `/whole` | `crawford-whole.html` | WHOLE Program page |
| `/synergize` | `crawford-synergize.html` | Synergize Group Fitness page |
| `/growth-zone` | `crawford-growth-zone.html` | Growth Zone hub — links to exercises and tools |
| `/about` | `crawford-about.html` | About Scott page |
| `/contact` | `crawford-contact.html` | Contact page |
| `/subscribe` | `crawford-subscribe.html` | Newsletter signup |
| `/unsubscribe` | `crawford-unsubscribe.html` | Newsletter unsubscribe (auto-handles `?r=` token) |
| `/assistant` | `crawford-assistant.html` | Dedicated full-page assistant (iframe embed; NO floating widget) |

### Growth Zone tools

| Clean URL | File | Purpose |
|---|---|---|
| `/core-values` | `crawford-core-values.html` | Core Values sorting exercise |
| `/strengths` | `crawford-strengths.html` | Character Strengths quiz (VIA-based) |
| `/motivation` | `crawford-motivation.html` | Motivation & Self-Determination exercise |
| `/optimism` | `crawford-optimism.html` | Optimism & Explanatory Style exercise |
| `/feelings` | `crawford-feelings.html` | Feelings Naming Guide |
| `/task-triage` | `crawford-task-triage.html` | Task Triage tool |
| `/timer` | `crawford-timer.html` | Interval timer with EMOM workout generator |

### Writing

| Clean URL | File | Purpose |
|---|---|---|
| `/writing` | `crawford-writing.html` | Writing hub — recent posts, subscribe, share |
| `/writing/all` | `crawford-writing-all.html` | Full writing archive |
| `/writing/{slug}` | `blogs/crawford-writing-{n}-{slug}.html` | Individual article pages (16 published) |

**Redirects:** `/blog` and `/blog/` → `/writing` (permanent).

All rewrites and redirects are defined in `vercel.json`. Every new article requires a new entry there.

---

## Serverless API Functions (`api/`)

These are Vercel serverless functions. They proxy to the Supabase `data-handler` edge function — this site never has direct Postgres access.

| Endpoint | File | Purpose |
|---|---|---|
| `POST /api/subscribe` | `api/subscribe.js` | Upserts contact via `data-handler contact_upsert`; fires `engagement_log` (fire-and-forget); requires `DATA_HANDLER_BEARER_TOKEN` |
| `POST /api/unsubscribe` | `api/unsubscribe.js` | Processes `?r={recipient_id}` unsubscribe token via `mail-tracker`; falls back to email lookup |
| `POST /api/preferences` | `api/preferences.js` | Updates contact subscription preferences via `data-handler` |
| `POST /api/exercise-report` | `api/exercise-report.js` | Upserts contact → saves exercise results + AI summary via `data-handler` → sends HTML report email via `mail-sender`; requires both `DATA_HANDLER_BEARER_TOKEN` and `MAIL_SENDER_BEARER_TOKEN` |

Environment variables for API functions are set in Vercel project settings (not in any local `.env`):
- `DATA_HANDLER_BEARER_TOKEN`
- `MAIL_SENDER_BEARER_TOKEN`

---

## Scripts

| Script | Command | Purpose |
|---|---|---|
| `scripts/publish-writing-article.js` | `node scripts/publish-writing-article.js --source writing-import/my-article.md` | Creates article HTML in `blogs/`, prepends card in `crawford-writing.html` and `crawford-writing-all.html`, adds rewrite in `vercel.json`. Use `--dry-run` to preview. |
| `scripts/import-legacy-blog-html.js` | `node scripts/import-legacy-blog-html.js --source "blogs/Blog Import/1.html"` | Converts a legacy HTML export (reads `window._BLOG_DATA`) into a frontmatter markdown file in `writing-import/`. Copies sibling `.webp` to `extracted-images/`. |
| `scripts/rebuild-writing-hub.py` | `python scripts/rebuild-writing-hub.py` | Regenerates `crawford-writing.html` and `crawford-writing-all.html` from all articles in `blogs/`. Use when the hub gets out of sync. |
| `scripts/sync-timer-data.js` | `node scripts/sync-timer-data.js` | Syncs exercise content from `exercises.csv` into `timer-exercises.json` (timer runtime data). Run after editing `exercises.csv`. |

---

## Writing Publishing Workflow

**New article from scratch:**

1. Copy `writing-import/article-template.md`; fill frontmatter and body
2. Run `node scripts/publish-writing-article.js --source writing-import/my-article.md --dry-run` — preview output
3. Run without `--dry-run` — creates article HTML, updates writing hub, updates `vercel.json`
4. Copy lead image as WebP to `extracted-images/writing-{n}-{slug}.webp`
5. Update `sitemap.xml` with the new URL
6. Update `CHANGELOG.md`

**Article frontmatter schema:**

```yaml
---
title: "Your Article Title"
slug: "your-article-slug"
date: "Mar 27, 2026"
dateIso: "2026-03-27"
category: "Coaching"
tags: "coaching, mindset, resilience"
readTime: "7 min read"
excerpt: "One sentence summary for cards and SEO."
ogDescription: "Short social description."
image: "./extracted-images/your-image-file.webp"
imageAlt: "Describe the lead image."
---
```

**Legacy HTML import** (for content migrated from old blog platform):

```bash
node scripts/import-legacy-blog-html.js --dir "blogs/Blog Import"
# generates .md files in writing-import/
node scripts/publish-writing-article.js --source writing-import/<slug>.md
```

---

## Timer Integration

- Canonical route: `/timer` → `crawford-timer.html`
- Runtime data files are namespaced with `timer-` prefix to avoid collisions: `timer-sw.js`, `timer-manifest.json`, `timer-emom-db.js`, `timer-exercises.json`
- **Source of truth for exercise content:** `exercises.csv` — edit this file, then run `node scripts/sync-timer-data.js` to regenerate `timer-exercises.json`
- The timer also exists as a standalone app at `https://interval-timer-sigma.vercel.app/` — the `crawford-timer.html` page embeds the same experience on the main site domain

---

## Assistant Widget

- Embedded site-wide on all `crawford-*.html` pages via a single `<script>` tag before `</body>`:
  ```html
  <script src="https://website-assistant-sandy.vercel.app/chat-widget.js"></script>
  ```
- **Exception: `crawford-assistant.html` does NOT include the floating widget** — the page embeds the full chat interface as an `<iframe>` instead. The floating widget was removed from that page to avoid duplication.
- Widget versioning is independent of this repo — updates to `chat-widget.js` are deployed from the Coach-Scott-Bot project and take effect automatically here.

---

## Design System

All pages share the same CSS token set defined inline per file (no shared stylesheet).

**Colour tokens:**

```css
--ink:        #0e0f10   /* page background */
--slate:      #1c2330   /* card/panel background */
--fog:        #3d4a58   /* borders */
--mist:       #a4b6c8   /* secondary labels (brightened Apr 2026) */
--pale:       #dde8f2   /* secondary text (brightened Apr 2026) */
--white:      #ffffff   /* primary text (brightened Apr 2026) */
--brand-blue: #2d86c4   /* CTAs, accents */
--whole-sage: #7a9b6d   /* WHOLE Program accent */
```

**Typography:** Cormorant Garamond (display/serif) + Jost (UI/sans). Both loaded from Google Fonts.

**Anti-patterns — never reintroduce:**
- `border-radius: 999px` — no pill shapes
- System font stacks
- Bright blue gradient backgrounds
- White card backgrounds with drop shadows
- Emoji in headers or nav labels
- Old `--mist: #7a8fa3` or `--pale: #c8d4de` values (contrast was too low; use the brightened values above)

**Navigation pattern:** Desktop nav with logo + links. Mobile: hamburger overlay below 900px. Overlay behaviour: fullscreen, escape-to-close, close-on-link-click, body scroll lock while open, focus-visible keyboard styles. This pattern is repeated across all content pages — keep it consistent when adding pages.

**Images:** All site images use WebP. Do not add new JPGs — convert to WebP first. Source JPGs are retained in the repo but are not referenced by any page.

---

## SEO Rules

- **Canonical domain:** `https://www.crawford-coaching.ca` — all canonical URLs and OG tags use this
- **Heading hierarchy:** one `<h1>` per page (hero title); section headings are `<h2>`; card/article titles within sections are `<h3>`
- **`sitemap.xml`** — manually maintained; update when adding new pages or articles
- **`robots.txt`** — references sitemap at `https://www.crawford-coaching.ca/sitemap.xml`

**Full SEO coverage** (meta description, OG/Twitter cards, canonical, JSON-LD):
- `crawford-homepage.html` — JSON-LD `Organization`
- `crawford-coaching.html` — JSON-LD `Service` with `OfferCatalog`
- `crawford-about.html` — JSON-LD `Person` with credentials
- `crawford-writing.html` — JSON-LD `Blog`

**Needs SEO extension:**
- `crawford-whole.html`, `crawford-synergize.html`, `crawford-growth-zone.html`, `crawford-contact.html`, `crawford-timer.html`, `crawford-strengths.html`, `crawford-core-values.html`
- All individual blog post pages in `blogs/`

---

## Working Conventions

- **CHANGELOG.md is required** — every meaningful code or content change must include a matching entry in `CHANGELOG.md` in the same session. Do not defer changelog updates.
- **Keep pages in sync** — when changing a shared UI pattern (nav, footer, token values, favicon), apply the change across all affected pages in the same pass. Changes to one `crawford-*.html` that affect a shared pattern usually need to be replicated to the others.
- **Validate at mobile breakpoints** — after any layout change, check that the 900px hamburger breakpoint and small-screen readability are intact.
- **Prefer small, verifiable steps** — make focused changes per page rather than sweeping multi-page edits in a single tool call.

---

## Local Preview

```bash
# Simple static server (no Vercel rewrites)
python -m http.server 8080
# Open: http://localhost:8080/crawford-homepage.html

# With Vercel rewrites (clean URLs)
vercel dev
# Open: http://localhost:3000/
```

---

## Temporary UI State

The "Start Here" CTA in the desktop nav and mobile overlay is currently hidden on `crawford-homepage.html` and `crawford-assistant.html` using the native `hidden` attribute. The links and markup are preserved for quick re-enable. Do not remove the markup — just toggle `hidden`.

---

## Deployment

Deployed automatically by Vercel on push to the connected Git repo. No manual build step required — Vercel serves the static HTML files directly and runs the `api/` functions as serverless endpoints.

---

## Ecosystem Position

This site is a **downstream consumer and engagement source** for the Accounts-AI CRM layer.

| Interaction | Direction | Via |
|---|---|---|
| Newsletter signup | Site → Supabase | `/api/subscribe` → `data-handler contact_upsert` + `engagement_log` |
| Unsubscribe | Site → Supabase | `/api/unsubscribe` → `mail-tracker` |
| Exercise report delivery | Site → Supabase → Gmail | `/api/exercise-report` → `data-handler` → `mail-sender` |
| Class schedule display | Supabase → Site | `data-handler class_schedule` GET (consumed by Synergize page) |
| Ask Scott widget | Coach-Scott-Bot → Site | External `<script>` include; deployed independently |

This site never has direct Postgres credentials. All CRM writes go through the `data-handler` edge function (owned by the Accounts-AI project). See [Accounts-AI SYSTEMS.md](../Accounts\ -\ AI/SYSTEMS.md) for the full ecosystem map.
