/**
 * /api/auth-config — Vercel Serverless Function
 *
 * Returns the public Supabase config needed by the browser to bootstrap
 * the Supabase JS client.
 *
 *   url     — Supabase project REST URL
 *   anonKey — Supabase anon (public) JWT. Safe to expose; RLS is the gate.
 *
 * Environment variables required (set in Vercel project settings):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 */

const ALLOWED_ORIGIN = '*'; // tighten later if the site moves off a single origin

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache for an hour on the edge; the values rotate rarely.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  return res.status(200).json({ url, anonKey });
}
