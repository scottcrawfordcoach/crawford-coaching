# Growth Zone Email Reports — Strengths, Motivation & Optimism Extension

## Overview

Add the email report capture section to the three remaining assessment exercises (Character Strengths, Motivation, Optimism) and add dynamic model routing to the serverless function. The Feelings exercise does not get a report section.

This document assumes the Core Values implementation from the previous instruction doc is already deployed and working.

---

## Part 1: Model Routing in exercise-report.js

In `api/exercise-report.js`, find this line inside the `generateSummary` function:

```javascript
        model: 'claude-sonnet-4-20250514',
```

Replace it with:

```javascript
        model: priorResults.length >= 2
          ? 'claude-opus-4-20250514'
          : 'claude-sonnet-4-20250514',
```

This uses Sonnet for the first two reports and escalates to Opus once the user has enough cross-exercise context to benefit from deeper reasoning.

Note: the `priorResults` variable needs to be passed into `generateSummary`. Update the function signature and call.

Find the function signature:

```javascript
async function generateSummary({ anthropicKey, firstName, exerciseType, results, priorResults }) {
```

No change needed — `priorResults` is already passed in. The model selection line above has access to it.

---

## Part 2: Character Strengths — Email Report Section

### What the data looks like

The Strengths exercise produces two arrays stored on `window`:
- `ranked` — all 24 strengths sorted by score, each with `name`, `virtue`, `score`, `desc`, `id`
- `signature` — the top 5 (or more if tied), same shape

The results screen is `screen-results`. The insertion point is just before the restart button.

### HTML insertion target

In `crawford-strengths.html`, find this block inside `screen-results`:

```html
      <div class="results__download">
        <button class="btn-download" onclick="downloadSummary()">Download Summary</button>
      </div>
      <div class="results__restart">
        <button class="btn-restart" onclick="restart()">Start Over</button>
      </div>
```

Insert the following **before** the `results__download` div:

```html
      <!-- ── EMAIL REPORT OFFER ── -->
      <div class="report-offer" id="report-offer">
        <h3 class="report-offer__heading">Want a personalized report on your strengths?</h3>
        <p class="report-offer__text">Enter your name and email to receive an AI-generated coaching report based on your results. If you've completed other Growth Zone exercises, your report will draw connections across them.</p>
        <div class="report-offer__form">
          <input type="text" class="report-offer__input" id="report-name" placeholder="First name" autocomplete="given-name">
          <input type="email" class="report-offer__input" id="report-email" placeholder="Email address" autocomplete="email">
          <div class="report-offer__checkbox">
            <input type="checkbox" id="report-newsletter">
            <label for="report-newsletter">Also subscribe me to occasional emails from Crawford Coaching</label>
          </div>
          <div class="report-offer__actions">
            <button class="btn-blue" id="btn-send-report" onclick="requestReport()">Send my report</button>
            <button class="report-offer__privacy" onclick="openPrivacy()">How is my data used?</button>
          </div>
        </div>
        <p class="report-offer__status" id="report-status"></p>
      </div>

      <!-- ── PRIVACY MODAL ── -->
      <div class="privacy-modal" id="privacy-modal">
        <div class="privacy-modal__card">
          <button class="privacy-modal__close" onclick="closePrivacy()" aria-label="Close">&times;</button>
          <p class="privacy-modal__title">How your data is used</p>
          <p class="privacy-modal__text"><strong>Your exercise results</strong> are stored securely on Canadian servers. They are linked to your email address so that future exercise reports can reference your prior results and offer more connected insight.</p>
          <p class="privacy-modal__text"><strong>The AI-generated report</strong> is produced through a single, ephemeral API call to a language model. No personal identifiers beyond your first name are included in the request. The AI provider does not store your data or use it for training.</p>
          <p class="privacy-modal__text"><strong>Your information is never shared, sold, or used for any purpose other than delivering your reports</strong> and, if you opt in, occasional emails from Crawford Coaching. You can unsubscribe at any time.</p>
          <p class="privacy-modal__text">Questions? <a href="/contact" style="color:#4fa3d8;">Reach out directly</a>.</p>
        </div>
      </div>
```

### CSS additions

Add to the existing `<style>` block in `crawford-strengths.html`, before the closing `</style>` tag. Copy the full report-offer and privacy-modal CSS block from the Core Values page. It is identical — same class names, same styles.

(If you want to avoid duplicating CSS across pages, this is a good candidate for a shared stylesheet in a future refactor. For now, inline in each file matches the existing pattern.)

### JavaScript additions

Add the following inside the existing `<script>` block in `crawford-strengths.html`, after the `downloadSummary()` function and before the keyboard event listener:

