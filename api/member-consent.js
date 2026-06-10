/**
 * /api/member-consent — Vercel Serverless Function
 *
 * Authenticated email-preference read/write for the Synergize members area.
 * Identity comes ONLY from the verified Supabase session (never a body-supplied
 * email), then proxies the existing data-handler subscription actions.
 *
 *   GET  → subscription_lookup → { newsletter, offers }
 *   POST { newsletter, offers } → subscription_update
 *
 * Mapping (the two onboarding checkboxes):
 *   newsletter → contact_subscriptions.newsletter
 *   offers     → contact_subscriptions.marketing_synergize + marketing_coaching
 *   master contacts.email_consent is set true when either is on.
 *
 * Environment: SUPABASE_URL · SUPABASE_ANON_KEY · DATA_HANDLER_BEARER_TOKEN
 */

import { capabilitiesFromToken, bearerFrom } from './_capabilities.js';

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const env = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnon: process.env.SUPABASE_ANON_KEY,
    dataHandlerKey: process.env.DATA_HANDLER_BEARER_TOKEN,
  };
  if (!env.supabaseUrl || !env.supabaseAnon || !env.dataHandlerKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Identity from the verified session — never from the request body.
  const auth = await capabilitiesFromToken(bearerFrom(req), env);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const email = auth.email;

  if (req.method === 'GET') {
    try {
      const data = await callDataHandler('subscription_lookup', { email }, env.dataHandlerKey);
      const subs = (data?.contact_subscriptions || []).reduce((acc, s) => {
        acc[s.subscription_type] = s.status === 'subscribed';
        return acc;
      }, {});
      return res.status(200).json({
        data: {
          newsletter: !!subs.newsletter,
          offers: !!(subs.marketing_synergize || subs.marketing_coaching),
        },
      });
    } catch {
      return res.status(502).json({ error: 'Could not load preferences' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });

    const newsletter = body.newsletter === true;
    const offers = body.offers === true;

    try {
      await callDataHandler('subscription_update', {
        email,
        subscriptions: {
          newsletter,
          marketing_synergize: offers,
          marketing_coaching: offers,
        },
        email_consent: newsletter || offers,
        changed_by: 'self',
        source: 'synergize_members_onboarding',
      }, env.dataHandlerKey);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(502).json({ error: 'Could not save preferences' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function callDataHandler(action, payload, token) {
  const response = await fetch(DATA_HANDLER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.error) {
    throw new Error(result?.error || `data-handler ${action} ${response.status}`);
  }
  return result?.data ?? result;
}
