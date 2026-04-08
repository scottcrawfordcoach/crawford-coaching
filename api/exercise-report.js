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
        model: priorResults.length >= 2
          ? 'claude-opus-4-20250514'
          : 'claude-sonnet-4-20250514',
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
        summary: `Autonomy: ${results.autonomy}/30 (${results.bands?.autonomy || 'unscored'})\nMastery: ${results.mastery}/30 (${results.bands?.mastery || 'unscored'})\nPurpose: ${results.purpose}/30 (${results.bands?.purpose || 'unscored'})\nOverall: ${results.overall}/90`,
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
    ? aiSummary.split('\n\n').map(p => `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.75;color:#c8d4de;">${escapeHtml(p)}</p>`).join('')
    : '<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#9ab0c4;font-style:italic;">Your personalized summary could not be generated at this time.</p>';

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
    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:300;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9ab0c4;">Crawford Coaching · Growth Zone</p>
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
    <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:14px;line-height:1.7;color:#9ab0c4;">Your results are saved. As you complete more Growth Zone exercises, future reports will draw on everything you've done to offer deeper, more connected insight.</p>
    <p style="margin:24px 0 0;">
      <a href="https://crawford-coaching.ca/growth-zone" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4fa3d8;text-decoration:none;">Explore the Growth Zone &#8594;</a>
    </p>
    <p style="margin:12px 0 0;">
      <a href="https://calendar.app.google/R66fNg5m7w3aKPKd6" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4fa3d8;text-decoration:none;">Book a free intro call &#8594;</a>
    </p>
  </div>

  <!-- AI Disclaimer -->
  <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;line-height:1.7;color:#3d4a58;font-style:italic;">This report was generated by an AI language model based on your exercise results. AI-generated content can contain errors or miss nuance. Use it as a starting point for reflection, not as a definitive assessment.</p>
  </div>

  <!-- Footer -->
  <div style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#9ab0c4;">crawford-coaching.ca</p>
    <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:#9ab0c4;">
      <a href="{{UNSUBSCRIBE_URL}}" style="color:#9ab0c4;text-decoration:underline;">Unsubscribe</a>
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
        <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#9ab0c4;">From your broader ten: ${escapeHtml(tenVals)}</p>
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
        <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#9ab0c4;">Overall: ${results.overall}/90</p>
      `;
    }
    default:
      return `<p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#9ab0c4;">Results recorded.</p>`;
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
