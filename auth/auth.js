/**
 * Crawford Site — Shared Auth Helper (browser-side)
 *
 * Loaded from any HTML page that needs to know who the user is.
 *
 *   <script src="/auth/auth.js" type="module"></script>
 *   <script type="module">
 *     import { cc } from '/auth/auth.js';
 *     const session = await cc.getSession();
 *     const role = await cc.getRole();
 *   </script>
 *
 * Surface (kept deliberately small):
 *   cc.getClient()      → resolved Supabase client (lazy, cached)
 *   cc.getSession()     → current session object | null
 *   cc.getUser()        → current auth user | null
 *   cc.getContact()     → user's own contacts row | null
 *   cc.getRole()        → resolved role string (see ROLES below)
 *   cc.signInWithEmail({email, redirectTo}) → sends magic link
 *   cc.completeCallback() → handles a magic link return (parses hash)
 *   cc.signOut()        → clears session
 *   cc.onAuthChange(fn) → subscribes to auth state changes
 *
 * Role resolution mirrors growth-zone-spec-v1.3 §5.2.
 */

const SUPABASE_JS_CDN =
  'https://esm.sh/@supabase/supabase-js@2.45.4?bundle';

export const ROLES = Object.freeze({
  ANONYMOUS:           'anonymous',
  EMAIL_CAPTURED:      'email_captured',
  SYNERGIZE_MEMBER:    'synergize_member',
  GROWTH_ZONE:         'growth_zone',
  COACHING_CLIENT:     'coaching_client',
  WHOLE_PARTICIPANT:   'whole_participant',
  WHOLE_ALUMNI:        'whole_alumni',
  ADMIN:               'admin',
});

// ---------------------------------------------------------------------------
// Capability model (canonical names: crawford-coaching-mailer/CAPABILITY-REGISTRY.md).
//
// A capability is granted if any active membership bundle includes it OR an
// explicit CAP_<NAME> tag is set. Resolution is ADDITIVE over every active
// membership — never derived from the single winning getRole() (which is
// winner-take-all and would drop overlapping memberships).
//
// IMPORTANT: hasCapability() is a UX convenience for every capability EXCEPT
// custom_timer, waiver, and gz_paid_tools — those are enforced server-side
// (Steps 4–5). A client check is never the real boundary for them.
// ---------------------------------------------------------------------------
const SYNERGIZE_SUITE = ['wod', 'custom_timer', 'emom_builder', 'waiver', 'gz_email_tools'];
const GZ_EMAIL_SUITE  = ['gz_email_tools'];
const GZ_PAID_SUITE   = ['gz_email_tools', 'gz_paid_tools'];                 // superset of email
const ADMIN_WORKOUTS_CAPS   = ['workouts'];
const ADMIN_NEWSLETTER_CAPS = ['newsletter', 'email', 'analytics'];
const ADMIN_BLOG_CAPS       = ['blog'];
// Full ADMIN = every member-side capability ∪ every admin capability.
const ADMIN_ALL_CAPS = [
  ...SYNERGIZE_SUITE, 'gz_paid_tools',
  ...ADMIN_WORKOUTS_CAPS, ...ADMIN_NEWSLETTER_CAPS, ...ADMIN_BLOG_CAPS,
];

// Current calendar month as 'YYYY-MM' (matches contacts.*_billed_through).
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Billing-derived access for a service. Prefers the billed_through month-stamp
// (so access auto-expires when a member isn't billed for the current month,
// even if a sync run is missed); falls back to the *_active boolean only when
// there is no stamp — i.e. a deliberate comp/manual grant (e.g. a test account).
function hasServiceAccess(contact, service) {
  const stamp = contact[`${service}_billed_through`];
  if (stamp) return stamp >= currentMonth();
  return contact[`${service}_active`] === true;
}

let _clientPromise = null;
let _contactCache = null;

async function loadConfig() {
  const res = await fetch('/api/auth-config', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load auth config');
  return res.json();
}

async function loadClient() {
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    const [{ createClient }, cfg] = await Promise.all([
      import(SUPABASE_JS_CDN),
      loadConfig(),
    ]);
    const client = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We parse the magic-link return ourselves on /auth/callback so we
        // can route based on resolved role.
        detectSessionInUrl: false,
        storageKey: 'cc-auth',
      },
    });
    return client;
  })();
  return _clientPromise;
}

async function getSession() {
  const client = await loadClient();
  const { data } = await client.auth.getSession();
  return data.session || null;
}

async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

async function getContact({ force = false } = {}) {
  if (_contactCache && !force) return _contactCache;
  const client = await loadClient();
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await client
    .from('contacts')
    .select(
      [
        'id',
        'email',
        'first_name',
        'last_name',
        'tier',
        'synergize_active',
        'synergize_billed_through',
        'coaching_active',
        'coaching_billed_through',
        'whole_active',
        'growth_zone_subscribed',
        'whole_alumni_claimed',
        'whole_alumni_claim_date',
        'contact_tags (tag, category)',
      ].join(',')
    )
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.warn('[cc.auth] contact lookup failed', error);
    return null;
  }
  _contactCache = data || null;
  return _contactCache;
}

async function getRole() {
  const contact = await getContact();
  if (!contact) {
    const session = await getSession();
    return session ? ROLES.EMAIL_CAPTURED : ROLES.ANONYMOUS;
  }
  // ADMIN supersedes all other roles.
  const tags = (contact.contact_tags || []).map(t => t.tag);
  if (tags.includes('ADMIN'))          return ROLES.ADMIN;
  // Precedence per spec v1.3 §5.2.
  if (contact.coaching_active)        return ROLES.COACHING_CLIENT;
  if (contact.whole_active)           return ROLES.WHOLE_PARTICIPANT;
  if (contact.growth_zone_subscribed) return ROLES.GROWTH_ZONE;
  if (contact.synergize_active)       return ROLES.SYNERGIZE_MEMBER;
  if (contact.whole_alumni_claimed)   return ROLES.WHOLE_ALUMNI;
  return ROLES.EMAIL_CAPTURED;
}

