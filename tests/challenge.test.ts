// challenge.test.ts — attendance challenges: Furia is the eligibility ledger.
//   * a challenge links to SPECIFIC events (challenge_event); progress = distinct
//     LINKED events a fan verifiably attended — an attended-but-unlinked event
//     does NOT count
//   * qualifiers = fans at/above the threshold (the list the issuer fulfils)
//   * the qualifier export is owner-gated
//   * the fan-facing hero strip (Option C) renders on the issuer's page
// Run: node tests/challenge.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { ownedEntities } from '../src/db/auth_repo.ts';
import { createChallenge, progressFor, qualifiers, listChallengesForHost, getChallengeEvents } from '../src/db/challenge_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const uuid = async () => (await db.query<{ id: string }>(`SELECT gen_random_uuid() id`)).rows[0].id;
const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
async function attend(eventId: string, fanId: string) {
  const c = (await db.query<{ id: string }>(`INSERT INTO claim (event_id, fan_id, status) VALUES ($1,$2,'verified') RETURNING id`, [eventId, fanId])).rows[0].id;
  await db.query(`INSERT INTO presence (claim_id, fan_id, event_id, fidelity) VALUES ($1,$2,$3,'in_room')`, [c, fanId, eventId]);
}

console.log('\n[challenge · attendance eligibility ledger]');

const club = (await db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
// three events the challenge links, one it deliberately does NOT link
const e1 = await createScheduledEvent(db, { hostKind: 'club', hostId: club, title: 'Game 1', startsAt: days(-5), admission: 'open' });
const e2 = await createScheduledEvent(db, { hostKind: 'club', hostId: club, title: 'Game 2', startsAt: days(-3), admission: 'open' });
const e3 = await createScheduledEvent(db, { hostKind: 'club', hostId: club, title: 'Game 3', startsAt: days(-1), admission: 'open' });
const eOther = await createScheduledEvent(db, { hostKind: 'club', hostId: club, title: 'Friendly', startsAt: days(-2), admission: 'open' });

const fanA = await uuid(), fanB = await uuid();
await attend(e1, fanA); await attend(e2, fanA); await attend(eOther, fanA);   // 2 linked + 1 unlinked
await attend(e1, fanB);                                                       // 1 linked

// links e1,e2,e3 — NOT eOther
const cid = await createChallenge(db, { issuerKind: 'club', issuerId: club, title: 'Come to 2 games', threshold: 2, eventIds: [e1, e2, e3], rewardText: '20% off merch' });

ok('the challenge links exactly the chosen events', (await getChallengeEvents(db, cid)).length === 3);

const pa = await progressFor(db, cid, fanA);
ok('a fan who attended 2 LINKED games has met the threshold', pa!.count === 2 && pa!.met === true);
ok('an attended-but-UNLINKED game does NOT count', pa!.count === 2);   // eOther excluded
const pb = await progressFor(db, cid, fanB);
ok('a fan with 1 has not met it', pb!.count === 1 && pb!.met === false);

const q = await qualifiers(db, cid);
ok('qualifiers lists the fan who met it', q.length === 1 && q[0].fanId === fanA && q[0].count === 2);
ok('qualifiers excludes the fan below threshold', !q.find(x => x.fanId === fanB));

// --- HTTP: owner creates + exports; the export is owner-gated ---
const owned = (await ownedEntities(db, app.ids.demoAccountId)).find(e => e.kind === 'club');
ok('demo account owns a club (fixture)', !!owned);
const oc = owned!.id;
const oe1 = await createScheduledEvent(db, { hostKind: 'club', hostId: oc, title: 'Owned home game', startsAt: days(-4), admission: 'open' });
const page = await (await fetch(`${base}/c/club/${oc}`)).text();
ok('the challenges page renders for the owned club', page.includes('Challenges'));
ok('…and offers the owner an event to link', page.includes('Owned home game'));
const created = await fetch(`${base}/c/club/${oc}`, post({ title: 'Home hero', threshold: '3', reward: 'A scarf', ['ev_' + oe1]: 'on' }));
ok('owner can create a challenge (redirect)', created.status === 303 || created.status === 302);
const stored = (await listChallengesForHost(db, 'club', oc)).find(c => c.title === 'Home hero');
ok('…and it is stored', !!stored);
ok('…with its linked event', !!stored && (await getChallengeEvents(db, stored!.id)).some(e => e.id === oe1));

// --- the fan-facing hero strip (Option C) shows on the issuer's page ---
const clubPage = await (await fetch(`${base}/club/${oc}`)).text();
ok('the club page surfaces the challenge in a hero strip', clubPage.includes('Home hero') && clubPage.includes('/c/club/' + oc));

const mine = stored!.id;
const csv = await fetch(`${base}/c/club/${oc}/${mine}/qualifiers.csv`, { redirect: 'manual' });
ok('owner can export the qualifier CSV', csv.status === 200 && (csv.headers.get('content-type') || '').includes('text/csv'));

const notMine = (await db.query<{ id: string }>(`SELECT id FROM club WHERE id<>$1 LIMIT 1`, [oc])).rows[0].id;
const blocked = await fetch(`${base}/c/club/${notMine}/${mine}/qualifiers.csv`, { redirect: 'manual' });
ok('a non-owner cannot export (redirected, not 200)', blocked.status !== 200);

await app.close();
console.log(`\n──────── challenge: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
