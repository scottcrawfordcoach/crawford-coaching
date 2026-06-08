/**
 * Crawford Site — Growth-Zone Tool Gate (browser-side, UX layer)
 *
 *   <script type="module">
 *     import { gateTool } from '/auth/tool-gate.js';
 *     gateTool('gz_paid_tools', { toolName: 'Motivation & Self-Determination' });
 *   </script>
 *
 * Drops a full-screen veil over a paid/member tool page on load, resolves the
 * caller's capabilities via /auth/auth.js, and either removes the veil (entitled)
 * or turns it into a "Members only" gate with sign-in / upgrade CTAs.
 *
 * SECURITY NOTE — this is a UX gate, NOT a security boundary. The exercise HTML
 * is still in the page source, so a determined user could disable JS or read the
 * markup. The authoritative protection for paid spend + PII is the SERVER check
 * in api/exercise-report.js (it verifies `gz_paid_tools` from the service-role
 * contact_lookup before generating any AI report). This gate exists to stop
 * casual/anonymous use and to make the page match the "Members" card labelling.
 * True page-level enforcement would require serving these pages behind an
 * authenticated function (the Phase-3 static→Next.js migration).
 */

import { cc } from '/auth/auth.js';

const ORANGE = '#e8632b';
const ORANGE_LIGHT = '#f2844e';
const INK = '#0e0f10';
const PALE = '#dde8f2';
const WHITE = '#ffffff';

function buildVeil() {
  const el = document.createElement('div');
  el.id = 'cc-tool-gate';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    `background:${INK}`,
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:1.5rem', 'text-align:center',
    "font-family:'Jost',system-ui,sans-serif",
    'opacity:1', 'transition:opacity 0.25s',
  ].join(';');
  el.innerHTML = `
    <div style="max-width:30rem;">
      <div id="cc-tool-gate-spinner" style="
        display:inline-block;width:30px;height:30px;margin-bottom:1rem;
        border:2px solid rgba(255,255,255,0.15);border-top-color:${ORANGE};
        border-radius:50%;animation:cc-tg-spin 0.9s linear infinite;"></div>
      <div id="cc-tool-gate-body"></div>
    </div>
    <style>@keyframes cc-tg-spin{to{transform:rotate(360deg)}}</style>`;
  return el;
}

function lock(el, { toolName, signedIn }) {
  const next = encodeURIComponent(location.pathname + location.search);
  const body = el.querySelector('#cc-tool-gate-body');
  const spinner = el.querySelector('#cc-tool-gate-spinner');
  if (spinner) spinner.remove();

  const lead = signedIn
    ? `<strong>${toolName}</strong> is part of the full Growth Zone. Your account doesn't include it yet — here's what's inside.`
    : `<strong>${toolName}</strong> is a members-only Growth Zone tool. Sign in if you're a member, or see what's included.`;

  const primary = signedIn
    ? `<a href="/growth-zone" style="${btn(true)}">See what's included</a>`
    : `<a href="/sign-in?next=${next}" style="${btn(true)}">Sign in</a>`;

  const secondary = signedIn
    ? `<a href="/contact" style="${btn(false)}">Ask Scott about access</a>`
    : `<a href="/growth-zone" style="${btn(false)}">Explore the Growth Zone</a>`;

  body.innerHTML = `
    <div style="font-family:'Jost',system-ui,sans-serif;font-size:0.7rem;letter-spacing:0.28em;
                text-transform:uppercase;color:${ORANGE};margin-bottom:0.9rem;">Members only</div>
    <h2 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;
               font-size:1.9rem;color:${WHITE};margin:0 0 0.9rem;">A members-only tool</h2>
    <p style="font-family:'Libre Baskerville',Georgia,serif;color:${PALE};line-height:1.6;
              font-size:0.95rem;margin:0 auto 1.6rem;max-width:26rem;">${lead}</p>
    <div style="display:flex;gap:0.7rem;justify-content:center;flex-wrap:wrap;">
      ${primary}${secondary}
    </div>`;
}

function btn(filled) {
  const base = [
    'font-family:\'Jost\',system-ui,sans-serif', 'font-weight:400',
    'font-size:0.72rem', 'letter-spacing:0.18em', 'text-transform:uppercase',
    'text-decoration:none', 'padding:0.7rem 1.4rem', 'border-radius:1px',
    'display:inline-block', 'transition:background 0.2s,border-color 0.2s',
  ];
  if (filled) {
    base.push(`color:${WHITE}`, `background:${ORANGE}`, `border:1px solid ${ORANGE}`);
  } else {
    base.push(`color:${PALE}`, 'background:transparent', 'border:1px solid rgba(255,255,255,0.4)');
  }
  return base.join(';');
}

/**
 * Gate the current page behind a capability.
 * @param {string} capability  e.g. 'gz_paid_tools'
 * @param {{toolName?: string}} opts
 * @returns {Promise<boolean>} true if entitled (page left usable), false if locked.
 */
export async function gateTool(capability, { toolName = 'This tool' } = {}) {
  // Veil immediately so the tool isn't usable during the async auth round-trip.
  const el = buildVeil();
  document.body.appendChild(el);
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  let caps = new Set();
  let signedIn = false;
  try {
    const [c, s] = await Promise.all([
      cc.getCapabilities(),
      cc.getSession().then((x) => !!x).catch(() => false),
    ]);
    caps = c || new Set();
    signedIn = s;
  } catch {
    // Resolution failed → treat as not entitled (fail closed for the UX gate).
  }

  if (caps.has(capability)) {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
    document.documentElement.style.overflow = prevOverflow;
    return true;
  }

  lock(el, { toolName, signedIn });
  return false;
}

export default { gateTool };