```javascript
// ── Email Report ──

// Store ranked and signature at module level for report access
let _reportRanked = [];
let _reportSignature = [];

// Patch renderResults to capture data for report
const _originalRenderResults = renderResults;
renderResults = function(ranked, signature) {
  _reportRanked = ranked;
  _reportSignature = signature;
  _originalRenderResults(ranked, signature);
};

function requestReport() {
  const nameInput = document.getElementById('report-name');
  const emailInput = document.getElementById('report-email');
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const newsletter = document.getElementById('report-newsletter').checked;
  const btn = document.getElementById('btn-send-report');

  if (!name || !email) {
    showStatus('Please enter your name and email.', true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showStatus('Please enter a valid email address.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  showStatus('', false);

  const payload = {
    email,
    first_name: name,
    exercise_type: 'character_strengths',
    results: {
      signature: _reportSignature.map(s => ({
        name: s.name,
        virtue: s.virtue,
        score: s.score,
      })),
      ranked: _reportRanked.map(s => ({
        name: s.name,
        virtue: s.virtue,
        score: s.score,
      })),
    },
    newsletter_opt_in: newsletter,
  };

  fetch('/api/exercise-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showStatus('Something went wrong. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Send my report';
      } else {
        showStatus('Check your inbox. Your report is on its way.', false);
        btn.textContent = 'Sent';
        document.querySelector('.report-offer__form').style.opacity = '0.4';
        document.querySelector('.report-offer__form').style.pointerEvents = 'none';
      }
    })
    .catch(() => {
      showStatus('Something went wrong. Please try again.', true);
      btn.disabled = false;
      btn.textContent = 'Send my report';
    });
}

function showStatus(msg, isError) {
  const el = document.getElementById('report-status');
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
  el.classList.toggle('error', isError);
}

function openPrivacy() {
  document.getElementById('privacy-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrivacy() {
  document.getElementById('privacy-modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePrivacy();
});
document.getElementById('privacy-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePrivacy();
});
```

---

## Part 3: Motivation — Email Report Section

### What the data looks like

The Motivation exercise stores results in `window._motivationResults`:
- `scores` — object with keys `autonomy`, `mastery`, `purpose`, each containing `raw`, `max`, `avg`, `pct`, `band`, `bandLabel`
- `userName` — the name entered at the start

The results screen is `screen-results`. The insertion point is before the download/restart buttons.

### HTML insertion target

In `crawford-motivation.html`, find this block inside `screen-results`:

```html
      <div class="results__download">
        <button class="btn-download" onclick="downloadSummary()">Download Summary</button>
      </div>
      <div class="results__restart">
        <button class="btn-restart" onclick="restart()">Start Over</button>
      </div>
```

Insert the report offer and privacy modal HTML **before** the `results__download` div. Use the same HTML block as Character Strengths above, but change the heading to:

```html
        <h3 class="report-offer__heading">Want a personalized report on your motivation profile?</h3>
```

### CSS additions

Copy the same report-offer and privacy-modal CSS block into `crawford-motivation.html`'s `<style>` tag.

### JavaScript additions

Add the following inside the existing `<script>` block in `crawford-motivation.html`, after the `downloadSummary()` function and before the keyboard event listener:

```javascript
// ── Email Report ──

function requestReport() {
  const nameInput = document.getElementById('report-name');
  const emailInput = document.getElementById('report-email');
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const newsletter = document.getElementById('report-newsletter').checked;
  const btn = document.getElementById('btn-send-report');

  if (!name || !email) {
    showStatus('Please enter your name and email.', true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showStatus('Please enter a valid email address.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  showStatus('', false);

  const r = window._motivationResults;
  if (!r) {
    showStatus('No results found. Please complete the exercise first.', true);
    btn.disabled = false;
    btn.textContent = 'Send my report';
    return;
  }

  const payload = {
    email,
    first_name: name,
    exercise_type: 'motivation',
    results: {
      autonomy: r.scores.autonomy.raw,
      mastery: r.scores.mastery.raw,
      purpose: r.scores.purpose.raw,
      overall: r.scores.autonomy.raw + r.scores.mastery.raw + r.scores.purpose.raw,
      bands: {
        autonomy: r.scores.autonomy.bandLabel,
        mastery: r.scores.mastery.bandLabel,
        purpose: r.scores.purpose.bandLabel,
      },
    },
    newsletter_opt_in: newsletter,
  };

  fetch('/api/exercise-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showStatus('Something went wrong. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Send my report';
      } else {
        showStatus('Check your inbox. Your report is on its way.', false);
        btn.textContent = 'Sent';
        document.querySelector('.report-offer__form').style.opacity = '0.4';
        document.querySelector('.report-offer__form').style.pointerEvents = 'none';
      }
    })
    .catch(() => {
      showStatus('Something went wrong. Please try again.', true);
      btn.disabled = false;
      btn.textContent = 'Send my report';
    });
}

function showStatus(msg, isError) {
  const el = document.getElementById('report-status');
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
  el.classList.toggle('error', isError);
}

function openPrivacy() {
  document.getElementById('privacy-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrivacy() {
  document.getElementById('privacy-modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePrivacy();
});
document.getElementById('privacy-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePrivacy();
});
```

