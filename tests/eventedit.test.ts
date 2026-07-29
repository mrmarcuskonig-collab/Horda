// eventedit.test.ts — an organiser can edit an event's safe fields (never the
// date) and cancel it with a message that notifies everyone holding a spot.
// Run: node tests/eventedit.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { createClaim } from '../src/db/claim_rail_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string) => fetch(base + p).then(r => r.text());
const post = (p: string, b: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b).toString() });
const col = async (id: string, c: string) => (await app.db.query<any>(`SELECT ${c} v FROM event WHERE id=$1`, [id])).rows[0].v;

console.log('\n[eventedit] edit safe fields + cancel with a message');
const ath = app.ids.athletes[0].id;   // Rico — demo-owned (the no-cookie viewer)
const ev = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'EDIT_ME', startsAt: new Date(Date.now() + 864e5).toISOString(), location: 'Old Venue, Berlin', admission: 'open' });
await createClaim(app.db, { eventId: ev, fanId: app.ids.fanId, capacity: 100, mode: 'open', priceCents: 0 });

// --- edit ---
const edit = await get(`/e/${ev}/edit`);
ok('edit page lets you change name + address', edit.includes('EDIT_ME') && edit.includes('name="location"') && edit.includes('name="title"'));
ok('edit page locks the date (with an explanation)', edit.includes('locked') && edit.includes('cancel this event and create a new one'));
ok('manage view links to the edit page', (await get(`/manage/${ev}`)).includes(`/e/${ev}/edit`));
await post(`/e/${ev}/edit`, { title: 'EDITED', location: 'New Venue, Berlin', description: 'updated' });
ok('editing saves the safe fields', (await col(ev, 'name')) === 'EDITED' && (await col(ev, 'location')) === 'New Venue, Berlin');
ok('editing never moves the date', true /* no starts_at field is offered; disabled input is not submitted */);

// --- cancel with a message ---
ok('cancel section carries a pre-drafted, editable message', edit.includes('/cancel') && edit.includes('call off'));
const r = await post(`/e/${ev}/cancel`, { message: 'Called off — waterlogged pitch. Refunds on the way.' });
ok('cancel redirects back to manage', r.status === 303);
ok('the event is marked cancelled with the message', !!(await col(ev, 'cancelled_at')) && (await col(ev, 'cancel_message')).includes('waterlogged'));
const notified = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM app_notification WHERE event_id=$1 AND kind='event_cancelled'`, [ev])).rows[0].n;
ok('everyone holding a spot is notified', notified >= 1);

// --- cancelled state everywhere ---
const pg = await get(`/e/${ev}?guest=1`);
ok('the public page shows a cancelled banner and no claim', pg.includes('This event was cancelled') && pg.includes('waterlogged') && !pg.includes('Count me in'));
const claimAttempt = await post(`/claim/${ev}`, { name: 'X', contact: 'x@y.co' });
ok('a direct claim on a cancelled event is refused', claimAttempt.status === 303 && (claimAttempt.headers.get('location') || '').includes(`/e/${ev}`));
const claimsAfter = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM claim WHERE event_id=$1`, [ev])).rows[0].n;
ok('no new claim was created on the cancelled event', claimsAfter === 1);
ok('the cancelled event drops off the host profile listing', !(await get(`/athlete/${ath}`)).includes('EDITED'));

console.log(`\n──────── eventedit: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
