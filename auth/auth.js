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
});

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
        'coaching_active',
        'whole_active',
        'growth_zone_subscribed',
        'whole_alumni_claimed',
        'whole_alumni_claim_date',
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
  // Precedence per spec v1.3 §5.2.
  if (contact.coaching_active)        return ROLES.COACHING_CLIENT;
  if (contact.whole_active)           return ROLES.WHOLE_PARTICIPANT;
  if (contact.growth_zone_subscribed) return ROLES.GROWTH_ZONE;
  if (contact.synergize_active)       return ROLES.SYNERGIZE_MEMBER;
  if (contact.whole_alumni_claimed)   return ROLES.WHOLE_ALUMNI;
  return ROLES.EMAIL_CAPTURED;
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
