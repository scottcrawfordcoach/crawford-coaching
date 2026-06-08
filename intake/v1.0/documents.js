/**
 * Synergize Fitness — Intake documents, canonical v1.0 (source of truth)
 *
 * ONE source for the exact text of the three intake documents, imported by:
 *   - the on-site form (crawford-synergize / synergize-forms.html) to RENDER, and
 *   - api/intake-submit.js to compute `doc_text_hash` server-side.
 *
 * Because both render and hash come from this module, the wording a member saw
 * and the wording we hash into the immutable record are byte-identical by
 * construction (spec §1 "Integrity", §3, §6). Bump DOC_VERSION + add a new
 * versioned folder for any wording change; never edit v1.0 text in place.
 *
 * The sibling *.md files mirror this content as the human-readable legal record.
 * If you edit text here, regenerate those (and vice-versa) so they stay in sync.
 *
 * Pure data + pure string builders only — no crypto, no DOM — so it loads
 * unchanged in a Node serverless function and a browser module.
 */

export const DOC_VERSION = '1.0';

// ── Health Screen ──────────────────────────────────────────
// Part A — Activity Readiness (yes/no). Keys a1..a7 map to the versioned text.
export const PARQ = [
  'Has a doctor ever told you that you have a heart condition, or that you should only do physical activity under medical supervision?',
  'Do you experience chest pain when you are physically active?',
  'In the past month, have you had chest pain when you were not being physically active?',
  'Do you ever feel faint, lose your balance from dizziness, or lose consciousness?',
  'Do you have a bone or joint problem that could be worsened by exercise?',
  'Are you currently taking any medication prescribed for blood pressure or a heart condition?',
  'Are you aware of any other reason you should not take part in physical activity?',
];

export const PARQ_FLAG_NOTE =
  'If you answered "yes" to any of the above: we ask that you speak with your ' +
  'doctor before beginning, and let your coach know. This isn\'t a barrier to ' +
  'training — it just helps us coach you safely and adapt where needed.';

// Part B — Health History (each yes/no, plus free-text "other").
export const HISTORY_CONDITIONS = [
  'High / low blood pressure', 'History of heart disease', 'Heart disease',
  'Diabetes', 'Asthma', 'Weight concerns', 'Osteoporosis', 'Arthritis',
  'Fibromyalgia', 'Pregnancy', 'Depression',
];

// Part C — Injury Screen (per area: none / acute / chronic).
export const INJURY_AREAS = [
  'Neck', 'Shoulder — L', 'Shoulder — R', 'Hip — L', 'Hip — R',
  'Knee — L', 'Knee — R', 'Ankle — L', 'Ankle — R', 'Lower back',
];

// Part D — Goals (free text prompts).
export const GOAL_PROMPTS = [
  'What does your current activity or training look like?',
  'What can I do to help you? What are your fitness & health goals?',
  'Anything else you\'d like to add or ask?',
];

// ── Liability Waiver ───────────────────────────────────────
// 7 clauses; all must be affirmed true. `key` is the stored affirmation key.
// `elevated: true` marks the legally load-bearing assumption-of-risk clause.
export const WAIVER_CLAUSES = [
  {
    key: 'voluntary_participation',
    heading: 'Voluntary participation',
    body: 'I am taking part in physical activity with Synergize Fitness of my own free will. I confirm that I am physically able to participate, and that where the health screen indicated I should seek medical advice, I have done so or accept responsibility for choosing to proceed.',
  },
  {
    key: 'accuracy_of_disclosure',
    heading: 'Accuracy of disclosure',
    body: 'I confirm that the information in my Synergize Fitness Health Screen is accurate and complete, and that I have disclosed all medical conditions, previous and current injuries, and any other issues that could be made worse by a guided fitness program, before beginning physical activity.',
  },
  {
    key: 'non_disclosure',
    heading: 'Non-disclosure',
    body: 'I understand that Synergize Fitness, its coaches and staff cannot be held liable for injuries or complications arising from a pre-existing condition, injury, or medical issue that I failed to disclose.',
  },
  {
    key: 'assumption_of_risk',
    heading: 'Assumption of risk',
    elevated: true,
    body: 'I understand that physical activity and fitness training carry inherent risks, and that these risks include — but are not limited to — muscle, joint, and ligament injuries; aggravation of pre-existing or undisclosed conditions; cardiac events; and, in rare cases, serious injury or death. I voluntarily accept these risks as a condition of participating. I agree that my coach, Synergize Fitness, and anyone associated with it will not be liable for injury, loss, or damage arising from my participation in physical and athletic training with Synergize Fitness, except where caused by gross negligence.',
  },
  {
    key: 'supervision_questions',
    heading: 'Supervision and questions',
    body: 'I recognize that Synergize Fitness operates an open-floor training program with a coach present to assist and supervise at all times. I understand it is my responsibility to raise any questions, comments, or concerns about specific exercises, and to seek guidance when I want it.',
  },
  {
    key: 'following_safety_guidance',
    heading: 'Following safety guidance',
    body: 'I agree to follow the reasonable safety-related guidance of Synergize Fitness staff — including direction on exercise form, technique, and the safe performance of movements — recognizing that this guidance exists to keep me and others safe while I train at my own pace and ability.',
  },
  {
    key: 'termination',
    heading: 'Termination of membership',
    body: 'I understand that Synergize Fitness reserves the right to end any membership at the owner\'s discretion.',
  },
];

