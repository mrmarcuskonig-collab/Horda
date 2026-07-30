// subevents.test.ts — a main event that runs sub-events (races, bouts).
//   * sub-events inherit the main event's price + admission + day
//   * they're shown under the main event (first 3 + "Show all N"), not in discovery
//   * one ticket covers the whole event: claiming a SUB also enrols you in the MAIN
//     (both on your feed); claiming the MAIN covers every sub (only main on feed)
//   * on a sub page, a viewer who holds the main ticket sees "covered", no re-claim
// Run: node tests/subevents.test.ts
import { startServer } from '../src/web/server.ts';
import { getClaim, attendingEvents } from '../src/db/claim_rail_repo.ts';
import { getDiscover } from '../src/db/discover_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, b: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b).toString() });
const get = (p: string) => fetch(base + p).then(r => r.text());
const rico = app.ids.athletes[0].id;

console.log('\n[subevents] a main event with sub-events (races / bouts)');

// A paid main event, €20 in person.
const mk = await post('/events', { host_kind: 'athlete', host_id: rico, title: 'City Run', starts_at: '2027-12-01T09:00', location_kind: 'in_person', location: 'Berlin', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '20' });
const main = ((mk.headers.get('location') || '').match(/\/e\/([^/?]+)/) || [])[1] || '';
// Four sub-events (races within the run). They post their own time, but a different day.
for (const nm of ['5k', '10k', 'Half Marathon', 'Kids Run']) await post('/events', { host_kind: 'athlete', host_id: rico, title: nm, starts_at: '2027-12-05T10:00', parent_id: main, archetype: 'single', location_kind: 'in_person', location: 'Berlin', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '99' });
const subs = (await app.db.query<{ id: string; price_cents: number; admission: string; d: string }>(`SELECT id, price_cents, admission, to_char(starts_at,'YYYY-MM-DD') d FROM event WHERE parent_event_id=$1 ORDER BY created_at`, [main])).rows;

ok('four sub-events were created', subs.length === 4);
ok('sub-events inherit the main price (€20), not their own (€99)', subs.every(s => s.price_cents === 2000));
ok('sub-events inherit the main admission (paid)', subs.every(s => s.admission === 'paid'));
ok('sub-events are forced onto the main event day (same-day rule)', subs.every(s => s.d === '2027-12-01'));

// Discovery: subs never surface; the main does.
const disc = await getDiscover(app.db, {});
ok('sub-events do NOT appear in the discovery feed', !disc.upcoming.some(e => subs.some(s => s.id === e.id)));
ok('the main event DOES appear in discovery', disc.upcoming.some(e => e.id === main));

// The main event page lists the subs — first 3, then "Show all 4".
const mp = await get(`/e/${main}?guest=1`);
ok('the main page shows the sub-events "On the card · 4"', mp.includes('On the card · 4'));
ok('only a few are shown, the rest behind "Show all 4"', mp.includes('Show all 4'));

// Claiming a SUB enrols you in the MAIN too — both show on your Horda page.
await post(`/claim/${subs[0].id}`, {});
const feed = (await attendingEvents(app.db, app.ids.fanId)).map(r => r.eventId);
ok('claiming a sub-event puts BOTH the sub and the main on your feed', feed.includes(subs[0].id) && feed.includes(main));
ok('claiming a sub creates the (free) main-event claim', !!(await getClaim(app.db, main, app.ids.fanId)));

// Now the viewer holds the main ticket → every OTHER sub reads "covered", no re-claim.
const otherSub = await get(`/e/${subs[1].id}`);
ok('a sub the viewer has NOT directly claimed shows "covered by your main ticket"', otherSub.includes('main ticket covers this') || otherSub.includes('covered by your'));
ok('the covered sub does NOT show a fresh "Claim your spot" CTA', !/Get ticket · €/.test(otherSub));

// The main event page now marks every sub as covered.
const mp2 = await get(`/e/${main}`);
ok('with the main ticket held, subs on the main page read "✓ Covered"', mp2.includes('✓ Covered') && mp2.includes('Your ticket covers every one of these'));

await app.close();
console.log(`\n──────── subevents: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
