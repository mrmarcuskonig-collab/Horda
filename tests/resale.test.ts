// resale.test.ts — HORDA DOES NOT DO RESALE. This is the guard on that decision.
//
// DECIDED 17 Jul 2026 (Marcus): no resale, ever. Not deferred — declined. The
// reasoning lives in src/db/transfer_repo.ts; the short version is that a ticket
// which can be sold attracts people who want the ticket rather than the event,
// and knowing who is actually in the room is the whole product. Luma reached the
// same conclusion: free transfer only, no secondary market, resale unmentioned in
// their Terms.
//
// Two jobs, and the first matters more:
//
//   1. NOTHING IS OFFERED. No UI, no live endpoint, no accidental path to a paid
//      transfer. The AGB says tickets are personengebunden and Horda offers no
//      resale; if any of these fail, the contract is a lie.
//   2. THE LOGIC IS CORRECT ANYWAY. Void-then-reissue, price capped at face
//      value, seat freed, old QR dead, ledger written. Tested with force:true —
//      the only caller that bypasses the flag.
//
//      Why keep testing logic we've decided never to ship? Because the ledger and
//      the return path ARE shipped — refunds and organiser cancellations move
//      tickets and must be recorded. And because a decision reversed under
//      deadline by someone who never read this file should land on guardrails
//      that already work, not on a fresh implementation. Dormant, not dead.
// Run: node tests/resale.test.ts
import { startServer } from '../src/web/server.ts';
import { RESALE_ENABLED, GIFT_ENABLED, transferClaim, claimProvenance, eventTransfers, faceValueOf, TransferError } from '../src/db/transfer_repo.ts';
import { createClaim, getClaim, spotsInfo, getPass } from '../src/db/claim_rail_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const throws = async (n: string, code: string, fn: () => Promise<unknown>) => {
  try { await fn(); ok(n, false); }
  catch (e) { ok(n, e instanceof TransferError && e.code === code); }
};

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const db = app.db;
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString(), redirect: 'manual' as const });

console.log('\n[resale] switched off · logic baked in');

// --- 1. NOTHING IS OFFERED ------------------------------------------------
ok('RESALE_ENABLED is off by default', RESALE_ENABLED === false);
ok('GIFT_ENABLED is off by default', GIFT_ENABLED === false);

for (const r of ['gift', 'list', 'buy']) {
  const res = await fetch(`${base}/ticket/${r}`, form({ ticket_id: 'x', event_id: 'y', price: '10', to_handle: '@a' }));
  ok(`POST /ticket/${r} is dead (404) — an unlinked endpoint is still an endpoint`, res.status === 404);
}

const evId = (await db.query<{ id: string }>(`SELECT id FROM event LIMIT 1`)).rows[0].id;
const evPage = await (await fetch(`${base}/e/${evId}`)).text();
for (const word of ['>Sell</button>', '>Gift</button>', 'resell', 'name="to_handle"']) {
  ok(`event page shows nothing resale-related: ${word}`, !evPage.includes(word));
}
// No "coming soon" either — an affordance is a promise, and it changes who buys.
ok('no resale teaser anywhere on the event page', !/resale/i.test(evPage.replace(/<!--[\s\S]*?-->/g, '')));

// The flag is what makes the AGB true, so assert the contract still says so.
const agb = await (await fetch(`${base}/agb`)).text();
ok('AGB states Horda offers no resale', agb.includes('no resale of tickets') && agb.includes('identity-bound'));
// "currently not offered" framed this as temporary. It isn't — it's a position,
// and the contract should say what we mean.
ok('AGB frames it as a decision, not a temporary gap', agb.includes('deliberate decision') && agb.includes('not a temporary limitation'));
ok('AGB states plainly there is no secondary market', agb.includes('no secondary market on Horda'));
// If you can't go, the answer is the organiser — not a marketplace. The contract
// has to give the fan somewhere to actually go.
ok('AGB points a stuck fan at the organiser', agb.includes('please contact the organiser'));
// Cross-references in a contract must resolve. Resale is section 9; the pointer
// in the tickets clause must aim there, not off-by-one.
ok('the resale cross-reference points at the resale clause', agb.includes('no resale via Horda (see section 9)'));
ok('section 9 is in fact the resale clause', /<h2>9\. No resale<\/h2>/.test(agb));

