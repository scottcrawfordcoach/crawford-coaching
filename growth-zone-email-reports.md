# Growth Zone Email Reports — Build Instructions

## Overview

Add an email capture + AI-generated report system to Growth Zone exercises. Users complete the exercise as normal, then optionally provide name and email to receive a personalized insight report. The system stores their results in Supabase, generates interpretive content via Claude API, and emails it via Resend.

Starting with **Core Values**. The pattern will extend to all exercises.

---

## Architecture

```
Browser (Core Values page)
    │
    ▼  POST /api/exercise-report
Vercel Serverless Function (exercise-report.js)
    │
    ├─► data-handler: contact_upsert (create/update contact)
    ├─► data-handler: exercise_result_save (store results)
    ├─► data-handler: exercise_results_lookup (get prior results)
    ├─► Claude API: generate personalized summary
    └─► mail-sender: send HTML email via Resend
```

All Vercel-to-Supabase calls use the existing Bearer token pattern from `subscribe.js`.

---

## Part 1: Supabase Schema

Run this SQL in your Supabase SQL Editor to create the `exercise_results` table:

```sql
-- Exercise results table
CREATE TABLE IF NOT EXISTS public.exercise_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  exercise_type text NOT NULL,
  results_json jsonb NOT NULL,
  ai_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercise_results_pkey PRIMARY KEY (id),
  CONSTRAINT exercise_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE
);

-- Index for lookups by contact
CREATE INDEX IF NOT EXISTS idx_exercise_results_contact
  ON public.exercise_results(contact_id);

-- Index for lookups by exercise type
CREATE INDEX IF NOT EXISTS idx_exercise_results_type
  ON public.exercise_results(exercise_type);

-- Allows multiple results per exercise (retakes)
-- Most recent is used for cross-exercise context
```

---

## Part 2: Data-Handler Updates

Add two new actions to your existing `data-handler` edge function's switch block:

### Action: `exercise_result_save`

```typescript
case "exercise_result_save": {
  const { contact_id, exercise_type, results_json, ai_summary } = payload;

  if (!contact_id || !exercise_type || !results_json) {
    return respond(400, { error: "contact_id, exercise_type, and results_json are required" });
  }

  const { data, error } = await supabase
    .from("exercise_results")
    .insert({
      contact_id,
      exercise_type,
      results_json,
      ai_summary: ai_summary || null,
    })
    .select("id, exercise_type, created_at")
    .single();

  if (error) return respond(400, { error: error.message });
  return respond(200, { data });
}
```

### Action: `exercise_results_lookup`

```typescript
case "exercise_results_lookup": {
  const { contact_id } = payload;

  if (!contact_id) {
    return respond(400, { error: "contact_id is required" });
  }

  // Get the most recent result for each exercise type
  const { data, error } = await supabase
    .from("exercise_results")
    .select("exercise_type, results_json, ai_summary, created_at")
    .eq("contact_id", contact_id)
    .order("created_at", { ascending: false });

  if (error) return respond(400, { error: error.message });

  // Deduplicate: keep only the most recent per exercise type
  const seen = new Set();
  const latest = (data || []).filter(r => {
    if (seen.has(r.exercise_type)) return false;
    seen.add(r.exercise_type);
    return true;
  });

  return respond(200, { data: latest });
}
```

### Action: `exercise_result_update`

```typescript
case "exercise_result_update": {
  const { id, ai_summary } = payload;

  if (!id) return respond(400, { error: "id is required" });

  const { error } = await supabase
    .from("exercise_results")
    .update({ ai_summary })
    .eq("id", id);

  if (error) return respond(400, { error: error.message });
  return respond(200, { data: { updated: true } });
}
```

---

## Part 3: Vercel Serverless Function

Create file: **`api/exercise-report.js`**

