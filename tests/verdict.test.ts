// verdict.test.ts — rating platform, slice 1. The acceptance criteria from
// rating-platform.md §4.1, asserted from BOTH the repo and the HTTP side.
// Run: node tests/verdict.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { createClaim, verifyPass } from '../src/db/claim_rail_repo.ts';
import { createVerdict, verdictEligibility, roomScore, eventReport } from '../src/db/verdict_repo.ts';
import { roomScoreBlock } from '../src/web/verdict.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const uuid = async () => (await db.query<{ id: string }>(`SELECT gen_random_uuid() id`)).rows[0].id;
const club = (await db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const soon = new Date(Date.now() + 7 * 86400000).toISOString();
const mkEvent = (title: string) => createScheduledEvent(db, { hostKind: 'club', hostId: club, title, startsAt: soon, admission: 'open' });

// scan a fan in for real (claim → verify → presence), return the presence id
async function scanIn(eventId: string, fanId: string): Promise<string> {
  const c = await createClaim(db, { eventId, fanId, capacity: 100000, mode: 'open', priceCents: 0 });
  await verifyPass(db, c.passToken, null);
  return (await db.query<{ id: string }>(`SELECT id FROM presence WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0].id;
}
// bulk crowd for the floor maths (claims + presences with fresh fans)
async function bulkPresences(eventId: string, n: number) {
  await db.query(`INSERT INTO claim (event_id, fan_id, status) SELECT $1, gen_random_uuid(), 'verified' FROM generate_series(1, $2::int)`, [eventId, n]);
  await db.query(`INSERT INTO presence (claim_id, fan_id, event_id)
     SELECT c.id, c.fan_id, c.event_id FROM claim c WHERE c.event_id=$1 AND NOT EXISTS (SELECT 1 FROM presence p WHERE p.claim_id=c.id)`, [eventId]);
}
async function addVerdicts(eventId: string, n: number) {
  const ps = (await db.query<{ id: string }>(
    `SELECT id FROM presence WHERE event_id=$1 AND id NOT IN (SELECT presence_id FROM verdict WHERE event_id=$1) LIMIT $2::int`, [eventId, n])).rows;
  for (const p of ps) await createVerdict(db, { presenceId: p.id, atmosphere: 4, worthIt: 4, returnIntent: true });
}

console.log('\n[verdict · rating platform slice 1]');

// --- §2.2 eligibility is structural ---
const evA = await mkEvent('Verdict A');
const fanClaimOnly = await uuid();
await createClaim(db, { eventId: evA, fanId: fanClaimOnly, capacity: 100, mode: 'open', priceCents: 0 }); // claimed, never scanned
const e0 = await verdictEligibility(db, evA, fanClaimOnly);
ok('a fan who claimed but was never scanned in cannot rate (repo)', e0.canVerdict === false && e0.presenceId === null);
ok('createVerdict refuses a presence that does not exist', (await createVerdict(db, { presenceId: fanClaimOnly, atmosphere: 5, worthIt: 5, returnIntent: true })).ok === false);

const fanA = await uuid();
const presA = await scanIn(evA, fanA);
const v1 = await createVerdict(db, { presenceId: presA, atmosphere: 99, worthIt: 0, returnIntent: true, note: 'loud and great' });
ok('a scanned-in fan can leave a verdict', v1.ok === true);
const row = (await db.query<{ atmosphere: number; worth_it: number; source: string }>(`SELECT atmosphere, worth_it, source FROM verdict WHERE presence_id=$1`, [presA])).rows[0];
ok('scores clamp server-side (99→5, 0→1)', row.atmosphere === 5 && row.worth_it === 1);
ok('the verdict is source-tagged horda', row.source === 'horda');
const v2 = await createVerdict(db, { presenceId: presA, atmosphere: 3, worthIt: 3, returnIntent: false });
ok('one verdict per presence', v2.ok === false && (v2 as any).reason === 'already');

// --- §3.5 the public floor: ≥5 verdicts AND ≥20% of presences ---
ok('room score is suppressed below 5 verdicts', (await roomScore(db, evA)) === null);
await bulkPresences(evA, 4); // presences now 5 (presA + 4)
await addVerdicts(evA, 4);   // verdicts now 5 (100% response)
const rsA = await roomScore(db, evA);
ok('room score shows once the floor clears (≥5 verdicts, ≥20%)', rsA !== null && rsA.verdicts >= 5);

const evB = await mkEvent('Verdict B');
await bulkPresences(evB, 30);
await addVerdicts(evB, 5);   // 5 verdicts / 30 presences = 17% → below the 20% floor
ok('room score is suppressed below 20% of the room', (await roomScore(db, evB)) === null);
await addVerdicts(evB, 1);   // 6 / 30 = 20% → clears
ok('room score shows once 20% of the room has spoken', (await roomScore(db, evB)) !== null);

// --- §2.1 organiser sees the note; the public number never does ---
const rep = await eventReport(db, evA);
ok('the organiser report carries verbatim notes', rep.notes.some(n => n.note === 'loud and great'));
ok('the organiser report computes response + no-show rates', typeof rep.responseRate === 'number' && typeof rep.noShowRate === 'number');
ok('the PUBLIC room-score block carries no note text', !roomScoreBlock(rsA!).includes('loud and great'));

// --- HTTP side: the same guarantee at the route ---
const evH = await mkEvent('Verdict HTTP');
const refused = await fetch(`${base}/e/${evH}/verdict`, post({ atmosphere: '4', worth_it: '4', return_intent: '1' }));
ok('POST a verdict without a presence is refused (HTTP 403)', refused.status === 403);
await scanIn(evH, app.ids.fanId); // the demo viewer is now scanned in
const done = await fetch(`${base}/e/${evH}/verdict`, post({ atmosphere: '5', worth_it: '4', return_intent: '1', note: 'x' }));
const doneBody = await done.text();
ok('POST a verdict as a scanned-in fan records it (HTTP)', done.status === 200 && doneBody.includes('Verdict in'));
ok('the same fan is blocked from a second verdict', (await (await fetch(`${base}/e/${evH}/verdict`)).text()).includes('already left'));
// and the public event page never leaks the private note
ok('the note never appears on the public event page', !(await (await fetch(`${base}/e/${evH}?guest=1`)).text()).includes('>x<'));

await app.close();
console.log(`\n──────── verdict: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
