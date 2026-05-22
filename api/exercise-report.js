/**
 * /api/exercise-report — Vercel Serverless Function
 * Handles Growth Zone exercise report generation and delivery.
 *
 * POST /api/exercise-report
 * Body: { email, first_name, exercise_type, results, newsletter_opt_in }
 *
 * Flow:
 *   1. Upsert contact via data-handler
 *   2. Generate report via data-handler (save results + AI summary — ANTHROPIC_API_KEY lives there)
 *   3. Send HTML email via mail-sender
 *
 * Environment variables required:
 *   DATA_HANDLER_BEARER_TOKEN
 *   MAIL_SENDER_BEARER_TOKEN
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

  if (!dhToken || !msToken) {
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

    // ── Step 2: Save results + generate AI summary via data-handler ──
    // ANTHROPIC_API_KEY lives in Supabase secrets — never in this environment.
    const reportRes = await fetch(DATA_HANDLER, {
      method: 'POST',
      headers: dhHeaders,
      body: JSON.stringify({
        action: 'exercise_report_generate',
        payload: {
          contact_id: contactId,
          first_name: first_name.trim(),
          exercise_type,
          results_json: results,
        },
      }),
    });
    const reportResult = await reportRes.json();
    if (reportResult.error) {
      return res.status(500).json({ error: 'Failed to generate report: ' + reportResult.error });
    }
    const aiSummary = reportResult.data?.ai_summary || null;

    // ── Step 3: Send email via mail-sender ──
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
      task_triage: 'Your Task Triage Report',
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

    // ── Step 4: Log engagement ──
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
// Email HTML Builder
// ═══════════════════════════════════════════════════

function buildEmailHtml({ firstName, exerciseType, results, aiSummary }) {
  const exerciseLabels = {
    core_values: 'Core Values',
    character_strengths: 'Character Strengths',
    optimism: 'Optimism & Explanatory Style',
    motivation: 'Motivation & Self-Determination',
    feelings: 'Feelings Naming Guide',
    task_triage: 'Task Triage',
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
      <a href="https://www.crawford-coaching.ca/growth-zone" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:400;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#4fa3d8;text-decoration:none;">Explore the Growth Zone &#8594;</a>
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
    case 'task_triage': {
      const tasks = Array.isArray(results.tasks) ? results.tasks : [];
      const rows = tasks.map(t =>
        `<tr>
          <td style="padding:5px 16px 5px 0;font-family:Georgia,serif;font-size:14px;color:#f5f3ef;vertical-align:top;">${escapeHtml(t.name || t.title || '')}</td>
          <td style="padding:5px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#9ab0c4;white-space:nowrap;">Priority ${escapeHtml(String(t.priority_rank || ''))}</td>
        </tr>`
      ).join('');
      return rows
        ? `<table style="border-collapse:collapse;width:100%;">${rows}</table>`
        : `<p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#9ab0c4;">Tasks recorded.</p>`;
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