```javascript
/**
 * /api/exercise-report — Vercel Serverless Function
 * Handles Growth Zone exercise report generation and delivery.
 *
 * POST /api/exercise-report
 * Body: { email, first_name, exercise_type, results, newsletter_opt_in }
 *
 * Flow:
 *   1. Upsert contact via data-handler
 *   2. Look up prior exercise results
 *   3. Save current exercise results
 *   4. Generate AI summary via Claude API
 *   5. Update saved result with AI summary
 *   6. Send HTML email via mail-sender
 *
 * Environment variables required:
 *   DATA_HANDLER_BEARER_TOKEN
 *   MAIL_SENDER_BEARER_TOKEN
 *   ANTHROPIC_API_KEY
 */

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';
const MAIL_SENDER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/mail-sender';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const dhToken = process.env.DATA_HANDLER_BEARER_TOKEN;
  const msToken = process.env.MAIL_SENDER_BEARER_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!dhToken || !msToken || !anthropicKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { email, first_name, exercise_type, results, newsletter_opt_in } = body || {};

  if (!email || !first_name || !exercise_type || !results) {
    return res.status(400).json({ error: 'email, first_name, exercise_type, and results are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const dhHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${dhToken}`,
  };

  try {
    // ── Step 1: Upsert contact ──
    const subscriptions = { newsletter: !!newsletter_opt_in };
    const upsertRes = await fetch(DATA_HANDLER, {
      method: 'POST',
      headers: dhHeaders,
      body: JSON.stringify({
        action: 'contact_upsert',
        payload: {
          email: cleanEmail,
          first_name: first_name.trim(),
          email_consent: true,
          offer: 'growth_zone_report',
          subscriptions,
        },
      }),
    });
    const upsertResult = await upsertRes.json();
    if (upsertResult.error) {
      return res.status(400).json({ error: 'Failed to save contact: ' + upsertResult.error });
    }

    const contactId = upsertResult.data?.id || upsertResult.data?.contact_id;
    if (!contactId) {
      return res.status(500).json({ error: 'Contact created but no ID returned' });
    }

    // ── Step 2: Look up prior exercise results ──
    let priorResults = [];
    try {
      const lookupRes = await fetch(DATA_HANDLER, {
        method: 'POST',
        headers: dhHeaders,
        body: JSON.stringify({
          action: 'exercise_results_lookup',
          payload: { contact_id: contactId },
        }),
      });
      const lookupResult = await lookupRes.json();
      if (lookupResult.data) {
        priorResults = lookupResult.data;
      }
    } catch {
      // Non-fatal: continue without prior context
    }

    // ── Step 3: Save current exercise results ──
    const saveRes = await fetch(DATA_HANDLER, {
      method: 'POST',
      headers: dhHeaders,
      body: JSON.stringify({
        action: 'exercise_result_save',
        payload: {
          contact_id: contactId,
          exercise_type,
          results_json: results,
        },
      }),
    });
    const saveResult = await saveRes.json();
    const resultId = saveResult.data?.id;

    // ── Step 4: Generate AI summary ──
    const aiSummary = await generateSummary({
      anthropicKey,
      firstName: first_name.trim(),
      exerciseType: exercise_type,
      results,
      priorResults,
    });

    // ── Step 5: Update result row with AI summary ──
    if (resultId && aiSummary) {
      fetch(DATA_HANDLER, {
        method: 'POST',
        headers: dhHeaders,
        body: JSON.stringify({
          action: 'exercise_result_update',
          payload: { id: resultId, ai_summary: aiSummary },
        }),
      }).catch(() => {}); // fire-and-forget
    }

    // ── Step 6: Send email via mail-sender ──
    const htmlEmail = buildEmailHtml({
      firstName: first_name.trim(),
      exerciseType: exercise_type,
      results,
      aiSummary,
    });

    const subjectMap = {
      core_values: 'Your Core Values Report',
      character_strengths: 'Your Character Strengths Report',
      optimism: 'Your Optimism & Explanatory Style Report',
      motivation: 'Your Motivation & Self-Determination Report',
      feelings: 'Your Feelings Naming Guide Summary',
    };

    await fetch(MAIL_SENDER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${msToken}`,
      },
      body: JSON.stringify({
        action: 'send_campaign',
        payload: {
          campaign_type: 'general',
          subject: subjectMap[exercise_type] || 'Your Growth Zone Report',
          html_body: htmlEmail,
          recipients: [{
            email: cleanEmail,
            first_name: first_name.trim(),
            contact_id: contactId,
          }],
        },
      }),
    });

    // ── Step 7: Log engagement ──
    fetch(DATA_HANDLER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'engagement_log',
        payload: {
          source: 'crawford-site/growth-zone',
          action: 'exercise_report_requested',
          email_hint: cleanEmail,
          metadata: { exercise_type },
        },
      }),
    }).catch(() => {});

    return res.status(200).json({ data: { success: true } });

  } catch (err) {
    console.error('exercise-report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}


// ═══════════════════════════════════════════════════
// Claude API — Summary Generation
// ═══════════════════════════════════════════════════

async function generateSummary({ anthropicKey, firstName, exerciseType, results, priorResults }) {
  const exerciseContext = buildExerciseContext(exerciseType, results);
  const priorContext = buildPriorContext(priorResults, exerciseType);

  const systemPrompt = `You are a coaching assistant writing personalized exercise reports for Crawford Coaching (crawford-coaching.ca). Scott Crawford is an ICF Associate Certified Coach and Certified Personal Trainer based in Kingston, Ontario.

Your tone is direct, warm, and honest. You write the way a thoughtful coach talks: no buzzwords, no fluff, no em-dashes. You help people see themselves more clearly without judging them.

Key principles:
- Self-understanding comes before planning. Help people see what they've revealed about themselves before jumping to action items.
- Use their name naturally (once or twice, not every paragraph).
- Write in second person ("you") and keep sentences clean.
- Do not use phrases like "it's clear that" or "this suggests that you are" — just say it directly.
- No emoji, no exclamation marks, no "Great job!" energy.
- Keep the total response to 3-5 paragraphs. Concise and meaningful.
- If prior exercise results are available, weave in connections naturally. Don't force it. Only reference prior results when a genuine insight emerges from the combination.
- End with a single reflective question, not a list of action items.`;

  let userPrompt = `Write a personalized report for ${firstName} based on their ${exerciseContext.label} results.\n\n`;
  userPrompt += `Their results:\n${exerciseContext.summary}\n\n`;

  if (priorContext) {
    userPrompt += `Prior exercise results for context (reference only if a genuine connection exists):\n${priorContext}\n\n`;
  }

  userPrompt += `Write 3-5 paragraphs of insight. End with one reflective question.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();
    const text = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return text || null;
  } catch (err) {
    console.error('Claude API error:', err);
    return null;
  }
}