export const WAIVER_CLAUSE_KEYS = WAIVER_CLAUSES.map((c) => c.key);

// ── Group Training Information & Policies ──────────────────
export const POLICIES = {
  intro: [
    'Welcome to Synergize Fitness. We combine training with coaching principles to make exercise accessible, sustainable, and fun.',
    'In our boutique, private gym space, we run small groups of up to eight people per session — occasionally extended in fair weather, when we can make good use of the outdoor space. The social side is an important part of building exercise into your life for good, and we work hard to build a strong group dynamic.',
    'While clients may have personal goals to work on, the main focus of these sessions is regular, mobility-based strength and conditioning for healthy living — we don\'t generally track performance metrics.',
    'Workouts are posted for each session, but these are not classes where you need to keep up with the group. You\'re welcome to train at your own pace and do what you can on any given day. Instruction, modifications, and correction are offered as needed.',
  ],
  payments: [
    'Sessions are billed monthly, in advance.',
    'With limited space, a pay-per-session model isn\'t generally practical.',
    'E-transfer is preferred, but cheques or cash are also welcome.',
    'Accountability to yourself and the group matters — missed sessions are forfeit.',
    'If Synergize Fitness cancels a session, it will be rescheduled, refunded, or deducted from the next month\'s invoice. We make every effort to avoid cancelling.',
    'Clients may request to skip a month and retain their place in the group, at Synergize Fitness\'s discretion.',
    'Clients may withdraw at any time and receive a refund for the remaining sessions that month.',
    'New clients who cancel after no more than three sessions are entitled to a full refund.',
  ],
  conduct: [
    'Treat others respectfully — this goes without saying.',
    'While friendly competition is sometimes welcome, Synergize Fitness is a non-competitive environment where everyone works at their own level and pace.',
    'We work hard to coach each client according to their needs; the right amount and type of coaching varies greatly from person to person and day to day. We respectfully ask that clients avoid coaching or correcting one another.',
    'Clients who don\'t conduct themselves respectfully, or who continually disrupt others\' training, may be asked to leave the group. In that case, a refund is given for any remaining sessions.',
  ],
  footer: 'Synergize Fitness · crawford-coaching.ca/synergize · scott@crawford-coaching.ca · 613-329-3114',
};

/**
 * Build the exact canonical text for a doc_type. This is the string hashed into
 * `doc_text_hash` AND the basis the form renders, so the two never drift.
 * Deterministic: stable ordering, '\n' joins, no timestamps.
 */
export function canonicalText(docType) {
  switch (docType) {
    case 'health_screen':
      return [
        `Synergize Fitness — Health Screen v${DOC_VERSION}`,
        '',
        'Part A — Activity Readiness',
        ...PARQ.map((q, i) => `${i + 1}. ${q}`),
        PARQ_FLAG_NOTE,
        '',
        'Part B — Health History',
        ...HISTORY_CONDITIONS.map((c) => `- ${c}`),
        '- Other (describe)',
        '',
        'Part C — Injury Screen (none / acute / chronic)',
        ...INJURY_AREAS.map((a) => `- ${a}`),
        '- Other',
        '',
        'Part D — Goals',
        ...GOAL_PROMPTS.map((p) => `- ${p}`),
      ].join('\n');

    case 'liability_waiver':
      return [
        `Synergize Fitness — Liability Waiver v${DOC_VERSION}`,
        'Please confirm you have read and agree to each item below, then sign.',
        '',
        ...WAIVER_CLAUSES.map((c) => `${c.heading}\n${c.body}`),
        '',
        'Signature: typed full name + auto-dated.',
      ].join('\n');

    case 'group_policies':
      return [
        `Synergize Fitness — Group Training Information & Policies v${DOC_VERSION}`,
        '',
        ...POLICIES.intro,
        '',
        'Payments and refunds',
        ...POLICIES.payments.map((p) => `- ${p}`),
        '',
        'Conduct',
        ...POLICIES.conduct.map((p) => `- ${p}`),
        '',
        POLICIES.footer,
      ].join('\n');

    default:
      throw new Error(`Unknown doc_type: ${docType}`);
  }
}

export const DOC_TYPES = ['health_screen', 'liability_waiver', 'group_policies'];
