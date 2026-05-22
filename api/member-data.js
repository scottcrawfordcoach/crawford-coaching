/**
 * /api/member-data — Vercel Serverless Function
 *
 * Returns the data feeds shown on /synergize/members.
 *
 *   classes  — upcoming class schedule
 *   wod      — today's workout of the day
 *   holiday  — upcoming holiday closures
 *
 * Authenticates the caller by verifying a Supabase access token from the
 * Authorization header. Then proxies the relevant data-handler actions with
 * the server-side bearer token.
 *
 * Designed to degrade gracefully: any feed that the data-handler doesn't yet
 * support (or returns nothing for) is simply omitted from the response. The
 * members page falls back to its placeholder copy in that case.
 *
 * Environment variables:
 *   SUPABASE_URL                  — used to verify the auth token
 *   SUPABASE_ANON_KEY             — used to verify the auth token
 *   DATA_HANDLER_BEARER_TOKEN     — used to call data-handler
 */

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, max-age=30');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl    = process.env.SUPABASE_URL;
  const supabaseAnon   = process.env.SUPABASE_ANON_KEY;
  const dataHandlerKey = process.env.DATA_HANDLER_BEARER_TOKEN;

  if (!supabaseUrl || !supabaseAnon || !dataHandlerKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // ── Verify the user's session by asking Supabase Auth who they are.
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return res.status(401).json({ error: 'Not signed in' });

  let userId = null;
  try {
    const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnon,
      },
    });
    if (!whoRes.ok) return res.status(401).json({ error: 'Invalid session' });
    const who = await whoRes.json();
    userId = who?.id || null;
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
  if (!userId) return res.status(401).json({ error: 'Invalid session' });

  // ── Pull each feed independently. If a feed isn't supported yet by
  //     data-handler, ignore it; the page already shows a friendly fallback.
  const out = {};

  // class_schedule — already mentioned in CLAUDE.md as data-handler-supported.
  try {
    const classes = await callDataHandler('class_schedule', { window: 'this_week' }, dataHandlerKey);
    if (Array.isArray(classes)) out.classes = classes;
  } catch { /* swallow */ }

  // workout_of_the_day — may not exist yet on data-handler.
  try {
    const wod = await callDataHandler('workout_of_the_day', { date: new Date().toISOString().slice(0, 10) }, dataHandlerKey);
    if (wod && (typeof wod === 'string' || wod.summary)) {
      out.wod = typeof wod === 'string' ? wod : wod.summary;
    }
  } catch { /* swallow */ }

  // holiday_schedule — may not exist yet on data-handler.
  try {
    const holiday = await callDataHandler('holiday_schedule', { window: 'next_60_days' }, dataHandlerKey);
    if (Array.isArray(holiday)) out.holiday = holiday;
  } catch { /* swallow */ }

  return res.status(200).json(out);
}

async function callDataHandler(action, payload, token) {
  const response = await fetch(DATA_HANDLER, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!response.ok) throw new Error(`data-handler ${action} ${response.status}`);
  const result = await response.json();
  if (result?.error) throw new Error(result.error);
  return result?.data ?? result;
}