function buildExerciseContext(exerciseType, results) {
  switch (exerciseType) {
    case 'core_values':
      return {
        label: 'Core Values',
        summary: `Core values selected: ${(results.core_values || []).join(', ')}\nFull ten values considered: ${(results.ten_values || []).join(', ')}`,
      };
    case 'character_strengths':
      return {
        label: 'Character Strengths',
        summary: `Top 5 signature strengths (ranked):\n${(results.signature || []).map((s, i) => `${i+1}. ${s.name} (${s.virtue}) — ${s.score}/5`).join('\n')}\n\nFull ranking:\n${(results.ranked || []).map((s, i) => `${i+1}. ${s.name} — ${s.score}/5`).join('\n')}`,
      };
    case 'optimism':
      return {
        label: 'Optimism & Explanatory Style',
        summary: `Composite score: ${results.composite}\nPermanence (bad): ${results.PmB}\nPermanence (good): ${results.PmG}\nPervasiveness (bad): ${results.PvB}\nPervasiveness (good): ${results.PvG}\nPersonalisation (bad): ${results.PsB}\nPersonalisation (good): ${results.PsG}\nHope score: ${results.hope}`,
      };
    case 'motivation':
      return {
        label: 'Motivation & Self-Determination',
        summary: `Autonomy: ${results.autonomy}/30\nMastery: ${results.mastery}/30\nPurpose: ${results.purpose}/30\nOverall: ${results.overall}/90`,
      };
    default:
      return {
        label: exerciseType,
        summary: JSON.stringify(results, null, 2),
      };
  }
}

function buildPriorContext(priorResults, currentExercise) {
  if (!priorResults || priorResults.length === 0) return null;

  const other = priorResults.filter(r => r.exercise_type !== currentExercise);
  if (other.length === 0) return null;

  return other.map(r => {
    const ctx = buildExerciseContext(r.exercise_type, r.results_json);
    return `${ctx.label}:\n${ctx.summary}`;
  }).join('\n\n');
}


// ═══════════════════════════════════════════════════
// Email HTML Builder
// ═══════════════════════════════════════════════════

