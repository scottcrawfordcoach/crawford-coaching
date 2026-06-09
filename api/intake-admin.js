/**
 * /api/intake-admin — Vercel Serverless Function (ADMIN only)
 *
 * Backs the flagged health-screen review surface (intake phase 8). Health-screen
 * responses are sensitive PII, so this is hard-gated server-side to members
 * carrying the ADMIN tag — the client page is a convenience, never the boundary.
 *
 *   GET                      → list flagged health screens (+ contact + review status)
 *   POST { id, note }        → mark a flagged screen reviewed (reviewed_by = caller)
 *
 * Environment: SUPABASE_URL · SUPABASE_ANON_KEY · DATA_HANDLER_BEARER_TOKEN
 */

import { capabilitiesFromToken, bearerFrom } from './_capabilities.js';

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  const env = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnon: process.env.SUPABASE_ANON_KEY,
    dataHandlerKey: process.env.DATA_HANDLER_BEARER_TOKEN,
  };
  if (!env.supabaseUrl || !env.supabaseAnon || !env.dataHandlerKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Verify session + require the ADMIN tag (PII surface).
  const auth = await capabilitiesFromToken(bearerFrom(req), env);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const tags = (auth.contact?.contact_tags || []).map((t) => t.tag);
  if (!tags.includes('ADMIN')) return res.status(403).json({ error: 'Admin access required' });

  try {
    if (req.method === 'GET') {
      const result = await callDataHandler('intake_flagged', {}, env.dataHandlerKey);
      return res.status(200).json({ ok: true, flagged: result?.flagged ?? [] });
    }

    // POST → mark reviewed
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    if (!body || !body.id) return res.status(400).json({ error: 'id is required' });

    await callDataHandler('intake_review', {
      id: body.id,
      reviewed_by: auth.userId || auth.contact?.id || null,
      review_note: typeof body.note === 'string' ? body.note.trim() : null,
    }, env.dataHandlerKey);

    return res.status(200).json({ ok: true, id: body.id });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}

async function callDataHandler(action, payload, token) {
  const response = await fetch(DATA_HANDLER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.error) throw new Error(result?.error || `data-handler ${action} ${response.status}`);
  return result?.data ?? result;
}
