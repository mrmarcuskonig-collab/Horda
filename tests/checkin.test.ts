// checkin.test.ts — the door. Covers the three ways an organiser checks a fan
// in (typed code, in-app scanner POST, native-camera /scan/ URL), the states
// that come back, and the "who actually came" list behind the count.
//
// This file exists because of live feedback: "after I checked in with a code,
// the next page is white/blank". Two defects were behind that surface and both
// are asserted here — a custom-slug event took the entire check-in path down
// with a uuid cast error, and the POST rendered its own result, which a phone
// cannot reload or go back to. Run: node tests/checkin.test.ts
import { startServer } from '../src/web/server.ts';
import { createClaim, checkedInList, verifyPass } from '../src/db/claim_rail_repo.ts';
import { createFan } from '../src/db/engagement_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const db = app.db;

const get = async (p: string) => {
  const r = await fetch(base + p, { redirect: 'manual' });
  return { status: r.status, loc: r.headers.get('location') ?? '', body: await r.text() };
};
const post = async (p: string, body: Record<string, string>) => {
  const r = await fetch(base + p, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  return { status: r.status, loc: r.headers.get('location') ?? '', body: await r.text() };
};
const errored = (b: string) => b.includes("That one's on us");

// An event the demo account owns, so canEdit passes without a login dance.
const host = (await db.query<any>(`SELECT host_kind, host_id FROM event WHERE host_kind IS NOT NULL LIMIT 1`)).rows[0];
const mkEvent = async (slug: string | null) =>
  (await db.query<any>(
    `INSERT INTO event (name, host_kind, host_id, starts_at, slug)
     VALUES ($1,$2,$3, now() + interval '2 days', $4) RETURNING id`,
    ['Door test' + (slug ?? ''), host.host_kind, host.host_id, slug])).rows[0].id;
// Named fans of our own — the seed's fan count is not this file's business.
const fans = await Promise.all(['Nadia Okonkwo', 'Bruno Falk', 'Ilse Marquardt', 'Sami Rahal'].map(async (display_name, i) =>
  ({ id: await createFan(db, `doorfan${i}`, display_name), display_name })));
const claimFor = async (eventId: string, fanId: string) =>
  (await createClaim(db, { eventId, fanId, capacity: null, mode: 'open' })).passToken;

console.log('\n[check-in · typed code, post-redirect-get]');
const e1 = await mkEvent(null);
const t1 = await claimFor(e1, fans[0].id);
const p1 = await post(`/e/${e1}/check-in`, { token: t1 });
ok('POST never renders its own body — it redirects (303)', p1.status === 303);
ok('redirect lands back on the check-in URL, result in the query', p1.loc.startsWith(`/e/${e1}/check-in?r=ok&p=`));
const g1 = await get(p1.loc);
ok('the redirect target renders the success banner', g1.status === 200 && g1.body.includes('✓ Checked in') && g1.body.includes(fans[0].display_name));
ok('and the result survives a reload — same URL, same banner', (await get(p1.loc)).body.includes('✓ Checked in'));
ok('count moved to 1 checked in', g1.body.includes('<b>1</b> checked in'));

const p2 = await post(`/e/${e1}/check-in`, { token: t1 });
ok('a second scan of the same pass reports dup, not a new presence', p2.loc.includes('r=dup'));
ok('dup renders "Already checked in", not an error', (await get(p2.loc)).body.includes('Already checked in'));
ok('dup did not double-count the room', (await get(`/e/${e1}/check-in`)).body.includes('<b>1</b> checked in'));

const p3 = await post(`/e/${e1}/check-in`, { token: 'deadbeefdeadbeefdeadbeefdeadbeef' });
ok('an unknown code redirects with r=bad and leaks nothing typed', p3.loc === `/e/${e1}/check-in?r=bad`);
ok('r=bad renders "Not a valid pass"', (await get(p3.loc)).body.includes('Not a valid pass'));
ok('a forged ?r=ok with no pass shows no banner (cannot fake a check-in)',
  !(await get(`/e/${e1}/check-in?r=ok&p=deadbeefdeadbeefdeadbeefdeadbeef`)).body.includes('✓ Checked in'));

console.log('\n[check-in · the code as a human retypes it]');
const e2 = await mkEvent(null);
const t2 = await claimFor(e2, fans[1].id);
const spaced = t2.replace(/(.{4})/g, '$1 ').trim().toUpperCase();  // exactly what the pass page shows, shift held
const p4 = await post(`/e/${e2}/check-in`, { token: spaced });
ok('spaced + uppercase retype of the code still checks the fan in', p4.loc.includes('r=ok'));

console.log('\n[check-in · custom slug URLs (0052)]');
const e3 = await mkEvent('door-test-night');
const t3 = await claimFor(e3, fans[2].id);
const gs = await get('/e/door-test-night/check-in');
ok('slug event: check-in page renders instead of 500ing', gs.status === 200 && !errored(gs.body));
const ps = await post('/e/door-test-night/check-in', { token: t3 });
ok('slug event: the code is accepted', ps.status === 303 && ps.loc.includes('r=ok'));
ok('slug event: the redirect keeps the pretty URL', ps.loc.startsWith('/e/door-test-night/check-in'));
const gsr = await get(ps.loc);
ok('slug event: banner renders, no error page', gsr.status === 200 && !errored(gsr.body) && gsr.body.includes('✓ Checked in'));
ok('slug event: the list page works too', !errored((await get('/e/door-test-night/checked-in')).body));

console.log('\n[check-in · native camera /scan/ URL]');
const e4 = await mkEvent(null);
const t4 = await claimFor(e4, fans[3].id);
const sc = await get(`/e/${e4}/scan/${t4}`);
ok('scanning as the owner redirects to check-in (a phone can reload it)', sc.status === 303 && sc.loc.startsWith(`/e/${e4}/check-in?r=ok`));
ok('the scan actually recorded a presence', (await checkedInList(db, e4)).length === 1);
ok('scan does not render a dead-end page at the /scan/ URL', sc.body.trim() === '');

console.log('\n[checked-in list · who came]');
const rows = await checkedInList(db, e1);
ok('list returns the fan by name', rows.length === 1 && rows[0].name === fans[0].display_name);
ok('list carries a timestamp and a fidelity', !!rows[0].at && rows[0].fidelity === 'in_room');
const list = await get(`/e/${e1}/checked-in`);
ok('the list page renders the name', list.status === 200 && list.body.includes(fans[0].display_name));
ok('the check-in count links to the list', (await get(`/e/${e1}/check-in`)).body.includes(`href="/e/${e1}/checked-in"`));
ok('manage shows a checked-in count linking to the same list', (await get(`/manage/${e1}`)).body.includes(`href="/e/${e1}/checked-in"`));
const emptyEvent = await mkEvent(null);
const emptyList = await get(`/e/${emptyEvent}/checked-in`);
ok('a door nobody came through says so, it does not render blank',
  emptyList.status === 200 && emptyList.body.includes('Nobody has been checked in yet'));

console.log('\n[checked-in list · owner only]');
const gl = await get(`/e/${e1}/checked-in?guest=1`);
ok('a guest is bounced to the public event page, never sees the names', gl.status === 303 && gl.loc === `/e/${e1}`);

console.log('\n[verifyPass · unchanged contract]');
const e5 = await mkEvent(null);
const t5 = await claimFor(e5, fans[0].id);
ok('verifyPass rejects an empty token', (await verifyPass(db, '', null)).ok === false);
ok('verifyPass ok on first use', (await verifyPass(db, t5, null)).ok === true);
ok('verifyPass already on second use', (await verifyPass(db, t5, null)).already === true);
ok('claim status moved to verified',
  (await db.query<any>(`SELECT status FROM claim WHERE event_id=$1`, [e5])).rows[0].status === 'verified');

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
