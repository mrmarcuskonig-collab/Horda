// promocode.test.ts — organiser discount codes on an event's paid tickets.
//   * create several codes (10/20/50/free), unique per event, validated
//   * they render on the manage page in the share-panel style, with an add form
//   * a fan typing a code at claim time gets the discounted price (free = €0)
//   * uses are counted; a removed code no longer applies
// Run: node tests/promocode.test.ts
import { startServer } from '../src/web/server.ts';
import { listFormats } from '../src/db/event_format_repo.ts';
import { listPromoCodes, createPromoCode, applyPercent, normalizeCode, isValidCode } from '../src/db/promo_code_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, body: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const get = (p: string) => fetch(base + p).then(r => r.text());
const host = app.ids.athletes[0].id;   // owned by the demo viewer (cookieless = demo)

console.log('\n[promocode] organiser discount codes on paid tickets');

// --- pure helpers ---
ok('normalize upper-cases + trims', normalizeCode('  derby20 ') === 'DERBY20');
ok('valid/invalid code shapes', isValidCode('DERBY-20') && !isValidCode('x') && !isValidCode('a b'));
ok('applyPercent math (€20 − 50% = €10, free = €0)', applyPercent(2000, 50) === 1000 && applyPercent(2000, 100) === 0 && applyPercent(2000, 10) === 1800);

// --- create a paid, in-person event via the form so it has a real ticketed door ---
const mk = await post('/events', { host_kind: 'athlete', host_id: host, title: 'Promo Fight', starts_at: '2027-11-01T19:00', location_kind: 'in_person', location: 'Berlin', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '20' });
const eid = ((mk.headers.get('location') || '').match(/\/e\/([^/?]+)/) || [])[1] || '';
const fmt = (await listFormats(app.db, eid)).find(f => f.requiresTicket)!;
ok('event has a €20 ticketed door', !!fmt && fmt.priceCents === 2000);

// --- organiser adds several codes (owner-gated route) ---
await post(`/e/${eid}/promocode`, { code: 'DERBY10', percent: '10' });
await post(`/e/${eid}/promocode`, { code: 'DERBY50', percent: '50' });
await post(`/e/${eid}/promocode`, { code: 'FREEVIP', percent: '100' });
await post(`/e/${eid}/promocode`, { code: 'DERBY50', percent: '50' });   // dup — should be ignored
const codes = await listPromoCodes(app.db, eid);
ok('three codes created (duplicate rejected)', codes.length === 3 && codes.some(c => c.code === 'DERBY50') && codes.some(c => c.percentOff === 100));

// --- manage page shows them in the share-panel style + an add form ---
const manage = await get(`/manage/${eid}`);
ok('manage shows a Promo codes section', manage.includes('Promo codes') && manage.includes('DERBY50'));
ok('manage shows discount labels incl. "Free ticket"', manage.includes('50% off') && manage.includes('Free ticket'));
ok('manage has an add-code form (same .promo-new design as custom links)', manage.includes('action="/e/' + eid + '/promocode"') && manage.includes('name="percent"'));

// --- fan claims WITH a code → the claim price reflects the discount.
// Each scenario uses a FRESH event because a fan re-claiming the same event just
// returns their existing claim (idempotent), which would mask the new price.
let evN = 0;
const claimPriceFresh = async (code: string | undefined, addCode?: { code: string; percent: number }) => {
  const d = new Date(Date.now() + (++evN + 40) * 864e5).toISOString().slice(0, 16);
  const mkr = await post('/events', { host_kind: 'athlete', host_id: host, title: 'PF' + evN, starts_at: d, location_kind: 'in_person', location: 'Berlin', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '20' });
  const id = ((mkr.headers.get('location') || '').match(/\/e\/([^/?]+)/) || [])[1];
  const f2 = (await listFormats(app.db, id)).find(x => x.requiresTicket)!;
  if (addCode) await post(`/e/${id}/promocode`, { code: addCode.code, percent: String(addCode.percent) });
  const r = await post(`/claim/${id}`, { format_id: f2.id, ...(code ? { promo_code: code } : {}) });
  const tok = ((r.headers.get('location') || '').match(/\/pass\/([^/?]+)/) || [])[1];
  return (await app.db.query<{ price_cents: number | null }>(`SELECT c.price_cents FROM claim c JOIN pass pa ON pa.claim_id=c.id WHERE pa.token=$1`, [tok])).rows[0]?.price_cents ?? null;
};
ok('a 50% code halves the ticket price (2000 → 1000)', (await claimPriceFresh('halfoff', { code: 'HALFOFF', percent: 50 })) === 1000);
ok('a free code makes the ticket €0', (await claimPriceFresh('vipfree', { code: 'VIPFREE', percent: 100 })) === 0);
ok('no code → full price', (await claimPriceFresh(undefined)) === 2000);
ok('an unknown code → full price (ignored, not an error)', (await claimPriceFresh('NOPE')) === 2000);

// Redeeming the DERBY50 code on the main event counts a use.
await post(`/claim/${eid}`, { format_id: fmt.id, promo_code: 'derby50' });
ok('a redemption is counted on the code', (await listPromoCodes(app.db, eid)).find(c => c.code === 'DERBY50')!.uses >= 1);

// --- removing a code drops it from the list (and it stops resolving) ---
const del = (await listPromoCodes(app.db, eid)).find(c => c.code === 'DERBY50')!;
await post(`/e/${eid}/promocode/${del.id}/delete`, {});
ok('a removed code is gone from the event', !(await listPromoCodes(app.db, eid)).some(c => c.code === 'DERBY50'));

// --- a non-owner cannot add a code (guest → canEdit false) ---
const otherEv = ((await post('/events', { host_kind: 'athlete', host_id: host, title: 'X', starts_at: '2028-01-02T19:00', location_kind: 'in_person', location: 'B', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '10' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
await post(`/e/${otherEv}/promocode?guest=1`, { code: 'HACK10', percent: '10' });
ok('a non-owner cannot add a promo code', (await listPromoCodes(app.db, otherEv)).length === 0);

await app.close();
console.log(`\n──────── promocode: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