// Coarse 3-role view (reporting/UI façade only — getRole() stays authoritative
// for the fine-grained enum). public | member | admin.
function coarseRole(contact) {
  if (!contact) return 'public';
  const tags = (contact.contact_tags || []).map(t => t.tag);
  if (tags.some(t => t === 'ADMIN' || t.startsWith('ADMIN_'))) return 'admin';
  const isMember =
    hasServiceAccess(contact, 'synergize') ||
    hasServiceAccess(contact, 'coaching') ||
    contact.whole_active === true ||
    contact.growth_zone_subscribed === true ||
    contact.whole_alumni_claimed === true;
  return isMember ? 'member' : 'public';
}

// Resolve the additive capability set for a contact (registry §6). Pass a
// contact to resolve synchronously, or omit to resolve the current user.
function resolveCapabilities(contact) {
  const caps = new Set();
  if (!contact) return caps;
  const add = (list) => list.forEach(c => caps.add(c));

  // Membership bundles — additive over every active flag (NOT off getRole()).
  if (hasServiceAccess(contact, 'synergize')) add(SYNERGIZE_SUITE);
  if (contact.growth_zone_subscribed === true) add(GZ_PAID_SUITE);
  if (contact.tier === 'email_captured') add(GZ_EMAIL_SUITE);

  // Admin tag bundles.
  const tags = (contact.contact_tags || []).map(t => t.tag);
  if (tags.includes('ADMIN')) add(ADMIN_ALL_CAPS);
  if (tags.includes('ADMIN_WORKOUTS')) add(ADMIN_WORKOUTS_CAPS);
  if (tags.includes('ADMIN_NEWSLETTER')) add(ADMIN_NEWSLETTER_CAPS);
  if (tags.includes('ADMIN_BLOG')) add(ADMIN_BLOG_CAPS);

  // À-la-carte CAP_<NAME> tags → name (stripped, lowercased).
  for (const tag of tags) {
    if (tag.startsWith('CAP_')) caps.add(tag.slice(4).toLowerCase());
  }
  return caps;
}

async function getCapabilities() {
  return resolveCapabilities(await getContact());
}

// UX-only for every capability except custom_timer / waiver / gz_paid_tools,
// which are enforced server-side (Steps 4–5). Never the boundary for those.
async function hasCapability(name) {
  return (await getCapabilities()).has(name);
}

async function getCoarseRole() {
  return coarseRole(await getContact());
}

async function signInWithEmail({ email, redirectTo } = {}) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  const client = await loadClient();
  const emailRedirectTo =
    redirectTo ||
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      window.location.pathname + window.location.search
    )}`;

  // Supabase requires emailRedirectTo to be a fully-qualified absolute URL.
  // A bare hostname (or missing scheme) is treated as a relative path on the
  // Supabase host, which produces a magic link that lands the user on
  // https://<project-ref>.supabase.co/<your-domain>#access_token=... — broken.
  // The URL also has to be on the dashboard's allow-list
  // (Authentication → URL Configuration → Redirect URLs); if it isn't,
  // Supabase silently falls back to the dashboard Site URL.
  if (!/^https?:\/\//.test(emailRedirectTo)) {
    throw new Error(
      `Sign-in redirect URL is not fully qualified ("${emailRedirectTo}"). ` +
      `It must start with https:// (or http:// for local dev).`
    );
  }

  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  return { ok: true };
}

async function completeCallback() {
  const client = await loadClient();
  const url = new URL(window.location.href);

  // Path A — modern token_hash flow (Supabase-recommended template).
  // Template uses `{{ .RedirectTo }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
  const token_hash = url.searchParams.get('token_hash');
  const type       = url.searchParams.get('type');
  if (token_hash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (error) throw error;
    // Strip the verification params from the URL.
    history.replaceState(null, '', url.pathname);
    _contactCache = null;
    return { ok: true };
  }

  // Path B — legacy implicit flow (default Supabase magic-link template).
  // Token data arrives in the URL hash fragment as access_token/refresh_token.
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';
  const hashParams = new URLSearchParams(hash);
  const access_token  = hashParams.get('access_token');
  const refresh_token = hashParams.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    // Drop the tokens from the URL so they don't leak via history/share.
    history.replaceState(null, '', url.pathname + url.search);
    _contactCache = null;
    return { ok: true };
  }

  throw new Error('Magic link is missing token data. Try requesting a new link.');
}

async function signOut() {
  const client = await loadClient();
  await client.auth.signOut();
  _contactCache = null;
}

function onAuthChange(callback) {
  loadClient().then((client) => {
    client.auth.onAuthStateChange((event, session) => {
      _contactCache = null;
      try { callback(event, session); } catch (e) { console.error(e); }
    });
  });
}

export const cc = {
  ROLES,
  getClient: loadClient,
  getSession,
  getUser,
  getContact,
  getRole,
  getCoarseRole,
  coarseRole,              // pure: coarseRole(contact)
  getCapabilities,
  resolveCapabilities,     // pure: resolveCapabilities(contact) -> Set
  hasCapability,
  signInWithEmail,
  completeCallback,
  signOut,
  onAuthChange,
};

// Make available to non-module consumers too.
if (typeof window !== 'undefined') {
  window.cc = window.cc || {};
  window.cc.auth = cc;
}

export default cc;
