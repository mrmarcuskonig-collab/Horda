// tiers.test.ts — Substack-style tiering + earned Superfan, on live (PGlite) PG.
// Run: node tests/tiers.test.ts
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { createFan } from '../src/db/engagement_repo.ts';
import {
  getTiers, getTier, joinMembership, cancelMembershipBySub, getMembership, isSuperfan, loyaltyScore,
  recordLoyalty, topSuperfans, canSeePost, SUPERFAN_THRESHOLD,
} from '../src/db/membership_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;

console.log('\n[tiers · ladder]');
const tiers = await getTiers(db, 'athlete', rico);
ok('two tiers: supporter + clubhouse', tiers.length === 2 && tiers[0].level === 'supporter' && tiers[1].level === 'clubhouse');
ok('supporter has monthly + annual price', tiers[0].priceCents === 499 && tiers[0].priceAnnualCents === 4900);
ok('clubhouse ≈ 2× annual supporter (or more)', (tiers[1].priceAnnualCents ?? 0) >= 2 * (tiers[0].priceAnnualCents ?? 0) - 1);

console.log('\n[tiers · join + upgrade]');
const al = await createFan(db, 'al', 'Al');
await joinMembership(db, al, 'athlete', rico, 'supporter', 'annual');
ok('joins as supporter', (await getMembership(db, al, 'athlete', rico))?.tierLevel === 'supporter');
ok('supporter is NOT a superfan by tier alone', !(await isSuperfan(db, al, 'athlete', rico)));
await joinMembership(db, al, 'athlete', rico, 'clubhouse', 'monthly');
ok('upgrades to clubhouse', (await getMembership(db, al, 'athlete', rico))?.tierLevel === 'clubhouse');
ok('clubhouse member IS a superfan', await isSuperfan(db, al, 'athlete', rico));
await joinMembership(db, al, 'athlete', rico, 'supporter', 'monthly');
ok('never silently downgraded below clubhouse', (await getMembership(db, al, 'athlete', rico))?.tierLevel === 'clubhouse');

console.log('\n[tiers · earned Superfan (free path)]');
const zoe = await createFan(db, 'zoe', 'Zoe');
ok('new fan starts at 0 loyalty', (await loyaltyScore(db, zoe, 'athlete', rico)) === 0);
await recordLoyalty(db, zoe, 'athlete', rico, 'follow');   // 5
await recordLoyalty(db, zoe, 'athlete', rico, 'share');    // 15
ok('loyalty accrues (20) but below threshold → not superfan', (await loyaltyScore(db, zoe, 'athlete', rico)) === 20 && !(await isSuperfan(db, zoe, 'athlete', rico)));
for (let i = 0; i < 10; i++) await recordLoyalty(db, zoe, 'athlete', rico, 'attend'); // +200
ok('crossing the threshold earns Superfan without paying', (await loyaltyScore(db, zoe, 'athlete', rico)) >= SUPERFAN_THRESHOLD && await isSuperfan(db, zoe, 'athlete', rico));
ok('earned Superfan is NOT a paying member (status, not access)', (await getMembership(db, zoe, 'athlete', rico)) === null);

console.log('\n[tiers · subscription cancellation (Stripe webhook)]');
const sam = await createFan(db, 'sam', 'Sam');
await joinMembership(db, sam, 'athlete', rico, 'clubhouse', 'monthly', 'sub_cancel_me');
ok('paid member is active + superfan', (await getMembership(db, sam, 'athlete', rico))?.tierLevel === 'clubhouse' && await isSuperfan(db, sam, 'athlete', rico));
ok('cancellation by sub id reports a hit', await cancelMembershipBySub(db, 'sub_cancel_me'));
ok('canceled member loses active membership (reverts to free)', (await getMembership(db, sam, 'athlete', rico)) === null && !(await isSuperfan(db, sam, 'athlete', rico)));
ok('unknown subscription id is a safe no-op', !(await cancelMembershipBySub(db, 'sub_does_not_exist')));

console.log('\n[tiers · seeded Maja earns it, leaderboard]');
ok('seeded Maja is an earned Superfan', (await topSuperfans(db, 'athlete', rico)).some(s => s.name === 'Maja'));

console.log('\n[tiers · post gating]');
ok('public visible to everyone', canSeePost(null, 'public'));
ok('supporter drop hidden from free fans', !canSeePost(null, 'supporter'));
ok('supporter sees supporter, not clubhouse', canSeePost('supporter', 'supporter') && !canSeePost('supporter', 'clubhouse'));
ok('clubhouse sees everything', canSeePost('clubhouse', 'clubhouse') && canSeePost('clubhouse', 'supporter'));
ok('legacy "members" == supporter level', canSeePost('supporter', 'members'));

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
