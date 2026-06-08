/**
 * Server-side capability resolver (Capability Model Step 4).
 *
 * Underscore-prefixed → Vercel does NOT expose this as a route; it's a shared
 * helper imported by serverless functions that must enforce capabilities the
 * client cannot be trusted to enforce (paid AI spend, PII).
 *
 * Mirrors the client resolver in /auth/auth.js, but the inputs come from the
 * service-role `contact_lookup` (via data-handler), never from the request body.
 *
 * Flow: verify the Supabase access token → get the authenticated email →
 * contact_lookup (service-role) → resolve the capability set.
 */

const DATA_HANDLER = 'https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/data-handler';

const SYNERGIZE_SUITE = ['wod', 'custom_timer', 'emom_builder', 'waiver', 'gz_email_tools'];
const GZ_EMAIL_SUITE  = ['gz_email_tools'];
const GZ_PAID_SUITE   = ['gz_email_tools', 'gz_paid_tools'];
const ADMIN_WORKOUTS_CAPS   = ['workouts'];
const ADMIN_NEWSLETTER_CAPS = ['newsletter', 'email', 'analytics'];
const ADMIN_BLOG_CAPS       = ['blog'];
const ADMIN_ALL_CAPS = [
  ...SYNERGIZE_SUITE, 'gz_paid_tools',
  ...ADMIN_WORKOUTS_CAPS, ...ADMIN_NEWSLETTER_CAPS, ...ADMIN_BLOG_CAPS,
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Billing-derived access: prefer the *_billed_through month-stamp (auto-expires
// when unbilled), fall back to *_active only for stampless comp/manual grants.
function hasServiceAccess(contact, service) {
  const stamp = contact[`${service}_billed_through`];
  if (stamp) return stamp >= currentMonth();
  return contact[`${service}_active`] === true;
}

// Pure: resolve the additive capability Set for a contact row (with contact_tags).
export function resolveCapabilities(contact) {
  const caps = new Set();
  if (!contact) return caps;
  const add = (list) => list.forEach((c) => caps.add(c));

  if (hasServiceAccess(contact, 'synergize')) add(SYNERGIZE_SUITE);
  if (contact.growth_zone_subscribed === true) add(GZ_PAID_SUITE);
  if (contact.tier === 'email_captured') add(GZ_EMAIL_SUITE);

  const tags = (contact.contact_tags || []).map((t) => t.tag);
  if (tags.includes('ADMIN')) add(ADMIN_ALL_CAPS);
  if (tags.includes('ADMIN_WORKOUTS')) add(ADMIN_WORKOUTS_CAPS);
  if (tags.includes('ADMIN_NEWSLETTER')) add(ADMIN_NEWSLETTER_CAPS);
  if (tags.includes('ADMIN_BLOG')) add(ADMIN_BLOG_CAPS);
  for (const tag of tags) {
    if (tag.startsWith('CAP_')) caps.add(tag.slice(4).toLowerCase());
  }
  return caps;
}

/**
 * Verify a Supabase access token and resolve the caller's capabilities from
 * the service-role contact row. Returns { ok, status, email, contact, caps }.
 * On any auth/lookup failure, ok=false with an HTTP status to return.
 */
export async function capabilitiesFromToken(accessToken, env) {
  const { supabaseUrl, supabaseAnon, dataHandlerKey } = env;
  if (!accessToken) return { ok: false, status: 401, error: 'Not signed in' };
  if (!supabaseUrl || !supabaseAnon || !dataHandlerKey) {
    return { ok: false, status: 500, error: 'Server misconfigured' };
  }

  // 1. Who is this token? (Supabase validates signature + expiry.)
  let email = null;
  try {
    const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: supabaseAnon },
    });
    if (!whoRes.ok) return { ok: false, status: 401, error: 'Invalid session' };
    const who = await whoRes.json();
    email = (who?.email || '').toLowerCase().trim();
  } catch {
    return { ok: false, status: 401, error: 'Invalid session' };
  }
  if (!email) return { ok: false, status: 401, error: 'Invalid session' };

  // 2. Service-role contact lookup (never trusts the request body).
  let contact = null;
  try {
    const res = await fetch(DATA_HANDLER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dataHandlerKey}` },
      body: JSON.stringify({ action: 'contact_lookup', payload: { email } }),
    });
    const result = await res.json();
    if (result?.error) return { ok: false, status: 502, error: 'Lookup failed' };
    contact = result?.data ?? null;
  } catch {
    return { ok: false, status: 502, error: 'Lookup failed' };
  }
  if (!contact) return { ok: false, status: 403, error: 'No account on file' };

  return { ok: true, status: 200, email, contact, caps: resolveCapabilities(contact) };
}

export function bearerFrom(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
