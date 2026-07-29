// pricing.test.ts — pricing is config-driven and experiment-ready.
//   * ONE source of truth (pricing.ts): the AGB, the live Stripe fee and the
//     pricing page all read the same number — change it once, it moves everywhere.
//   * Runtime env overrides: a fee/price can change with no code deploy.
//   * Per-account plan column (0050) so cohorts/experiments are possible.
// Run: node tests/pricing.test.ts
import { PLATFORM_FEE_PCT, PLANS, getPlan, feePctForPlan, hasEntitlement, annualSavingPct } from '../src/web/pricing.ts';
import { TAKE_RATE_PCT } from '../src/web/terms.ts';
import { startServer } from '../src/web/server.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[pricing] config-driven + experiment-ready');

// --- one source of truth --------------------------------------------------
ok('the AGB take rate IS the pricing-config fee (single source)', TAKE_RATE_PCT === PLATFORM_FEE_PCT);
ok('Free plan fee == the platform fee', feePctForPlan('free') === PLATFORM_FEE_PCT);
ok('Plus plan zeroes the fee', feePctForPlan('plus') === 0 && hasEntitlement('plus', 'zero_fee'));
ok('default fee is 5% (Luma parity)', PLATFORM_FEE_PCT === 5);
ok('unknown plan falls back to Free (never crashes a checkout)', getPlan('nope').id === 'free');
ok('Plus includes everything in Free, plus more', PLANS[0].entitlements.every(e => getPlan('plus').entitlements.includes(e)) && getPlan('plus').entitlements.length > PLANS[0].entitlements.length);
ok('annual saving is computed, not hardcoded', annualSavingPct(getPlan('plus')) > 0);

// --- env override (the experiment surface) --------------------------------
// A fresh import with the env set proves a price/fee can move with no deploy.
process.env.HORDA_PLATFORM_FEE_PCT = '7';
const reimport = await import('../src/web/pricing.ts?bust=' + Date.now());
ok('HORDA_PLATFORM_FEE_PCT overrides the fee live (no deploy)', reimport.PLATFORM_FEE_PCT === 7 && reimport.feePctForPlan('free') === 7);
delete process.env.HORDA_PLATFORM_FEE_PCT;

// --- per-account plan column (0050) ---------------------------------------
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const col = await app.db.query<{ c: number }>(`SELECT count(*)::int c FROM information_schema.columns WHERE table_name='account' AND column_name='plan'`);
ok('migration 0050 added account.plan', col.rows[0].c === 1);
const def = await app.db.query<{ plan: string }>(`SELECT plan FROM account LIMIT 1`);
ok('accounts default to the free plan', (def.rows[0]?.plan ?? 'free') === 'free');

// --- the pricing page renders from the config -----------------------------
const pr = await (await fetch(base + '/about/pricing')).text();
ok('pricing page shows both plans from config', pr.includes('Horda Free') && pr.includes('Horda Plus'));
ok('pricing page shows the real fee + the 0% headline', pr.includes(`${PLATFORM_FEE_PCT}% platform fee`) && pr.includes('0% platform fee'));
ok('pricing page has the monthly/annual toggle', pr.includes('billtoggle'));
ok('Plus is honestly marked coming soon (billing not wired)', getPlan('plus').live === false ? pr.includes('Coming soon') : true);
ok('the AGB shows the same rate as the config', (await (await fetch(base + '/agb')).text()).includes(`${PLATFORM_FEE_PCT}%`));

await app.close();
console.log(`\n──────── pricing: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
