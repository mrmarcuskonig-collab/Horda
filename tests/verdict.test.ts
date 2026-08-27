// verdict.test.ts — rating platform + provenance amendment (hosted-only, tiered).
//   * verified attendees (scan = in_room, stream = online) count to the PUBLIC score
//   * off_platform (no presence) can rate a PAST event, tagged, ORGANISER-ONLY,
//     never in the public room score or the public floor
//   * off_platform cannot rate before the event ends; one verdict per person; clamp
// Run: node tests/verdict.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { createClaim, verifyPass } from '../src/db/claim_rail_repo.ts';
import { createVerdict, verdictEligibility, roomScore, eventReport, attendanceOf } from '../src/db/verdict_repo.ts';
import { roomScoreBlock } from '../src/web/verdict.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const uuid = async () => (await db.query<{ id: string }>(`SELECT gen_random_uuid() id`)).rows[0].id;
const club = (await db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const past = new Date(Date.now() - 2 * 86400000).toISOString();     // an event that has happened
const future = new Date(Date.now() + 7 * 86400000).toISOString();   // one that hasn't
const mkEvent = (title: string, when: string) => createScheduledEvent(db, { hostKind: 'club', hostId: club, title, startsAt: when, admission: 'open' });

async function scanIn(eventId: string, fanId: string, fidelity: 'in_room' | 'online' = 'in_room') {
  const c = await createClaim(db, { eventId, fanId, capacity: 100000, mode: 'open', priceCents: 0 });
  await verifyPass(db, c.passToken, null, fidelity);
}
async function seedVerified(eventId: string, n: number) {
  await db.query(`INSERT INTO claim (event_id, fan_id, status) SELECT $1, gen_random_uuid(), 'verified' FROM generate_series(1, $2::int)`, [eventId, n]);
  await db.query(`INSERT INTO presence (claim_id, fan_id, event_id, fidelity)
     SELECT c.id, c.fan_id, c.event_id, 'in_room' FROM claim c WHERE c.event_id=$1 AND NOT EXISTS (SELECT 1 FROM presence p WHERE p.claim_id=c.id)`, [eventId]);
  const fans = (await db.query<{ fan_id: string }>(`SELECT fan_id FROM presence WHERE event_id=$1 AND fan_id NOT IN (SELECT fan_id FROM verdict WHERE event_id=$1)`, [eventId])).rows;
  for (const f of fans) await createVerdict(db, { eventId, fanId: f.fan_id, atmosphere: 4, worthIt: 4, returnIntent: true, ended: true });
}
async function seedOffPlatform(eventId: string, n: number) {
  for (let i = 0; i < n; i++) await createVerdict(db, { eventId, fanId: await uuid(), atmosphere: 5, worthIt: 5, returnIntent: true, ended: true });
}

console.log('\n[verdict · provenance-tiered rating]');

// --- tiers are derived from the core graph ---
const ev = await mkEvent('Tier A', past);
const fanRoom = await uuid(); await scanIn(ev, fanRoom, 'in_room');
const fanStream = await uuid(); await scanIn(ev, fanStream, 'online');
const fanOff = await uuid();
ok('a door scan reads as in_room', (await attendanceOf(db, ev, fanRoom)).kind === 'in_room');
ok('a stream check-in reads as online', (await attendanceOf(db, ev, fanStream)).kind === 'online');
ok('no presence reads as off_platform', (await attendanceOf(db, ev, fanOff)).kind === 'off_platform');

const vr = await createVerdict(db, { eventId: ev, fanId: fanRoom, atmosphere: 99, worthIt: 0, returnIntent: true, ended: true });
ok('in_room verdict is created + clamped (99→5, 0→1)', vr.ok === true && vr.attendance === 'in_room');
const rrow = (await db.query<{ a: number; w: number }>(`SELECT atmosphere a, worth_it w FROM verdict WHERE event_id=$1 AND fan_id=$2`, [ev, fanRoom])).rows[0];
ok('clamp stored (5 / 1)', rrow.a === 5 && rrow.w === 1);
const vs = await createVerdict(db, { eventId: ev, fanId: fanStream, atmosphere: 4, worthIt: 4, returnIntent: true, ended: true });
ok('online verdict is created + tagged online', vs.ok === true && vs.attendance === 'online');
const vo = await createVerdict(db, { eventId: ev, fanId: fanOff, atmosphere: 5, worthIt: 5, returnIntent: false, note: 'sofa take', ended: true });
ok('off_platform verdict is created + tagged (event ended)', vo.ok === true && vo.attendance === 'off_platform');
ok('one verdict per person', (await createVerdict(db, { eventId: ev, fanId: fanRoom, atmosphere: 3, worthIt: 3, returnIntent: false, ended: true })).ok === false);

// --- off_platform blocked before the event ends ---
const evF = await mkEvent('Future', future);
const eF = await createVerdict(db, { eventId: evF, fanId: await uuid(), atmosphere: 4, worthIt: 4, returnIntent: true, ended: false });
ok('off_platform cannot rate before the event ends', eF.ok === false && (eF as any).reason === 'not_ended');

// --- the public floor + score use VERIFIED tiers only ---
const evB = await mkEvent('Floor B', past);
await seedVerified(evB, 4);       // 4 verified (below the 5 floor)
await seedOffPlatform(evB, 6);    // lots of wider ratings — must NOT lift the floor
ok('off_platform does not count toward the public floor', (await roomScore(db, evB)) === null);
await seedVerified(evB, 1);       // 5th verified → floor cleared
const rsB = await roomScore(db, evB);
ok('public score appears at 5 VERIFIED verdicts', rsB !== null && rsB.verdicts === 5);
ok('public score counts verified only (not the 6 wider)', rsB !== null && rsB.verdicts === 5);

// --- organiser report splits verified vs wider; public block has no wider ---
const rep = await eventReport(db, evB);
ok('report separates verified vs wider', rep.verifiedVerdicts === 5 && rep.widerVerdicts === 6);
ok('report response rate is verified ÷ presences', Math.abs(rep.responseRate - 5 / rep.presences) < 1e-9);
ok('public room-score block shows no wider/off_platform text', !roomScoreBlock(rsB!).toLowerCase().includes('wider'));

// --- HTTP: anyone logged-in can rate a PAST hosted event; off_platform allowed ---
const evH = await mkEvent('HTTP past', past);      // demo viewer has no presence here
const done = await fetch(`${base}/e/${evH}/verdict`, post({ atmosphere: '4', worth_it: '4', return_intent: '1', note: 'tv take' }));
ok('logged-in non-attendee can rate a past event (HTTP off_platform)', done.status === 200 && (await done.text()).includes('Verdict in'));
ok('that verdict is tagged off_platform', (await db.query<{ attendance: string }>(`SELECT attendance FROM verdict WHERE event_id=$1 AND fan_id=$2`, [evH, app.ids.fanId])).rows[0]?.attendance === 'off_platform');
// future event: rating not open yet
const evH2 = await mkEvent('HTTP future', future);
const early = await fetch(`${base}/e/${evH2}/verdict`, post({ atmosphere: '4', worth_it: '4', return_intent: '1' }));
ok('rating a not-yet-happened event is refused (HTTP 403)', early.status === 403);
// the private note never leaks to the public event page
ok('off_platform note stays off the public event page', !(await (await fetch(`${base}/e/${evH}?guest=1`)).text()).includes('tv take'));

await app.close();
console.log(`\n──────── verdict: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