function buildEmailHtml({ firstName, exerciseType, results, aiSummary }) {
  const exerciseLabels = {
    core_values: 'Core Values',
    character_strengths: 'Character Strengths',
    optimism: 'Optimism & Explanatory Style',
    motivation: 'Motivation & Self-Determination',
    feelings: 'Feelings Naming Guide',
  };

  const label = exerciseLabels[exerciseType] || exerciseType;
  const resultsHtml = buildResultsSection(exerciseType, results);
  const summaryHtml = aiSummary
    ? aiSummary.split('\n\n').map(p => `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.75;color:#3d4a58;">${escapeHtml(p)}</p>`).join('')
    : '<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#7a8fa3;font-style:italic;">Your personalized summary could not be generated at this time.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(firstName)}'s ${escapeHtml(label)} Report</title>
</head>
<body style="margin:0;padding:0;background:#0e0f10;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:600px;margin:0 auto;background:#1c2330;">

  <!-- Header -->
  <div style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7a8fa3;">Crawford Coaching · Growth Zone</p>
    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:300;font-size:26px;line-height:1.2;color:#f5f3ef;">${escapeHtml(firstName)}'s ${escapeHtml(label)} Report</h1>
  </div>

  <!-- Results snapshot -->
  <div style="padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#4fa3d8;">Your Results</p>
    ${resultsHtml}
  </div>

  <!-- AI Summary -->
  <div style="padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#4fa3d8;">Your Personalized Insight</p>
    ${summaryHtml}
  </div>

  <!-- CTAs -->
  <div style="padding:32px 40px;">
    <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#7a8fa3;">Your results are saved. As you complete more Growth Zone exercises, future reports will draw on everything you've done to offer deeper, more connected insight.</p>
    <p style="margin:24px 0 0;">
      <a href="https://crawford-coaching.ca/growth-zone" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4fa3d8;text-decoration:none;">Explore the Growth Zone &#8594;</a>
    </p>
    <p style="margin:12px 0 0;">
      <a href="https://calendar.app.google/R66fNg5m7w3aKPKd6" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4fa3d8;text-decoration:none;">Book a free intro call &#8594;</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#3d4a58;">crawford-coaching.ca</p>
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#3d4a58;">
      <a href="{{UNSUBSCRIBE_URL}}" style="color:#3d4a58;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>

</div>
<!-- {{OPEN_PIXEL}} -->
</body>
</html>`;
}

function buildResultsSection(exerciseType, results) {
  switch (exerciseType) {
    case 'core_values': {
      const coreVals = (results.core_values || []);
      const pills = coreVals.map(v =>
        `<span style="display:inline-block;margin:0 8px 8px 0;padding:8px 16px;font-family:Georgia,serif;font-size:16px;font-style:italic;color:#4fa3d8;border:1px solid rgba(45,134,196,0.4);background:rgba(45,134,196,0.08);">${escapeHtml(v)}</span>`
      ).join('');
      const tenVals = (results.ten_values || []).join(', ');
      return `
        <div style="margin-bottom:16px;">${pills}</div>
        <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#7a8fa3;">From your broader ten: ${escapeHtml(tenVals)}</p>
      `;
    }
    case 'character_strengths': {
      const sig = (results.signature || []).slice(0, 5);
      const rows = sig.map((s, i) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;font-family:Georgia,serif;font-size:14px;color:rgba(45,134,196,0.4);font-style:italic;vertical-align:top;">${i+1}</td>
          <td style="padding:6px 0;font-family:Georgia,serif;font-size:15px;color:#f5f3ef;">${escapeHtml(s.name)}</td>
        </tr>`
      ).join('');
      return `<table style="border-collapse:collapse;">${rows}</table>`;
    }
    case 'optimism': {
      return `<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#c8d4de;line-height:1.7;">Your explanatory style results have been recorded. See the personalized insight below for what they mean.</p>`;
    }
    case 'motivation': {
      return `
        <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:15px;color:#c8d4de;">Autonomy: ${results.autonomy}/30 &middot; Mastery: ${results.mastery}/30 &middot; Purpose: ${results.purpose}/30</p>
        <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#7a8fa3;">Overall: ${results.overall}/90</p>
      `;
    }
    default:
      return `<p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#7a8fa3;">Results recorded.</p>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

---

## Part 4: Front-End — Core Values Email Capture

### CSS additions

Add the following CSS inside the existing `<style>` block in `crawford-core-values.html`, before the closing `</style>` tag:

```css
/* ── EMAIL REPORT SECTION ── */
.report-offer {
  margin-top: 3rem;
  padding: 2.5rem 2rem;
  border: 1px solid rgba(45,134,196,0.2);
  background: rgba(45,134,196,0.04);
  border-radius: 1px;
}
.report-offer__heading {
  font-family: var(--serif-display);
  font-weight: 400;
  font-size: 1.4rem;
  line-height: 1.3;
  color: var(--white);
  margin-bottom: 0.8rem;
}
.report-offer__text {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.88rem;
  line-height: 1.8;
  color: var(--mist);
  margin-bottom: 1.5rem;
}
.report-offer__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 400px;
}
.report-offer__input {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.9rem;
  color: var(--white);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--fog);
  padding: 0.6rem 0;
  outline: none;
  transition: border-color 0.3s;
}
.report-offer__input::placeholder { color: var(--mist); }
.report-offer__input:focus { border-color: var(--brand-blue); }

