/**
 * _intake-pdf.js — copy-of-record PDF builder (Synergize digital intake, phase 7)
 *
 * Underscore-prefixed → not a Vercel route. Imported by api/intake-submit.js.
 *
 * Renders ONE combined PDF of a member's completed intake (health screen +
 * liability waiver + group policies) FROM THE STORED RECORDS, so the artifact
 * and the immutable DB rows are provably the same thing (spec §8). Self-
 * identifying: branding, version, member, the affirmed clauses, the actual
 * health-screen responses, the acknowledged policy text, and a completion
 * block ("Completed electronically … on [date], from [IP]").
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  DOC_VERSION, PARQ, WAIVER_CLAUSES, POLICIES,
} from '../intake/v1.1/documents.js';

const ORANGE = rgb(0.910, 0.388, 0.169);  // ~#e8632b
const INK    = rgb(0.055, 0.059, 0.063);
const GREY   = rgb(0.42, 0.42, 0.45);
const PAGE   = [612, 792];                  // US Letter
const M      = 54;                          // margin

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto',
    });
  } catch { return iso || ''; }
};

/**
 * @param {object} a
 * @param {Record<string,object>} a.records  latest record per doc_type
 * @param {object} a.member  { name, email }
 * @param {object} a.meta    { completedAt, ip }
 * @returns {Promise<Uint8Array>}
 */
