# Copilot Instruction: Feelings Naming Guide Page

## Overview

Build a new static HTML page `crawford-feelings.html` for the Feelings Naming Guide — an interactive Growth Zone exercise at `/feelings`. The page is a single-file, self-contained HTML document with inline CSS and JavaScript. No frameworks, no build step.

The taxonomy of feelings (core emotions, families, specific feelings, and distinguishing captions) lives in **`feelings-captions-review.md`**. That file is the single source of truth. Read it and convert its structure into a JavaScript data object inside the page's `<script>` tag.

The interaction model and visual design are defined by the React prototype at **`feelings-naming-guide.jsx`**. Translate that into vanilla HTML/CSS/JS, matching its behaviour and styling exactly.

---

## File to create

**`crawford-feelings.html`** in the repo root.

---

## Page structure

Copy the full `<head>`, nav, nav overlay, footer, footer social icons, hamburger menu script, and chat widget script tag directly from `crawford-growth-zone.html`. Apply these per-page values:

| Element | Value |
|---|---|
| `<title>` | `Feelings Naming Guide — Crawford Coaching` |
| Nav active link | `/growth-zone` (this is a Growth Zone sub-page) |
| Nav CTA | `Book a Call` → `https://calendar.app.google/R66fNg5m7w3aKPKd6` |

Do NOT include a page hero section. The exercise has its own header area inside the interactive container.

---

## Design tokens (CSS custom properties)

Use the existing `:root` variables from `crawford-growth-zone.html`:

```
--ink:        #0e0f10
--slate:      #1c2330
--slate-mid:  #232f3e
--fog:        #3d4a58
--mist:       #7a8fa3
--pale:       #c8d4de
--white:      #f5f3ef
--brand-blue: #2d86c4
--brand-blue-light: #4fa3d8
--serif-display: 'Cormorant Garamond', Georgia, serif
--serif-body:    'Libre Baskerville', Georgia, serif
--sans:          'Jost', sans-serif
```

---

## Core emotion colours

Each core emotion has its own colour. These are used for chip borders, hover fills, connector lines, tier labels, and the result card accent bar. Define as a map in JS:

```
Joyful:     #d4a843
Proud:      #c94040
Interested: #b07cc3
Peaceful:   #5a8a5a
Trusting:   #4a90b8
Loving:     #c97a8a
Angry:      #c0473a
Afraid:     #cc7a3a
Sad:        #5a7fa0
Disgusted:  #6b7a5a
Ashamed:    #7a6a8a
Bad:        #7a6a5a
```

---

## Taxonomy data structure

Read `feelings-captions-review.md` and convert into a JS object. The structure is:

```javascript
const TAXONOMY = {
  "Joyful": {
    color: "#d4a843",
    families: {
      "Happy": {
        "Ecstatic": "Beyond happy. Almost too much joy to contain. A peak.",
        "Elated": "High. Everything feels lifted. Often comes in a rush.",
        // ... all feelings from the markdown
      },
      "Excited": { /* ... */ },
      // ... all families
    }
  },
  // ... all 12 core emotions
};
```

**Important**: Object keys with spaces or hyphens (e.g. `"Let down"`, `"Out of control"`, `"Burned out"`, `"Self-assured"`, `"At ease"`, `"Self-confident"`, `"Self-conscious"`, `"Self-loathing"`) must be quoted strings.

The order of core emotions:

```javascript
const CORE_MET = ["Joyful", "Proud", "Interested", "Peaceful", "Trusting", "Loving"];
const CORE_NOT_MET = ["Angry", "Afraid", "Sad", "Disgusted", "Ashamed", "Bad"];
```

---

## Interaction model

The exercise has two modes: **intro** and **flow**. All rendering happens in a single container — no page reloads, no separate screens.

### Intro mode

Shows three paragraphs of intro copy, a "Begin" button, and a collapsible "A note on real feelings vs. evaluations" section.

**Intro copy** (use exactly):

> People often stop at "good" or "bad" or "mad." But vague labels keep emotions in control. When you name what you're feeling with precision, the feeling loses some of its grip. You stop being *in* it and start being able to *work with* it.
>
> Precise emotional vocabulary also changes how you communicate. Telling someone "I feel frustrated" lands differently than "I feel bad." It gives the other person something real to respond to.
>
> This guide walks you through three levels of specificity: a core emotion, a family within it, and the precise word that fits.