---

## Part 4: Optimism — Email Report Section

### What the data looks like

The Optimism exercise stores results in `window._optimismResults`:
- `subscales` — object with keys `PmB`, `PmG`, `PvB`, `PvG`, `PsB`, `PsG` (raw scores)
- `HoB` — hopelessness score (PvB + PmB)
- `totalB` — total bad subscale score
- `totalG` — total good subscale score
- `GB` — overall composite (totalG - totalB)
- `userName`

The results screen is `screen-results`. The insertion point is before the download/restart buttons.

### HTML insertion target

In `crawford-optimism.html`, find this block inside `screen-results`:

```html
      <div class="results__download">
        <button class="btn-download" onclick="downloadSummary()">Download Summary</button>
      </div>
      <div class="results__restart">
        <button class="btn-restart" onclick="restart()">Start Over</button>
      </div>
```

Insert the report offer and privacy modal HTML **before** the `results__download` div. Use the same HTML block, but change the heading to:

```html
        <h3 class="report-offer__heading">Want a personalized report on your explanatory style?</h3>
```

### CSS additions

Copy the same report-offer and privacy-modal CSS block into `crawford-optimism.html`'s `<style>` tag.

### JavaScript additions

Add the following inside the existing `<script>` block in `crawford-optimism.html`, after the `downloadSummary()` function and before the keyboard event listener:

```javascript
// ── Email Report ──

function requestReport() {
  const nameInput = document.getElementById('report-name');
  const emailInput = document.getElementById('report-email');
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const newsletter = document.getElementById('report-newsletter').checked;
  const btn = document.getElementById('btn-send-report');

  if (!name || !email) {
    showStatus('Please enter your name and email.', true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showStatus('Please enter a valid email address.', true);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  showStatus('', false);

  const r = window._optimismResults;
  if (!r) {
    showStatus('No results found. Please complete the exercise first.', true);
    btn.disabled = false;
    btn.textContent = 'Send my report';
    return;
  }

  const payload = {
    email,
    first_name: name,
    exercise_type: 'optimism',
    results: {
      PmB: r.subscales.PmB,
      PmG: r.subscales.PmG,
      PvB: r.subscales.PvB,
      PvG: r.subscales.PvG,
      PsB: r.subscales.PsB,
      PsG: r.subscales.PsG,
      composite: r.GB,
      hope: r.HoB,
    },
    newsletter_opt_in: newsletter,
  };

  fetch('/api/exercise-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showStatus('Something went wrong. Please try again.', true);
        btn.disabled = false;
        btn.textContent = 'Send my report';
      } else {
        showStatus('Check your inbox. Your report is on its way.', false);
        btn.textContent = 'Sent';
        document.querySelector('.report-offer__form').style.opacity = '0.4';
        document.querySelector('.report-offer__form').style.pointerEvents = 'none';
      }
    })
    .catch(() => {
      showStatus('Something went wrong. Please try again.', true);
      btn.disabled = false;
      btn.textContent = 'Send my report';
    });
}

function showStatus(msg, isError) {
  const el = document.getElementById('report-status');
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
  el.classList.toggle('error', isError);
}

function openPrivacy() {
  document.getElementById('privacy-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrivacy() {
  document.getElementById('privacy-modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePrivacy();
});
document.getElementById('privacy-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closePrivacy();
});
```

---

## Part 5: Updated Motivation Context for Claude

The `buildExerciseContext` function in `exercise-report.js` already handles the `motivation` case, but now that we're sending band labels too, update it to include them:

Find this in `api/exercise-report.js`:

```javascript
    case 'motivation':
      return {
        label: 'Motivation & Self-Determination',
        summary: `Autonomy: ${results.autonomy}/30\nMastery: ${results.mastery}/30\nPurpose: ${results.purpose}/30\nOverall: ${results.overall}/90`,
      };
```

Replace with:

