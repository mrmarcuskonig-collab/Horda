// pricing.ts — THE single source of truth for what Horda charges and what each
// plan includes.
//
// WHY THIS FILE EXISTS: as a solo, AI-native founder, Marcus's edge is being able
// to experiment with pricing fast and often. That only works if pricing lives in
// ONE place and can change WITHOUT a code deploy. So:
//
//   * Everything money-facing reads from here — the live Stripe application fee
//     (server.ts), the AGB take-rate clause (terms.ts), the /about/pricing page,
//     the manage-view payout cards, and llms.txt. Change a number here → it moves
//     everywhere, consistently, at once.
//   * Every knob is ALSO overridable at runtime via an env var (HORDA_*), so a
//     price or fee can be changed live on Render with no redeploy. That is the
//     experiment surface: flip an env var, reload, measure.
//   * Plans carry an ENTITLEMENT map (data, not code branches), so adding a plan
//     or moving a feature between tiers is a data edit, and both the pricing page
//     and any feature-gate (`hasEntitlement`) update from the same source.
//   * A per-account `plan` column (migration 0050) lets different organisers sit
//     on different plans — grandfathering, cohorts, promos, A/Bs — so experiments
//     don't have to be all-or-nothing.
//
// NOTHING here charges anyone by itself; server.ts derives the fee from it. Horda
// Plus billing (collecting the subscription, enforcing 0%) is a separate, later
// build — until then Plus.live=false and the page shows it as coming soon.

const envNum = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v >= 0 ? v : d;
};
const envBool = (k: string, d: boolean) => {
  const v = process.env[k];
  return v === undefined ? d : /^(1|true|yes|on)$/i.test(v);
};

// The Free-plan platform fee (%). Override live with HORDA_PLATFORM_FEE_PCT.
// This is the single number the AGB and the live Stripe fee both read.
export const PLATFORM_FEE_PCT = envNum('HORDA_PLATFORM_FEE_PCT', 5);

export type Entitlement =
  | 'zero_fee'
  | 'unlimited_events'
  | 'paid_tickets'
  | 'qr_checkin'
  | 'co_organisers'
  | 'attribution'
  | 'blasts'
  | 'waitlist'
  | 'approval'
  | 'wallet_pass'
  | 'checkin_manager'
  | 'tax_collection'
  | 'extra_seats'
  | 'higher_sends'
  | 'api'
  | 'priority_support';

// Human labels for the pricing page + any upsell surface. One place to phrase a
// feature; the page maps entitlements → these strings.
export const ENTITLEMENT_LABEL: Record<Entitlement, string> = {
  zero_fee: '0% platform fee on paid tickets',
  unlimited_events: 'Unlimited events & spots',
  paid_tickets: 'Free or paid tickets — card, Apple Pay & Google Pay via Stripe',
  qr_checkin: 'QR check-in at the door',
  co_organisers: 'Unlimited co-organisers',
  attribution: 'Per-participant share links & attribution',
  blasts: 'Event blasts & reminders',
  waitlist: 'Waitlists when you sell out',
  approval: 'Approval-gated registration',
  wallet_pass: 'Apple / Google Wallet passes',
  checkin_manager: 'Check-in manager role (let staff scan)',
  tax_collection: 'Collect tax / VAT on tickets',
  extra_seats: 'Extra team & admin seats',
  higher_sends: 'Higher blast & newsletter limits',
  api: 'API & webhooks',
  priority_support: 'Priority support & early access',
};

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;   // EUR / month billed monthly
  priceAnnual: number;    // EUR / month when billed annually
  currency: string;
  feePct: number;         // platform fee on paid tickets for organisers on this plan
  blurb: string;
  live: boolean;          // is this plan actually purchasable today?
  featured?: boolean;     // visually highlight on the pricing page
  entitlements: Entitlement[];
}

const FREE_FEATURES: Entitlement[] = [
  'unlimited_events', 'paid_tickets', 'qr_checkin', 'co_organisers',
  'attribution', 'blasts', 'waitlist', 'approval', 'wallet_pass',
];

// The plans. Prices and the Plus fee are env-overridable so they can be tuned
// live. Mirrors Luma's shape: a genuinely complete Free plan whose only catch is
// the platform fee, and a Plus plan whose headline benefit is 0% fee + scale.
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Horda Free',
    priceMonthly: 0,
    priceAnnual: 0,
    currency: 'EUR',
    feePct: PLATFORM_FEE_PCT,
    blurb: 'Everything you need to run and fill an event.',
    live: true,
    entitlements: FREE_FEATURES,
  },
  {
    id: 'plus',
    name: 'Horda Plus',
    priceMonthly: envNum('HORDA_PLUS_MONTHLY', 69),
    priceAnnual: envNum('HORDA_PLUS_ANNUAL', 59),
    currency: 'EUR',
    feePct: envNum('HORDA_PLUS_FEE_PCT', 0),
    blurb: 'For organisers and clubs running events for real.',
    live: envBool('HORDA_PLUS_LIVE', false),   // flip on when billing is wired
    featured: true,
    entitlements: [
      'zero_fee', ...FREE_FEATURES,
      'checkin_manager', 'tax_collection',
      'extra_seats', 'higher_sends', 'api', 'priority_support',
    ],
  },
];

export const DEFAULT_PLAN_ID = 'free';

export const getPlan = (id: string | null | undefined): Plan =>
  PLANS.find(p => p.id === id) ?? PLANS[0];

/** The platform fee (%) charged to an organiser on the given plan. */
export const feePctForPlan = (id: string | null | undefined): number => getPlan(id).feePct;

/** Does a plan include a feature? The one gate any feature check should call. */
export const hasEntitlement = (id: string | null | undefined, e: Entitlement): boolean =>
  getPlan(id).entitlements.includes(e);

/** % saved by paying annually vs monthly (for the pricing toggle). */
export const annualSavingPct = (p: Plan): number =>
  p.priceMonthly > 0 ? Math.round((1 - p.priceAnnual / p.priceMonthly) * 100) : 0;
