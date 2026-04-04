# Copilot Instructions: Add Optimism & Explanatory Style Exercise

## Overview

Add the new Optimism & Explanatory Style exercise to the Crawford Coaching site. This involves three changes:

1. Add the new HTML page to the repo
2. Add a URL rewrite in `vercel.json`
3. Update the Growth Zone page to make the Optimism card live

---

## Step 1: Add the page file

Copy the file `crawford-optimism.html` (provided separately) into the root of the repo, alongside the other page files like `crawford-strengths.html`, `crawford-growth-zone.html`, etc.

The file is self-contained (inline CSS, inline JS, no external dependencies beyond Google Fonts and the chat widget script).

---

## Step 2: Add URL rewrite to vercel.json

Open `vercel.json` and add this rewrite to the `rewrites` array:

```json
{ "source": "/optimism", "destination": "/crawford-optimism.html" }
```

The full rewrites array should now include all existing routes plus the new one. Place it near the other Growth Zone tool routes (e.g. after `/strengths` if that exists, or after `/growth-zone`).

---

## Step 3: Update the Growth Zone page

In `crawford-growth-zone.html`, find the Optimism & Explanatory Style card (around line 462-468). It currently looks like this:

```html
      <!-- OPTIMISM & EXPLANATORY STYLE -->
      <div class="tool-card tool-card--coming-soon">
        <div class="tool-card__icon">🔭</div>
        <h2 class="tool-card__title">Optimism & Explanatory Style</h2>
        <p class="tool-card__desc">How you explain setbacks to yourself shapes how you respond to them. This tool helps you understand your explanatory style, and whether it's working for you or against you.</p>
        <span class="tool-card__soon">Coming Soon</span>
      </div>
```

Replace it with:

```html
      <!-- OPTIMISM & EXPLANATORY STYLE -->
      <div class="tool-card">
        <div class="tool-card__icon">🔭</div>
        <h2 class="tool-card__title">Optimism & Explanatory Style</h2>
        <p class="tool-card__desc">How you explain setbacks to yourself shapes how you respond to them. This tool helps you understand your explanatory style, and whether it's working for you or against you.</p>
        <a href="/optimism" class="tool-card__link">Begin Exercise</a>
      </div>
```

Changes:
- Remove `tool-card--coming-soon` class from the outer div
- Replace the `<span class="tool-card__soon">Coming Soon</span>` with `<a href="/optimism" class="tool-card__link">Begin Exercise</a>`

---

## Verification Checklist

After deploying, confirm:

- [ ] `crawford-coaching.ca/optimism` loads the exercise
- [ ] Intro screen renders with title "Optimism & Explanatory Style"
- [ ] Clicking "Begin" starts the 48-question flow
- [ ] A/B choice cards work (click and keyboard: A, B, Enter, arrow keys)
- [ ] Back button works and restores previous answers
- [ ] Results screen renders after Q48 with no numerical scores visible
- [ ] "Download Summary" generates an HTML file
- [ ] "Start Over" returns to intro
- [ ] Growth Zone page at `/growth-zone` shows the Optimism card as live (not greyed out)
- [ ] Nav links work from the optimism page
- [ ] Mobile hamburger menu works
- [ ] ScottBot chat widget loads

---

## Files

| File | Action |
|------|--------|
| `crawford-optimism.html` | Add to repo root |
| `vercel.json` | Add rewrite for `/optimism` |
| `crawford-growth-zone.html` | Update Optimism card from "Coming Soon" to live link |