**"Begin" button** clears intro and shows tier 1.

**Collapsible note** — toggle button with +/− icon. Contains:

> Not everything we call a "feeling" is actually one. Words that follow "I feel like..." or "I feel that..." are usually **evaluations** of what someone else did, not descriptions of our internal state. They describe what we think happened *to* us, not what's happening *inside* us.
>
> For example: "I feel *betrayed*" is really a judgement about someone else's behaviour. The actual feeling underneath might be *hurt*, *scared*, or *angry*. Getting to the real feeling is what makes it useful.
>
> Words that are evaluations, not feelings:

Then a row of small chips listing: Abandoned, Attacked, Betrayed, Blamed, Bullied, Cheated, Coerced, Criticized, Dismissed, Disrespected, Excluded, Ignored, Insulted, Intimidated, Let down, Manipulated, Misunderstood, Neglected, Put down, Rejected, Unappreciated, Unheard, Unloved, Unwanted, Used, Violated, Wronged

Then:

> *If you notice one of these, ask: "What am I actually feeling underneath that?"*

### Flow mode (the flowchart)

The exercise builds downward on one page. Each selection reveals the next tier below, connected by a vertical colour line. The user's path is always visible above.

**Tier 1 — Core emotions**

Label: "What are you feeling?"

Two groups of horizontal chip buttons separated by dashed dividers:

- Label: `needs being met` + dashed line → chips for `CORE_MET`
- Label: `needs not being met` + dashed line → chips for `CORE_NOT_MET`

Each chip shows just the word — no preview text, no sub-labels. Each uses its own colour for the border.

When selected: the chip fills with its colour, text goes white. Unselected chips fade to 45% opacity. If user clicks a different chip, the selection changes and tiers below reset.

**Connector line**

Between each tier: a centered vertical line, 2px wide, 28px tall, in the selected core's colour at 50% opacity.

**Tier 2 — Families**

Label: "What kind of [core emotion]?" in the core's colour.

Horizontal chip row showing all families for the selected core. Same select/fade behaviour as tier 1, using the parent core's colour.

**Connector line**

Same as above.

**Tier 3 — Specific feelings**

Label: "Get specific." in the core's colour.

Horizontal chip row of all specific feelings within the selected family. Same select/fade behaviour.

**Connector line**

Same as above.

**Result card**

A card with:
- 3px accent bar across the top in the core's colour
- Background: `var(--slate)` / `#1c2330`
- Border: `1px solid [core colour at 15% opacity]`
- Border-radius: 2px

Card contents (top to bottom, all centred):
1. The feeling word — large, in Cormorant Garamond 300, ~2.6rem, in the core's colour
2. The distinguishing caption — Libre Baskerville 0.88rem, `--pale` colour, max-width 480px
3. 2rem of empty space
4. "You named it." — Jost 300, 0.78rem, uppercase, letterspacing 0.15em, colour `--fog`
5. A 40px horizontal rule, 1px, `rgba(255,255,255,0.08)`, centred
6. Closer text in Libre Baskerville italic, 0.85rem, `--mist` colour, max-width 460px:

> Now that it's named honestly, you have something real to work with. Clear language gives you traction — with yourself, and with the people around you. You can get specific about what's driving it, and what you actually want and need.

**Start over button** below the result card. Border: `1px solid rgba(45,134,196,0.3)`, text `--brand-blue`, Jost 400 0.75rem uppercase. On hover: background `rgba(45,134,196,0.08)`.

### Scroll behaviour

When each new tier appears, smooth-scroll it into the centre of the viewport with a short delay (~80ms).

### Resetting

"Start over" clears all selections and shows tier 1 again (still in flow mode, not back to intro).

Clicking a different chip at any tier resets all tiers below it.

---

## CSS specifics

### Typography

- Tier labels / divider labels / chip text / buttons: `var(--sans)` (Jost)
- Intro body / captions / closer: `var(--serif-body)` (Libre Baskerville)
- Result word / header title: `var(--serif-display)` (Cormorant Garamond)

### Chips

```css
.fng-chip {
  border: 1px solid;
  border-radius: 2px;
  padding: 0.55rem 1rem;
  cursor: pointer;
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  white-space: nowrap;
  transition: all 0.2s;
  background: transparent;
  color: var(--pale);
}
```

Selected state: `background` fills with the core colour, `color` goes `var(--white)`, `transform: scale(1.02)`.

