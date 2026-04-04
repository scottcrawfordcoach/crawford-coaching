# Character Strengths Quiz — Integration Instructions

## Overview

`crawford-strengths.html` is a self-contained Character Strengths quiz for the Growth Zone. It needs to be added to the repo and wired into the site navigation and routing.

---

## 1. Add the file

Place `crawford-strengths.html` in the project root, alongside the other page files (e.g., `crawford-coaching.html`, `crawford-growth-zone.html`).

---

## 2. Add nav and footer

The file currently has **no nav or footer**. Copy the full `<nav>` block (including the mobile hamburger overlay) and the `<footer>` block from `crawford-growth-zone.html` into `crawford-strengths.html`.

- Insert the nav at the top of `<body>`, before the first `<div class="screen">`.
- Insert the footer at the bottom of `<body>`, after the last `</div>` that closes `screen-results` and before the `<script>` block.
- In the nav links, set the Growth Zone link as active: `class="active"` on the `/growth-zone` link.
- Also copy the mobile nav JavaScript (the toggle/overlay script block at the bottom of the Growth Zone page) into the strengths page, before the closing `</body>` tag.

---

## 3. Add the Vercel rewrite

In `vercel.json`, add this rewrite so `/strengths` resolves cleanly:

```json
{
  "source": "/strengths",
  "destination": "/crawford-strengths.html"
}
```

Add it alongside the existing rewrites (e.g., `/coaching`, `/growth-zone`, etc.).

---

## 4. Update the Growth Zone card

In `crawford-growth-zone.html`, find the Character Strengths tool card (currently marked "Coming Soon") and make it live:

**Replace:**
```html
<div class="tool-card tool-card--coming-soon">
  <div class="tool-card__icon">💪</div>
  <h2 class="tool-card__title">Character Strengths</h2>
  <p class="tool-card__desc">Based on the VIA framework, this exercise helps you identify the strengths that come most naturally to you. Understanding how you're wired is a better starting point than focusing on what you're not.</p>
  <span class="tool-card__soon">Coming Soon</span>
</div>
```

**With:**
```html
<div class="tool-card">
  <div class="tool-card__icon">💪</div>
  <h2 class="tool-card__title">Character Strengths</h2>
  <p class="tool-card__desc">Based on the VIA framework, this exercise helps you identify the strengths that come most naturally to you. Understanding how you're wired is a better starting point than focusing on what you're not.</p>
  <a href="/strengths" class="tool-card__link">Take the Quiz</a>
</div>
```

Note: Remove the `tool-card--coming-soon` class and replace the `<span>` with an `<a>` link. The link style should use the same `tool-card__link` class as the Interval Timer card (blue accent, not orange).

---

## 5. Add the chat widget

If the other pages include the floating chat widget script, add it to `crawford-strengths.html` as well, just before `</body>`:

```html
<script src="https://website-assistant-sandy.vercel.app/chat-widget.js"></script>
```

---

## Checklist

- [ ] `crawford-strengths.html` added to project root
- [ ] Nav and footer copied from Growth Zone page
- [ ] Growth Zone link set as active in nav
- [ ] Mobile nav JS copied over
- [ ] Vercel rewrite added for `/strengths`
- [ ] Growth Zone card updated from Coming Soon to live link
- [ ] Chat widget script included
- [ ] Deploy and verify `/strengths` loads correctly