```javascript
    case 'motivation':
      return {
        label: 'Motivation & Self-Determination',
        summary: `Autonomy: ${results.autonomy}/30 (${results.bands?.autonomy || 'unscored'})\nMastery: ${results.mastery}/30 (${results.bands?.mastery || 'unscored'})\nPurpose: ${results.purpose}/30 (${results.bands?.purpose || 'unscored'})\nOverall: ${results.overall}/90`,
      };
```

---

## Part 6: Email Styling Updates & AI Disclaimer

These are all find-and-replace changes inside the `buildEmailHtml` and `buildResultsSection` functions in `api/exercise-report.js`.

### 6a. AI summary paragraph colour

Find:
```javascript
color:#3d4a58;">${escapeHtml(p)}</p>
```
Replace with:
```javascript
color:#c8d4de;">${escapeHtml(p)}</p>
```

### 6b. Fallback summary colour

Find:
```javascript
color:#7a8fa3;font-style:italic;">Your personalized summary
```
Replace with:
```javascript
color:#9ab0c4;font-style:italic;">Your personalized summary
```

### 6c. Header brand text

Find:
```javascript
color:#7a8fa3;">Crawford Coaching · Growth Zone</p>
```
Replace with:
```javascript
color:#9ab0c4;">Crawford Coaching · Growth Zone</p>
```

### 6d. CTA footer text

Find:
```javascript
line-height:1.7;color:#7a8fa3;">Your results are saved
```
Replace with:
```javascript
line-height:1.7;color:#9ab0c4;">Your results are saved
```

### 6e. Core Values "broader ten" text

Find:
```javascript
font-size:12px;color:#7a8fa3;">From your broader ten
```
Replace with:
```javascript
font-size:12px;color:#9ab0c4;">From your broader ten
```

### 6f. Motivation "Overall" text

Find:
```javascript
font-size:13px;color:#7a8fa3;">Overall:
```
Replace with:
```javascript
font-size:13px;color:#9ab0c4;">Overall:
```

### 6g. Footer brand link colour

Find:
```javascript
font-size:11px;color:#3d4a58;">crawford-coaching.ca</p>
```
Replace with:
```javascript
font-size:11px;color:#9ab0c4;">crawford-coaching.ca</p>
```

### 6h. Unsubscribe link colour

Find:
```javascript
font-size:10px;color:#3d4a58;">
      <a href="{{UNSUBSCRIBE_URL}}" style="color:#3d4a58;
```
Replace with:
```javascript
font-size:10px;color:#9ab0c4;">
      <a href="{{UNSUBSCRIBE_URL}}" style="color:#9ab0c4;
```

### 6i. AI disclaimer block

Find this boundary between the CTAs section and the Footer section:
```javascript
  </div>

  <!-- Footer -->
```
Replace with:
```javascript
  </div>

  <!-- AI Disclaimer -->
  <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;line-height:1.7;color:#3d4a58;font-style:italic;">This report was generated by an AI language model based on your exercise results. AI-generated content can contain errors or miss nuance. Use it as a starting point for reflection, not as a definitive assessment.</p>
  </div>

  <!-- Footer -->
```

---

## Part 7: Deploy Checklist

1. Update `api/exercise-report.js` with the model routing (Part 1), motivation context update (Part 5), and email styling/disclaimer (Part 6)
2. Add report section CSS, HTML, and JS to `crawford-strengths.html` (Part 2)
3. Add report section CSS, HTML, and JS to `crawford-motivation.html` (Part 3)
4. Add report section CSS, HTML, and JS to `crawford-optimism.html` (Part 4)
5. Commit and push
6. Test each exercise by completing it and requesting a report
7. Test cross-exercise: complete a second exercise with the same email and verify the report references prior results
8. Verify email renders correctly with updated colours and disclaimer

---

## Notes

- The `btn-blue` class used on the submit button should already exist in each exercise page's CSS. If it doesn't exist in a specific file, add: `.btn-blue { font-family: var(--sans); font-weight: 400; font-size: 0.72rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.85rem 2rem; background: var(--brand-blue); color: var(--white); border: none; cursor: pointer; border-radius: 1px; transition: background 0.2s; } .btn-blue:hover { background: var(--brand-blue-light); } .btn-blue:disabled { opacity: 0.5; cursor: not-allowed; }`

- The Strengths exercise uses a wrapper pattern to capture `ranked` and `signature` because those variables are local to the `calculateResults` / `renderResults` call chain. The wrapper intercepts the data without modifying the existing functions.

- The Motivation and Optimism exercises already store their results on `window._motivationResults` and `window._optimismResults`, so no wrapper is needed.

- No changes to the serverless function's `buildResultsSection` or `buildExerciseContext` are needed for Strengths or Optimism. They're already handled.

- The Feelings exercise (`/feelings`) does not get a report section.
