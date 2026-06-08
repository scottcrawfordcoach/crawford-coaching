/**
 * /api/intake-submit — Vercel Serverless Function
 *
 * Persists one signed Synergize intake document (health screen, liability
 * waiver, or group policies) as an immutable record. This is the server-side
 * write-path enforcement the capability design flagged as "waiver write-path
 * enforcement when the intake flow is built."
 *
 * Order of operations (spec §7 / handoff §4):
 *   1. Verify the Supabase access token  → trusted user.id + email (401 if not).
 *   2. Require the `waiver` capability    → members only (403 if not).
 *   3. Resolve contact_id from the trusted session (never from the body).
 *   4. Validate completeness for the submitted doc_type.
 *   5. Server-compute doc_text_hash (SHA-256 of the canonical v1.0 text),
 *      `flagged` (health screen Part-A any yes), `expires_at` (screen + 12mo).
 *   6. Capture ip_address, user_agent, signed_at (server time, via the DB default).
 *   7. Write the immutable row via data-handler `intake_submit` (service role).
 *
 * The client never supplies identity or the text hash. Environment:
 *   SUPABASE_URL · SUPABASE_ANON_KEY · DATA_HANDLER_BEARER_TOKEN
 */

import { createHash } from 'node:crypto';
import { capabilitiesFromToken, bearerFrom } from './_capabilities.js';
import { canonicalText, DOC_VERSION, WAIVER_CLAUSE_KEYS, PARQ } from '../intake/v1.0/documents.js';

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';
const DOC_TYPES = ['health_screen', 'liability_waiver', 'group_policies'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const env = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnon: process.env.SUPABASE_ANON_KEY,
    dataHandlerKey: process.env.DATA_HANDLER_BEARER_TOKEN,
  };
  if (!env.supabaseUrl || !env.supabaseAnon || !env.dataHandlerKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // 1-2. Verify session + require membership (the `waiver` capability).
  const auth = await capabilitiesFromToken(bearerFrom(req), env);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!auth.caps.has('waiver')) {
    return res.status(403).json({ error: 'Membership required to submit intake documents' });
  }

  // 3. Trusted identity — from the session, never the body.
  const contactId = auth.contact?.id;
  const authUserId = auth.userId || auth.contact?.auth_user_id || null;
  if (!contactId || !authUserId) {
    return res.status(403).json({ error: 'No linked member account on file' });
  }

  // Parse body.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });

  const docType = body.doc_type;
  const responses = body.responses && typeof body.responses === 'object' ? body.responses : {};
  const signatureName = typeof body.signature_name === 'string' ? body.signature_name.trim() : '';
  if (!DOC_TYPES.includes(docType)) {
    return res.status(400).json({ error: `Unsupported doc_type: ${docType}` });
  }

  // 4. Per-doc completeness (server-enforced; the UI also gates these).
  const invalid = validate(docType, responses, signatureName);
  if (invalid) return res.status(422).json({ error: invalid });

  // 5. Server-computed integrity + operational fields.
  const docTextHash = createHash('sha256').update(canonicalText(docType), 'utf8').digest('hex');
  const flagged = docType === 'health_screen' && partAHasYes(responses);
  let expiresAt = null;
  if (docType === 'health_screen') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);   // 12-month renewal
    expiresAt = d.toISOString();
  }

  // 6. Audit metadata.
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipAddress = fwd || req.socket?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  // 7. Immutable write via the service-role gateway.
  try {
    const result = await callDataHandler('intake_submit', {
      contact_id: contactId,
      auth_user_id: authUserId,
      doc_type: docType,
      doc_version: DOC_VERSION,
      doc_text_hash: docTextHash,
      responses,
      signature_name: docType === 'liability_waiver' ? signatureName : null,
      flagged,
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent,
    }, env.dataHandlerKey);

    return res.status(200).json({
      ok: true,
      doc_type: docType,
      id: result?.id ?? null,
      status: flagged ? 'flagged' : 'cleared',
    });
  } catch (err) {
    return res.status(502).json({ error: `Could not save record: ${err.message}` });
  }
}

function partAHasYes(responses) {
  const a = responses.partA || {};
  return PARQ.some((_, i) => a[`a${i + 1}`] === true);
}

// Returns an error string if incomplete, or null if valid.
function validate(docType, responses, signatureName) {
  if (docType === 'liability_waiver') {
    const clauses = responses.clauses || {};
    const allAffirmed = WAIVER_CLAUSE_KEYS.every((k) => clauses[k] === true);
    if (!allAffirmed) return 'All seven clauses must be affirmed';
    if (!signatureName || signatureName.length < 2) return 'A typed signature is required';
    return null;
  }
  if (docType === 'group_policies') {
    if (responses.acknowledged !== true) return 'Acknowledgement is required';
    return null;
  }
  if (docType === 'health_screen') {
    const a = responses.partA || {};
    const allAnswered = PARQ.every((_, i) => typeof a[`a${i + 1}`] === 'boolean');
    if (!allAnswered) return 'All Part A questions must be answered';
    const name = (responses.details && responses.details.name) || '';
    if (!String(name).trim()) return 'Name is required';
    return null;
  }
  return 'Unsupported document';
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
