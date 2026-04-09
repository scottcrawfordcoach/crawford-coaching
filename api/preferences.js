/**
 * /api/preferences — Vercel Serverless Function
 * Manages subscription preference lookups and updates via Supabase data-handler.
 *
 * GET  /api/preferences?email=...  → subscription_lookup
 * POST /api/preferences { email, subscriptions, reason, feedback } → subscription_update + engagement_log
 *
 * Environment variable required:
 *   DATA_HANDLER_BEARER_TOKEN — set in Vercel project settings
 */

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = process.env.DATA_HANDLER_BEARER_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // ── GET: Look up current preferences ──
  if (req.method === 'GET') {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });

    try {
      const response = await fetch(DATA_HANDLER, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'subscription_lookup',
          payload: { email },
        }),
      });

      const result = await response.json();
      if (result.error) return res.status(400).json({ error: result.error });

      // Return only what the page needs — don't expose internal IDs
      const contact = result.data;
      if (!contact) return res.status(200).json({ data: null });

      const subs = (contact.contact_subscriptions || []).reduce((acc, s) => {
        acc[s.subscription_type] = s.status === 'subscribed';
        return acc;
      }, {});

      return res.status(200).json({
        data: {
          first_name: contact.first_name || '',
          email: contact.email,
          subscriptions: subs,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Failed to look up preferences' });
    }
  }

  // ── POST: Update preferences ──
  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { email, subscriptions, reason, feedback } = body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!subscriptions) return res.status(400).json({ error: 'subscriptions is required' });

    try {
      const response = await fetch(DATA_HANDLER, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'subscription_update',
          payload: {
            email: email.toLowerCase().trim(),
            subscriptions,
            changed_by: 'self',
            source: 'preference_center',
          },
        }),
      });

      const result = await response.json();
      if (result.error) return res.status(400).json({ error: result.error });

      // Log unsubscribe reason as engagement if provided
      if (reason || feedback) {
        fetch(DATA_HANDLER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'engagement_log',
            payload: {
              source: 'crawford-site/unsubscribe',
              action: 'preference_update',
              email_hint: email.toLowerCase().trim(),
              metadata: { reason, feedback },
            },
          }),
        }).catch(() => {}); // fire-and-forget
      }

      return res.status(200).json({ data: result.data });
    } catch {
      return res.status(500).json({ error: 'Failed to update preferences' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
