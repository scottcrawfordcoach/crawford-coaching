/**
 * /api/subscribe — Vercel Serverless Function
 * Proxies signup requests to the Supabase data-handler with Bearer auth.
 * Creates/updates a contact and sets subscription preferences.
 *
 * Expected POST body:
 *   { email, first_name, last_name?, source, offer?, subscriptions? }
 *
 * Environment variable required:
 *   DATA_HANDLER_BEARER_TOKEN — set in Vercel project settings
 */

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.DATA_HANDLER_BEARER_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { email, first_name, last_name, source, offer, subscriptions } = body || {};

  if (!email || !first_name) {
    return res.status(400).json({ error: 'email and first_name are required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Build contact_upsert payload
  const payload = {
    email: email.toLowerCase().trim(),
    first_name: first_name.trim(),
    email_consent: true,
    offer: offer || 'newsletter',
    subscriptions: subscriptions || { newsletter: true },
  };

  if (last_name) payload.last_name = last_name.trim();

  try {
    const response = await fetch(DATA_HANDLER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'contact_upsert', payload }),
    });

    const result = await response.json();

    // Also log the engagement (public, no auth needed)
    fetch(DATA_HANDLER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'engagement_log',
        payload: {
          source: source || 'crawford-site/subscribe',
          action: 'newsletter_signup',
          email_hint: payload.email,
          offer: payload.offer,
        },
      }),
    }).catch(() => {}); // fire-and-forget

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ data: result.data });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process signup' });
  }
}