Faded state: `opacity: 0.45`, `color: var(--fog)`.

Hover (when not selected): `background: [core colour at ~8% opacity]`, `border-color: [core colour]`.

### Evaluation chips (in the note section)

```css
.fng-eval-chip {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--mist);
  border: 1px solid rgba(122,143,163,0.2);
  border-radius: 1px;
  padding: 0.25rem 0.6rem;
  display: inline-block;
}
```

### Layout

- Main content area: `max-width: 720px`, centred, `padding: 2rem`
- The header area (above the exercise): background `var(--slate)`, padding `2.5rem 2rem 1.5rem`, with the Growth Zone label and title
- Header label: matches `page-hero__label` pattern — Jost 400, 0.68rem, letterspacing 0.3em, uppercase, `--brand-blue`, with a 28px line before it
- Header title: Cormorant Garamond 300, `clamp(1.8rem, 4vw, 2.6rem)`
- Chip rows: `display: flex; flex-wrap: wrap; gap: 0.45rem; justify-content: center`
- Flow wrapper: `display: flex; flex-direction: column; align-items: center`
- Footer reference text: Jost 300, 0.68rem, `--fog` colour, centred, max-width 720px

### Mobile responsiveness

At `max-width: 900px`:
- Show hamburger, hide nav links and nav CTA (same pattern as other pages)
- Chip rows should wrap naturally — the `flex-wrap: wrap` handles this
- Main content padding reduces to `padding: 1.5rem`
- Result card padding reduces to `padding: 2rem 1.5rem`
- Ensure all interactive elements have `min-height: 44px` for touch targets

---

## Footer reference line

Below the exercise area, before the site footer:

> Inspired by the Feelings Wheel (Dr. Gloria Willcox) and the Feelings & Needs inventory from Nonviolent Communication (Marshall Rosenberg, Ph.D.). Adapted for self-coaching use.

Styled as noted above (Jost 300, 0.68rem, `--fog`, centred).

---

## Vercel routing

Add to `vercel.json`:

```json
{ "source": "/feelings", "destination": "/crawford-feelings.html" }
```

---

## Growth Zone card update

In `crawford-growth-zone.html`, update the Feelings Naming Guide card from "Coming Soon" to active:

**Find:**
```html
<div class="tool-card tool-card--coming-soon">
  <div class="tool-card__icon">🗺️</div>
  <h2 class="tool-card__title">Feelings Naming Guide</h2>
  <p class="tool-card__desc">Naming what you're feeling with precision is one of the most underrated skills in coaching and self-reflection. This guide gives you the vocabulary to get more specific. Because "stressed" and "overwhelmed" aren't the same thing.</p>
  <span class="tool-card__soon">Coming Soon</span>
</div>
```

**Replace with:**
```html
<div class="tool-card">
  <div class="tool-card__icon">🗺️</div>
  <h2 class="tool-card__title">Feelings Naming Guide</h2>
  <p class="tool-card__desc">Naming what you're feeling with precision is one of the most underrated skills in coaching and self-reflection. This guide gives you the vocabulary to get more specific. Because "stressed" and "overwhelmed" aren't the same thing.</p>
  <a href="/feelings" class="tool-card__link">Open Guide</a>
</div>
```

---

## Chat widget

Include the ScottBot script tag before `</body>`, same as other pages:

```html
<script src="https://website-assistant-sandy.vercel.app/chat-widget.js"></script>
```

---

## Deploy checklist

1. [ ] `feelings-captions-review.md` reviewed and edited (this is your source of truth for all feelings and captions)
2. [ ] `crawford-feelings.html` created with full taxonomy from the markdown
3. [ ] All quoted object keys verified (spaces/hyphens in feeling names)
4. [ ] Intro copy, note copy, and closer copy match this document exactly
5. [ ] Chip interactions work: select fills, others fade, re-select resets below
6. [ ] Smooth scroll to each new tier on selection
7. [ ] Start over resets to tier 1
8. [ ] Result card shows: word → caption → space → "You named it." → divider → closer
9. [ ] Mobile hamburger nav works
10. [ ] Touch targets ≥ 44px
11. [ ] `vercel.json` updated with `/feelings` route
12. [ ] Growth Zone card updated from Coming Soon to active link
13. [ ] Chat widget script tag present
14. [ ] `git add`, `git commit`, `git push`