.report-offer__checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
.report-offer__checkbox input[type="checkbox"] {
  margin-top: 0.25rem;
  accent-color: var(--brand-blue);
  flex-shrink: 0;
}
.report-offer__checkbox label {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.78rem;
  color: var(--mist);
  line-height: 1.6;
  cursor: pointer;
}

.report-offer__actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.report-offer__privacy {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.7rem;
  color: var(--fog);
  cursor: pointer;
  background: none;
  border: none;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.2s;
}
.report-offer__privacy:hover { color: var(--mist); }

.report-offer__status {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.82rem;
  color: var(--brand-blue-light);
  margin-top: 1rem;
  display: none;
}
.report-offer__status.visible { display: block; }
.report-offer__status.error { color: #c44; }

/* ── PRIVACY MODAL ── */
.privacy-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(14,15,16,0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.privacy-modal.open { display: flex; }
.privacy-modal__card {
  max-width: 520px;
  width: 100%;
  background: var(--slate);
  border: 1px solid var(--fog);
  padding: 2.5rem;
  position: relative;
}
.privacy-modal__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: var(--mist);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s;
}
.privacy-modal__close:hover { color: var(--white); }
.privacy-modal__title {
  font-family: var(--sans);
  font-weight: 400;
  font-size: 0.68rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--brand-blue);
  margin-bottom: 1.2rem;
}
.privacy-modal__text {
  font-family: var(--sans);
  font-weight: 300;
  font-size: 0.85rem;
  line-height: 1.85;
  color: var(--pale);
  margin-bottom: 1rem;
}
.privacy-modal__text:last-child { margin-bottom: 0; }
.privacy-modal__text strong {
  color: var(--white);
  font-weight: 400;
}
```

### HTML additions

In the `screen-reflect` div, find this exact block:

```html
      <button class="btn-ghost" onclick="showScreen('screen-core')">&larr; Back to core values</button>
      <button class="restart-link" onclick="restart()">&larr; Start over</button>
```

Insert the following **before** those two buttons:

```html
      <!-- ── EMAIL REPORT OFFER ── -->
      <div class="report-offer" id="report-offer">
        <h3 class="report-offer__heading">Want deeper insight on your values?</h3>
        <p class="report-offer__text">Enter your name and email to receive a personalized report with AI-generated coaching insight based on your results. If you've completed other Growth Zone exercises, your report will draw connections across them.</p>
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

### JavaScript additions

Add the following inside the existing `<script>` block, after the `restart()` function and before `buildTenGrid();`:

```javascript
// ── Email Report ──

function requestReport() {
  const name = document.getElementById('report-name').value.trim();
  const email = document.getElementById('report-email').value.trim();
  const newsletter = document.getElementById('report-newsletter').checked;
  const statusEl = document.getElementById('report-status');
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
    exercise_type: 'core_values',
    results: {
      core_values: [...coreSelected],
      ten_values: [...tenFinal],
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

## Part 5: Environment Variables

Add these to your Vercel project settings (Settings > Environment Variables):

- `ANTHROPIC_API_KEY` — your Anthropic API key
- `MAIL_SENDER_BEARER_TOKEN` — the Bearer token for your mail-sender edge function

`DATA_HANDLER_BEARER_TOKEN` should already be set from the subscribe/preferences functions.

---

## Part 6: Deploy Checklist

1. Run the SQL from Part 1 in Supabase SQL Editor
2. Add the three new actions to your `data-handler` edge function (Parts 2)
3. Redeploy `data-handler`: `supabase functions deploy data-handler --no-verify-jwt`
4. Create `api/exercise-report.js` in your site repo (Part 3)
5. Update `crawford-core-values.html` with the CSS, HTML, and JS from Part 4
6. Add environment variables in Vercel (Part 5)
7. Commit and push
8. Test: complete Core Values exercise, enter email on reflection screen, check inbox

No `vercel.json` update needed. Vercel auto-routes `/api/exercise-report` to `api/exercise-report.js`.

---

## Extending to Other Exercises

Once Core Values is working, adding support for other exercises requires only:

1. **Front-end**: Add the same email capture HTML/CSS to each exercise's results screen. Change the `exercise_type` and `results` payload in the `requestReport()` function to match that exercise's data shape.

2. **Serverless function**: Already handles all exercise types via the `buildExerciseContext()` switch. No changes needed.

3. **Email builder**: Already handles all types via `buildResultsSection()`. No changes needed.

The `exercise_type` values to use:
- `core_values`
- `character_strengths`
- `optimism`
- `motivation`
- `feelings`