export async function buildIntakePdf({ records, member, meta }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage(PAGE);
  let y = PAGE[1] - M;
  const lh = (s) => s * 1.4;

  const ensure = (space) => {
    if (y - space < M) { page = pdf.addPage(PAGE); y = PAGE[1] - M; }
  };
  // Word-wrapped paragraph; paginates as needed.
  const para = (str, { f = font, size = 10, color = INK, indent = 0, gap = 4 } = {}) => {
    const maxW = PAGE[0] - M * 2 - indent;
    for (const rawLine of String(str ?? '').split('\n')) {
      let line = '';
      const flush = () => {
        ensure(lh(size));
        page.drawText(line, { x: M + indent, y: y - size, size, font: f, color });
        y -= lh(size); line = '';
      };
      for (const w of rawLine.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW && line) { flush(); line = w; }
        else line = test;
      }
      flush();
    }
    y -= gap;
  };
  const heading = (str, size = 13) => { y -= 10; ensure(lh(size) + 6); para(str, { f: bold, size, color: ORANGE, gap: 2 }); };
  const label = (str) => para(str, { f: bold, size: 10, gap: 1 });
  const rule = () => { ensure(14); page.drawLine({ start: { x: M, y }, end: { x: PAGE[0] - M, y }, thickness: 0.5, color: GREY }); y -= 12; };

  const hs = records.health_screen;
  const wv = records.liability_waiver;
  const gp = records.group_policies;

  // ── Masthead ──
  page.drawRectangle({ x: 0, y: PAGE[1] - 6, width: PAGE[0], height: 6, color: ORANGE });
  para('Synergize Fitness', { f: bold, size: 20, gap: 0 });
  para('Member Intake — Copy of Record', { f: font, size: 12, color: GREY, gap: 8 });
  para(`${member.name || ''}`, { f: bold, size: 11, gap: 0 });
  if (member.email) para(member.email, { size: 10, color: GREY, gap: 8 });

  para(
    `Completed electronically via the Synergize Fitness members area on ${fmtDate(meta.completedAt)}` +
    (meta.ip ? `, from ${meta.ip}.` : '.'),
    { f: ital, size: 9, color: GREY, gap: 6 },
  );
  rule();

  // ── 1. Health Screen ──
  if (hs) {
    heading(`Health Screen v${hs.doc_version || DOC_VERSION}`);
    const d = (hs.responses && hs.responses.details) || {};
    label('Details');
    para(`Name: ${d.name || '—'}    Email: ${d.email || '—'}`, { size: 10, gap: 1 });
    para(`Age: ${d.age || '—'}    Sex: ${d.sex || '—'}    Height: ${d.height || '—'}`, { size: 10, gap: 6 });

    label('Part A — Activity Readiness');
    const a = (hs.responses && hs.responses.partA) || {};
    PARQ.forEach((q, i) => {
      const ans = a[`a${i + 1}`];
      para(`${i + 1}. ${q}`, { size: 9, gap: 0 });
      para(`Answer: ${ans === true ? 'Yes' : ans === false ? 'No' : '—'}`, { f: bold, size: 9, indent: 12, gap: 3 });
    });
    if (hs.flagged) para('Flagged for coach review (one or more Part-A "yes" answers).', { f: ital, size: 9, color: ORANGE, gap: 4 });

    const b = (hs.responses && hs.responses.partB) || {};
    label('Part B — Health History');
    para((b.conditions && b.conditions.length) ? b.conditions.join(', ') : 'None selected', { size: 10, gap: 1 });
    if (b.other) para(`Other: ${b.other}`, { size: 10, gap: 6 }); else y -= 4;

    const c = (hs.responses && hs.responses.partC) || {};
    label('Part C — Injury Screen');
    const injuries = Object.entries(c);
    para(injuries.length ? injuries.map(([area, t]) => `${area}: ${t}`).join('   ·   ') : 'None reported', { size: 10, gap: 6 });

    const p = (hs.responses && hs.responses.partD) || {};
    label('Part D — Goals');
    para(`Current activity: ${p.current || '—'}`, { size: 10, gap: 1 });
    para(`Goals / how I can help: ${p.goals || '—'}`, { size: 10, gap: 1 });
    if (p.extra) para(`Anything else: ${p.extra}`, { size: 10, gap: 2 });
    rule();
  }

  // ── 2. Liability Waiver ──
  if (wv) {
    heading(`Liability Waiver v${wv.doc_version || DOC_VERSION}`);
    const affirmed = (wv.responses && wv.responses.clauses) || {};
    WAIVER_CLAUSES.forEach((cl) => {
      para(`${cl.heading}  ${affirmed[cl.key] === true ? '— Affirmed' : '— NOT affirmed'}`,
        { f: bold, size: 10, color: affirmed[cl.key] === true ? INK : ORANGE, gap: 1 });
      para(cl.body, { size: 9, color: GREY, gap: 5 });
    });
    para(`Signed: ${wv.signature_name || '—'}`, { f: bold, size: 10, gap: 1 });
    para(`Dated: ${fmtDate(wv.signed_at)}`, { size: 9, color: GREY, gap: 4 });
    rule();
  }

  // ── 3. Group Policies ──
  if (gp) {
    heading(`Group Training Information & Policies v${gp.doc_version || DOC_VERSION}`);
    const ack = gp.responses && gp.responses.acknowledged === true;
    para(ack ? 'Acknowledged and agreed.' : 'NOT acknowledged.', { f: bold, size: 10, color: ack ? INK : ORANGE, gap: 5 });
    POLICIES.intro.forEach((t) => para(t, { size: 9, color: GREY, gap: 4 }));
    label('Payments and refunds');
    POLICIES.payments.forEach((t) => para(`•  ${t}`, { size: 9, color: GREY, indent: 8, gap: 2 }));
    label('Conduct');
    POLICIES.conduct.forEach((t) => para(`•  ${t}`, { size: 9, color: GREY, indent: 8, gap: 2 }));

    // Media consent — the member's recorded choice (v1.1).
    if (POLICIES.media) {
      label(POLICIES.media.heading);
      const choice = gp.responses && gp.responses.media_consent;
      const opt = (POLICIES.media.options || []).find((o) => o.key === choice);
      para(`Choice: ${choice || '—'}`, { f: bold, size: 9, gap: 1 });
      para(opt ? opt.text : 'No choice recorded', { size: 9, color: GREY, gap: 4 });
    }

    para(`Acknowledged: ${fmtDate(gp.signed_at)}`, { size: 9, color: GREY, gap: 4 });
  }

  // ── Footer on every page ──
  const footer = POLICIES.footer;
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(footer, { x: M, y: 28, size: 7.5, font, color: GREY });
    pg.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE[0] - M - 70, y: 28, size: 7.5, font, color: GREY });
  });

  return await pdf.save();
}