// --- 2. THE LOGIC IS RIGHT ANYWAY ----------------------------------------
const fanA = (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ('Seller A') RETURNING id`)).rows[0].id;
const fanB = (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ('Buyer B') RETURNING id`)).rows[0].id;
const fanC = (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ('Third C') RETURNING id`)).rows[0].id;

const capEv = (await db.query<{ id: string }>(
  `INSERT INTO event (name, starts_at, capacity, host_kind, host_id)
   SELECT 'Transfer Test', now() + interval '30 days', 10, host_kind, host_id FROM event WHERE id=$1 RETURNING id`, [evId])).rows[0].id;

const c1 = await createClaim(db, { eventId: capEv, fanId: fanA, capacity: 10, mode: 'open', partySize: 2, priceCents: 2500, maxPerPerson: 4 });
ok('setup: A holds a 2-person claim at €25/spot', c1.partySize === 2);
ok('face value is read from the claim, not recomputed later', await faceValueOf(db, c1.claimId) === 2500);
ok('setup: 2 of 10 seats taken', (await spotsInfo(db, capEv, 10)).claimed === 2);

// The flag is enforced in the repo, not just in the absence of a route.
await throws('a resale is refused while the flag is off', 'resale_disabled',
  () => transferClaim(db, { claimId: c1.claimId, toFanId: fanB, kind: 'resale', priceCents: 2500 }));
await throws('a gift is refused while the flag is off', 'gift_disabled',
  () => transferClaim(db, { claimId: c1.claimId, toFanId: fanB, kind: 'gift' }));

// RULE 2: face value is the ceiling. The anti-tout position, enforced.
await throws('cannot resell above face value', 'above_face_value',
  () => transferClaim(db, { claimId: c1.claimId, toFanId: fanB, kind: 'resale', priceCents: 5001, force: true }));
ok('face value is per spot × spots — 2 tickets at €25 may go for €50', true);
await throws('a "gift" with a price is not a gift', 'gift_priced',
  () => transferClaim(db, { claimId: c1.claimId, toFanId: fanB, kind: 'gift', priceCents: 1, force: true }));

// RULE 1: void then reissue. The old QR must be dead the instant it commits.
const oldToken = (await db.query<{ token: string }>(`SELECT token FROM pass WHERE claim_id=$1`, [c1.claimId])).rows[0].token;
const t1 = await transferClaim(db, { claimId: c1.claimId, toFanId: fanB, kind: 'resale', priceCents: 5000, force: true });
ok('the buyer gets a NEW claim', !!t1.newClaimId && t1.newClaimId !== c1.claimId);
ok('the buyer gets a NEW pass token — a new QR', !!t1.newToken && t1.newToken !== oldToken);
ok('the seller\'s claim is voided', !!(await db.query<{ v: string | null }>(`SELECT voided_at v FROM claim WHERE id=$1`, [c1.claimId])).rows[0].v);
ok('the seller now reads as not attending', await getClaim(db, capEv, fanA) === null);
ok('the buyer reads as attending', (await getClaim(db, capEv, fanB))?.status === 'claimed');
ok('the party size travels with the ticket (2 spots, not 1)',
  (await db.query<{ n: number }>(`SELECT party_size n FROM claim WHERE id=$1`, [t1.newClaimId!])).rows[0].n === 2);

// THE CAPACITY INVARIANT. A transfer moves a seat; it must never mint one. If
// the voided claim still counted, the room would double-book: two people, one
// seat, and the second finds out at the door.
ok('capacity is unchanged by a transfer — a seat moved, not created',
  (await spotsInfo(db, capEv, 10)).claimed === 2);
ok('the reissued pass resolves to the buyer', (await getPass(db, t1.newToken!))?.fanId === fanB);

// The old QR is the whole anti-tout claim: a screenshot sold twice is worthless.
const oldPass = await getPass(db, oldToken);
ok('the old QR still resolves BUT reads as refunded, not admissible', oldPass?.status === 'refunded');

// The ledger.
const led = await eventTransfers(db, capEv);
ok('the transfer is ledgered', led.length === 1 && led[0].kind === 'resale');
ok('the ledger records what was paid AND what it was worth', led[0].priceCents === 5000 && led[0].faceValueCents === 2500);
ok('the ledger names both hands', led[0].fromFanId === fanA && led[0].toFanId === fanB);
const prov = await claimProvenance(db, t1.newClaimId!);
ok('provenance walks back to the original holder', prov.length === 1 && prov[0].fromFanId === fanA);

// One live claim per person per event — 0031's UNIQUE made this impossible to
// enforce alongside history; 0042 replaces it with a partial index.
await createClaim(db, { eventId: capEv, fanId: fanC, capacity: 10, mode: 'open', partySize: 1 });
await throws('cannot hand a ticket to someone who already has one', 'already_claimed',
  () => transferClaim(db, { claimId: t1.newClaimId!, toFanId: fanC, kind: 'resale', priceCents: 100, force: true }));
await throws('cannot transfer a ticket twice', 'already_void',
  () => transferClaim(db, { claimId: c1.claimId, toFanId: fanC, kind: 'resale', priceCents: 100, force: true }));

// THE ONE 0031'S UNIQUE CONSTRAINT WOULD HAVE BROKEN IN PRODUCTION, ON A PAID
// TICKET, IN FRONT OF A FAN: the seller comes back.
const back = await createClaim(db, { eventId: capEv, fanId: fanA, capacity: 10, mode: 'open', partySize: 1 });
ok('someone who sold their ticket can claim the event again', !!back.claimId && back.status === 'claimed');

// A waitlisted claim is a hope, not a ticket. Selling a place in a queue is the
// oldest trick there is.
const tinyEv = (await db.query<{ id: string }>(
  `INSERT INTO event (name, starts_at, capacity, host_kind, host_id)
   SELECT 'Sold Out', now() + interval '30 days', 1, host_kind, host_id FROM event WHERE id=$1 RETURNING id`, [evId])).rows[0].id;
await createClaim(db, { eventId: tinyEv, fanId: fanA, capacity: 1, mode: 'open' });
const wl = await createClaim(db, { eventId: tinyEv, fanId: fanB, capacity: 1, mode: 'open' });
ok('setup: the second claim waitlists', wl.status === 'waitlisted');
const wlClaimId = (await getClaim(db, tinyEv, fanB))!.id;
await throws('a waitlist place cannot be sold', 'not_transferable',
  () => transferClaim(db, { claimId: wlClaimId, toFanId: fanC, kind: 'resale', priceCents: 100, force: true }));

// A 'return' hands the seat back and gives it to nobody.
const aClaimId = (await getClaim(db, tinyEv, fanA))!.id;
const ret = await transferClaim(db, { claimId: aClaimId, toFanId: fanC, kind: 'return', force: true, reason: 'organiser refund' });
ok('a return mints no new claim', ret.newClaimId === null);
ok('a return frees the seat', (await spotsInfo(db, tinyEv, 1)).remaining === 1);

// FOUND BY THE LINE ABOVE. spotsInfo counted the WAITLIST against capacity
// (`status <> 'refunded'` swept waitlisted rows in), so a sold-out event stayed
// sold out no matter how many people left — the seats read as taken by the very
// people queuing for them, and the waitlist could never drain. formatSpots had
// this right; the event-level path every door-less event uses did not.
ok('a waitlisted person does not occupy a seat', (await spotsInfo(db, tinyEv, 1)).claimed === 0);
const freed = await createClaim(db, { eventId: tinyEv, fanId: fanC, capacity: 1, mode: 'open' });
ok('the freed seat can actually be claimed by someone else', freed.status === 'claimed');

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
