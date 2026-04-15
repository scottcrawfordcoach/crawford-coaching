Crawford Coaching Site Summary (Strategic + Technical Handoff)

1. Executive Overview
This is a static, conversion-focused brand website for Crawford Coaching, deployed on Vercel. It combines coaching offer pages, self-reflection tools, writing content, and utility experiences (timer and assistant) into one ecosystem.

At a strategy level, it does three jobs:

Establish credibility and voice.
Convert visitors into conversations, subscriptions, and deeper engagement.
Build long-term trust through content and interactive tools.
The site currently reflects a premium, reflective coaching brand with a dark visual system, editorial typography, and practical utility flows.

2. Information Architecture and Site Structure
The structure is route-driven via rewrites in vercel.json, mapped to static HTML files.

Primary sections:

Brand and offers.
Growth tools and exercises.
Writing hub and article archive.
Utility pages and service surfaces.
Key top-level pages:

Home.
Coaching.
WHOLE.
Synergize Fitness.
Growth Zone.
About.
Contact.
Writing hub.
Timer.
Assistant.
Tool/exercise pages include:

Core Values.
Character Strengths.
Motivation.
Optimism.
Feelings Naming Guide.
Task Triage.
Content system:

Writing hub page.
Writing archive page.
Individual article pages under blogs.
Primary source docs and structure references:

README.md
CHANGELOG.md
vercel.json
3. Technical Architecture
Current implementation model:

Static HTML-first architecture.
Inline page-level CSS with repeated token system across pages.
Minimal JS for navigation, tool logic, and page interactions.
Vercel rewrites for clean URL paths.
Scripted content generation for writing pages.
Build and maintenance scripts:

publish-writing-article.js for article generation and writing-page updates.
rebuild-writing-hub.py for writing hub/archive regeneration.
sync-timer-data.js for timer data from CSV sources.
import-legacy-blog-html.js for legacy content ingestion.
API/serverless endpoints are present for specific flows:

subscribe.js
preferences.js
exercise-report.js
4. Page Interaction Model
4.1 Global navigation behavior
Desktop nav with branded logo and top-level links.
Mobile hamburger overlay menu pattern at smaller breakpoints.
Escape-to-close and close-on-link interactions for overlay navigation.
Body scroll lock while mobile overlay is open.
Consistent nav behavior repeated across key pages.
4.2 Conversion actions
Contact and booking links are present across major entry pages.
Writing and tool pages cross-link into coaching conversation opportunities.
Signup/subscribe actions appear in key places to capture audience intent.
4.3 Assistant behavior
Floating assistant widget is used across the main site.
Dedicated assistant page embeds a full assistant interface in an iframe.
Mobile assistant page has optimized viewport behavior for chat usability.
4.4 Writing ecosystem interactions
Writing hub highlights recent posts.
Archive page provides broader library access.
Articles include sharing behavior and SEO-oriented metadata patterns.
Publishing workflow supports repeated content imports without manual page-by-page authoring.
4.5 Tool interactions
Timer provides structured workout utility behavior.
Growth Zone tools provide self-assessment and reflection workflows.
Results surfaces often connect back to next-step actions.
5. Consistent Style and UX Language
Visual identity is consistent and deliberate across the site.

Core style traits:

Dark, cinematic editorial mood with high-contrast text.
Serif-forward display typography paired with clean sans-serif utility text.
Uppercase, letter-spaced navigation and CTA language.
Card-based modular sections and framed content blocks.
Subtle texture, overlays, and atmospheric backgrounds.
Conversion buttons styled with restrained but clear visual hierarchy.
Design token consistency:

Shared palette model based on ink/slate/fog/mist/pale/white tokens.
Recent contrast uplift improved readability globally.
White and pale text values are now brighter for stronger legibility.
Brand consistency patterns:

Repeated logo use in nav and metadata contexts.
Shared favicon usage now rolled out broadly.
Common CTA tone and page-level rhythm.
6. Session-Specific Updates Already Landed
Recent production updates include:

Logo asset refresh for cleaner rendering and better dark-background legibility.
Site-wide favicon rollout plus writing-template support for future generated pages.
Global text contrast uplift by brightening core text tokens.
Temporary suppression of the header Start Here CTA on home and assistant pages while preserving code for easy restoration.
Documentation has been updated to reflect these and is tracked in:

CHANGELOG.md
README.md
7. Strategic Strengths
Strong, cohesive brand voice across coaching and fitness offerings.
Good blend of narrative content and practical tools.
Static architecture gives excellent performance and low operational complexity.
Clean route model and content scripts support scalable publishing.
Mobile navigation patterns and readability are in a stronger state after recent passes.
8. Strategic and Technical Gaps
Style tokens are duplicated in many HTML files, creating maintenance friction.
CTA taxonomy is somewhat fragmented across pages and could be unified.
SEO depth is uneven across secondary pages and tool pages.
Analytics instrumentation is not yet fully centralized or standardized.
Shared UI components are repeated manually rather than generated from a common source.
Some business-critical journeys could use tighter funnel mapping from content to call booking.
9. Recommended Next Development Themes
9.1 Platform and maintainability
Introduce a shared CSS source or design token build step to reduce duplication.
Centralize header/footer/nav templates for consistency and faster iteration.
Create one source-of-truth CTA system by intent and funnel stage.
9.2 Growth and conversion
Define primary conversion ladders by audience segment.
Standardize key CTA copy and placement across offer and tool pages.
Add stronger transitional pages between self-assessment results and coached offers.
9.3 Measurement and insight
Add a unified analytics event schema for nav, CTA, tool completion, and subscription events.
Establish core KPI dashboard views for session quality, conversion paths, and content contribution.
Instrument assistant interactions as intent signals linked to page context.
9.4 Content operations
Continue expanding writing with clustered topic strategy.
Add internal-link logic between articles, tools, and offers.
Introduce editorial metadata standards for easier filtering and personalization later.
10. Discussion Prompts for Strategy or Engineering Sessions
What are the top two conversion outcomes the site should optimize in the next quarter?
Which audience segment should own the homepage primary CTA path?
Should the site remain static-first with scripted generation, or move toward a lightweight component framework?
What is the minimum analytics model needed for confident roadmap decisions?
Which three pages should be prioritized for SEO and conversion improvement first?
If helpful, I can turn this into a one-page decision brief format with a prioritized 30-60-90 day roadmap and explicit owner recommendations for product, marketing, and engineering.