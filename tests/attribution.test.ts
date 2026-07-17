// attribution.test.ts — "who drove this fan / this ticket". THE number Horda
// sells. If it's wrong, the product is a lie, so it gets its own suite.
//
// THE DISTINCTION THAT MATTERS, and that was collapsed until now:
//   identities   — PEOPLE WE NOW KNOW. One per claim. If you bring three mates
//                  on your ticket, Horda learns about YOU, not about them.
//   ticketBuyers — people who paid. One per paid claim, same reasoning.
//   tickets      — SEATS SOLD (sum of party_size). The money number.
// They are not the same number. Reporting claims as if they were tickets
// under-reported a 4-seat sale as "1" — a 4× under-count of exactly the reach
// an athlete would be paid for. That bug arrived the moment party_size shipped.
//
// Run: node tests/attribution.test.ts
import { startServer } from '../src/web/server.ts';
import { partyAttribution, shareAttribution, getOrCreateShareToken, recordShareClick } from '../src/db/events_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const db = app.db;
const base = `http://localhost:${app.port}`;
const host = app.ids.athletes[0].id;
const soon = new Date(Date.now() + 864e5).toISOString().slice(0, 16);

console.log('\n[attribution] promo links · share-under-my-name · the roll-up');

const r = await fetch(base + '/events', {
  method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    host_kind: 'athlete', host_id: host, title: 'ATTR', starts_at: soon, location_kind: 'in_person',
    fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '25', fmt_inperson_maxpp: '4',
    archetype: 'versus', side_b_name: 'FC Rival',
  }).toString(),
});
const eid = (r.headers.get('location') || '').replace('/e/', '');
const parties = (await db.query<any>(`SELECT id, role, side, promo_token FROM event_party WHERE event_id=$1`, [eid])).rows;
const fan = async (n: string) => (await db.query<any>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`, [n])).rows[0].id;

// --- every party gets a link, automatically ---------------------------------
ok('a versus event auto-creates organizer + both sides', parties.length === 3 && parties.some(p => p.side === 'A') && parties.some(p => p.side === 'B'));
ok('every party gets its own promo token', parties.every(p => !!p.promo_token) && new Set(parties.map(p => p.promo_token)).size === 3);
const sideB = parties.find(p => p.side === 'B')!.promo_token;

// --- the rival's link drives claims -----------------------------------------
const [a, c] = [await fan('A'), await fan('C')];
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',4,2500,$3)`, [eid, a, 'party:' + sideB]);
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',1,2500,$3)`, [eid, c, 'party:' + sideB]);
const pa = await partyAttribution(db, eid);
const b = pa.rows.find(x => x.side === 'B')!;
ok('identities = people we now know (2 accounts, not 5 bodies)', b.identities === 2);
ok('ticketBuyers = people who paid (2)', b.ticketBuyers === 2);
// The regression: this reported 2 before — a 4-seat sale counted once.
ok('tickets = SEATS SOLD (5), not claims (2) — the money number', b.tickets === 5);
ok('the totals roll up all three numbers', pa.total.identities === 2 && pa.total.tickets === 5);

// --- share under my own name -------------------------------------------------
const [sharer, viaFan] = [await fan('Sharer'), await fan('CameVia')];
const tok = await getOrCreateShareToken(db, eid, sharer);
ok('a fan gets a share token of their own', !!tok);
ok('the token is stable — sharing twice does not mint two links', (await getOrCreateShareToken(db, eid, sharer)) === tok);
const clicked = await recordShareClick(db, tok);
ok('a click on that link is attributed back to the sharer', clicked?.fanId === sharer);
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',3,2500,$3)`, [eid, viaFan, 'via:' + tok]);
const sa = await shareAttribution(db, eid);
const mine = sa.find(x => x.fanId === sharer)!;
ok('the sharer is credited with the identity they brought', mine.claims === 1);
ok('the sharer is credited with the SEATS that person took (3)', mine.tickets === 3);
ok('clicks are counted separately from conversions', mine.clicks === 1);

// --- a share and a promo link must not double-count the same claim -----------
const totalSeats = (await db.query<{ n: number }>(`SELECT COALESCE(SUM(party_size),0)::int n FROM claim WHERE event_id=$1 AND status NOT IN ('refunded','no_show')`, [eid])).rows[0].n;
ok('party + share attribution together never exceed the real seats sold', pa.total.tickets + mine.tickets <= totalSeats);

// --- money that came back must stop counting --------------------------------
const refunded = await fan('Refunded');
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'refunded',2,2500,$3)`, [eid, refunded, 'party:' + sideB]);
const noShow = await fan('NoShow');
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'no_show',2,2500,$3)`, [eid, noShow, 'party:' + sideB]);
const pa2 = await partyAttribution(db, eid);
ok('refunded + no-show claims are excluded from attribution', pa2.rows.find(x => x.side === 'B')!.tickets === 5);

// --- a promo click on the page is recorded ----------------------------------
await fetch(base + `/e/${eid}?p=${sideB}`);
const clicks = (await db.query<{ clicks: number }>(`SELECT clicks FROM event_party WHERE promo_token=$1`, [sideB])).rows[0];
ok('arriving via a promo link records the click', clicks.clicks >= 1);

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
