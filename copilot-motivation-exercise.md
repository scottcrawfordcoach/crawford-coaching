# Copilot Instructions: Motivation & Self-Determination Exercise

## Overview

Add a new Growth Zone exercise page for the Motivation & Self-Determination tool. This is a self-scored interactive exercise based on Self-Determination Theory (autonomy, mastery, purpose). It follows the same architectural pattern as `crawford-strengths.html`: intro screen → quiz (18 questions) → results screen with downloadable HTML summary.

**Two files to touch:**
1. **New file:** `crawford-motivation.html` (the exercise page)
2. **Existing file:** `crawford-growth-zone.html` (update the tool card from "coming soon" to live link)

**Plus one config update:**
3. **Existing file:** `vercel.json` (add URL rewrite for `/motivation` route)

---

## Task 1: Add the new page file

Create a new file called `crawford-motivation.html` in the project root (same level as `crawford-strengths.html`, `crawford-growth-zone.html`, etc.).

Copy the entire contents of the prototype file `crawford-motivation.html` provided alongside this instruction document. The file is complete and ready to use as-is. No modifications needed.

The file is approximately 1,787 lines and includes all HTML, CSS, and JavaScript inline (same pattern as every other page on the site).

---

## Task 2: Update the Growth Zone tool card

In `crawford-growth-zone.html`, find the **Optimism & Explanatory Style** coming-soon card and add a new live Motivation card directly before it.

### Find this block (around line 462):

```html
      <!-- OPTIMISM & EXPLANATORY STYLE -->
      <div class="tool-card tool-card--coming-soon">
        <div class="tool-card__icon">🔭</div>
        <h2 class="tool-card__title">Optimism & Explanatory Style</h2>
```

### Insert this block directly BEFORE it:

```html
      <!-- MOTIVATION & SELF-DETERMINATION -->
      <div class="tool-card">
        <div class="tool-card__icon">🔥</div>
        <h2 class="tool-card__title">Motivation & Self-Determination</h2>
        <p class="tool-card__desc">Motivation is not one thing. This exercise helps you understand how your three core motivational needs — autonomy, mastery, and purpose — are being met right now, and where they might need attention.</p>
        <a href="/motivation" class="tool-card__link">Explore Your Motivation</a>
      </div>

```

**Result:** The tools grid should now show (in order): Interval Timer, Core Values (coming soon), Character Strengths (coming soon), **Motivation & Self-Determination (live)**, Optimism & Explanatory Style (coming soon), Feelings Naming Guide (coming soon).

---

## Task 3: Add the Vercel URL rewrite

In `vercel.json`, add a rewrite rule for the `/motivation` route. Find the existing rewrites array and add this entry alongside the others:

```json
{ "source": "/motivation", "destination": "/crawford-motivation.html" }
```

This follows the same pattern as the existing routes (e.g., `/strengths` → `/crawford-strengths.html`, `/growth-zone` → `/crawford-growth-zone.html`).

---

## Deploy Checklist

After implementing:

- [ ] `crawford-motivation.html` exists in project root
- [ ] Growth Zone page shows the Motivation card as a live (not coming-soon) tile
- [ ] Motivation card links to `/motivation`
- [ ] `vercel.json` has the `/motivation` rewrite
- [ ] Local preview: navigate to `/motivation`, confirm intro screen loads
- [ ] Local preview: click Begin, answer a few questions, confirm progress bar and navigation work
- [ ] Local preview: complete all 18 questions, confirm results screen renders with three pillar cards, spectrum bars, and reflection questions
- [ ] Local preview: click Download Summary, confirm HTML file downloads
- [ ] Local preview: mobile hamburger nav works on the new page
- [ ] Local preview: Growth Zone grid displays correctly with the new live card
- [ ] Git commit and push
- [ ] Verify on Vercel deployment

---

## Notes

- The new page uses `Growth Zone` as the active nav link (same as Character Strengths)
- The ScottBot widget script tag is included at the bottom of the page
- All CSS is inline (no external stylesheet dependencies beyond Google Fonts)
- The exercise shuffles question order on each run but keeps pillar groupings loosely interleaved
- Keyboard shortcuts work during the quiz: 1-5 to rate, arrow keys / Enter to navigate
- The downloadable summary is a self-contained HTML file with Crawford branding (same pattern as the Character Strengths download)
