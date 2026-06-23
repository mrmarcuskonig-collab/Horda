// membership.test.ts — closeness monetization on live Postgres:
// paid tiers, founding-member numbering, members-only gating, ticket gift/resale.
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { createFan, getAthleteProfile } from '../src/db/engagement_repo.ts';
import { getTier, joinMembership, getMembership, memberCount } from '../src/db/membership_repo.ts';
import { getTicketFor, giftTicket, getListings, buyListing, markPaid } from '../src/db/events_repo.ts';

let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}` + (ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)); ok ? pass++ : fail++; };
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;

console.log('\n[membership · paid tier + founding members]');
const tier = (await getTier(db, 'athlete', rico))!;
eq('tier priced (€4.99)', [tier.name, tier.priceCents], ["Raven's Corner", 499]);
eq('two founding members seeded', await memberCount(db, 'athlete', rico), 2);
eq('"You" is not a member yet', await getMembership(db, ids.fanId, 'athlete', rico), null);
const no = await joinMembership(db, ids.fanId, 'athlete', rico);
eq('joining assigns founding member #3', no, 3);
eq('member count now 3', await memberCount(db, 'athlete', rico), 3);
eq('idempotent: re-join keeps #3', await joinMembership(db, ids.fanId, 'athlete', rico), 3);

console.log('\n[membership · tier-gated drops exist]');
const prof = await getAthleteProfile(db, rico);
ok('a tier-gated drop is present (FOMO)', prof.posts.some(p => p.visibility === 'supporter' || p.visibility === 'clubhouse' || p.visibility === 'members'));

console.log('\n[tickets · gift + resale]');
const ev2 = (await db.query<{ id: string }>(`SELECT id FROM event WHERE admission='paid' LIMIT 1`)).rows[0].id;
await markPaid(db, ev2, ids.fanId);                       // "You" buy a ticket
ok('paying issues "You" a ticket', !!(await getTicketFor(db, ev2, ids.fanId)));
const mine = (await getTicketFor(db, ev2, ids.fanId))!;
const giftee = await createFan(db, 'giftee', 'Giftee');
await giftTicket(db, mine.id, 'giftee');
eq('after gifting, "You" no longer hold it', await getTicketFor(db, ev2, ids.fanId), null);
ok('the giftee now holds the gifted ticket', !!(await getTicketFor(db, ev2, giftee)));
const listings = await getListings(db, ev2);
eq('one resale listing (Rieke, €18)', [listings.length, listings[0]?.priceCents, listings[0]?.seller], [1, 1800, 'Rieke']);
await buyListing(db, listings[0].id, ids.fanId);
ok('after buying the listing, "You" hold a ticket again', !!(await getTicketFor(db, ev2, ids.fanId)));
eq('listing cleared after purchase', (await getListings(db, ev2)).length, 0);

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
