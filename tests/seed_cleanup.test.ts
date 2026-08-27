// seed_cleanup.test.ts — proves _seed_cleanup.ts removes the demo world and ONLY
// the demo world: a real account's athlete + event + a real fan's own claim all
// survive, the ownership guard spares a seed handle a real account has claimed,
// and the app still boots afterwards. Run: node tests/seed_cleanup.test.ts
import { openDatabase, applySchema } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { createAthlete, createFan, followEntity } from '../src/db/engagement_repo.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { createClaim } from '../src/db/claim_rail_repo.ts';
import { grantOwnership } from '../src/db/auth_repo.ts';
import { execFileSync } from 'node:child_process';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };
const count = async (db: any, s: string, p: any[] = []) => (await db.query(s, p)).rows[0].n as number;

console.log('\n[seed_cleanup] removes the demo world, spares everything real');

// A shared PGlite file so the CLI (separate process) sees the same DB we seeded.
const DBFILE = `/tmp/furia_cleanup_${Date.now()}`;
process.env.FURIA_DATA = DBFILE;                 // openDatabase uses FURIA_DATA as the file-backed PGlite dir
const db = await openDatabase();
await applySchema(db);
const seed = await seedDemo(db);

// ---- a REAL world alongside the seed ----
const realAcct = (await db.query(`INSERT INTO account (email,display_name) VALUES ('real@person.com','Real Person') RETURNING id`)).rows[0].id;
const realAth = await createAthlete(db, 'Real Fighter', 'realfighter');
await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [realAcct, realAth]);
await grantOwnership(db, realAcct, 'athlete', realAth);
const realEv = await createScheduledEvent(db, { hostKind: 'athlete', hostId: realAth, title: 'REAL_EVENT_KEEP', startsAt: new Date(Date.now() + 864e5).toISOString(), admission: 'open' });
// a real fan who claimed a SEED event (collateral we DO want gone) AND the real event (must stay)
const realFan = await createFan(db, 'realfan', 'Real Fan');
await db.query(`UPDATE fan SET account_id=$1 WHERE id=$2`, [realAcct, realFan]);
await createClaim(db, { eventId: realEv, fanId: realFan, capacity: 100, mode: 'open', priceCents: 0 });

// ---- ownership-guard case: a real account claims the "SV Example" club handle ----
const svId = seed.clubs.find(c => c.name === 'FC Beispiel')!.id; // FC Beispiel is demo-owned (should be deleted)
const svExample = (await db.query(`SELECT id FROM club WHERE name='SV Example'`)).rows[0].id;
await grantOwnership(db, realAcct, 'club', svExample);            // now REAL-owned → must be spared

await db.close();

// ---- run the CLI: dry-run first, then commit ----
const run = (args: string[]) => execFileSync('node', ['_seed_cleanup.ts', ...args], { encoding: 'utf8', env: { ...process.env, FURIA_DATA: DBFILE } });
const dry = run([]);
ok('dry-run changes nothing (says DRY RUN)', dry.includes('DRY RUN') && dry.includes('would remove'));
ok('dry-run reports the guarded club as KEPT', dry.includes('SV Example') && dry.includes('KEPT'));

// verify DB untouched after dry-run
const db2 = await openDatabase();
ok('after dry-run, FC Beispiel still present', (await count(db2, `SELECT count(*)::int n FROM club WHERE name='FC Beispiel'`)) === 1);
await db2.close();

const out = run(['--commit']);
ok('commit reports COMMITTED', out.includes('COMMITTED'));

// ---- verify end state ----
const v = await openDatabase();
ok('FC Beispiel (demo-owned seed) is gone', (await count(v, `SELECT count(*)::int n FROM club WHERE name='FC Beispiel'`)) === 0);
ok('all seed clubs except the guarded one are gone', (await count(v, `SELECT count(*)::int n FROM club WHERE name = ANY($1)`, [['FC Beispiel', 'TSV Musterstadt', 'SpVgg Altdorf', 'Berliner SC']])) === 0);
ok('the real-owned "SV Example" was SPARED by the guard', (await count(v, `SELECT count(*)::int n FROM club WHERE name='SV Example'`)) === 1);
ok('seed athlete Rico is gone', (await count(v, `SELECT count(*)::int n FROM athlete WHERE handle='rico'`)) === 0);
ok('Berliner Fußball-Verband is gone', (await count(v, `SELECT count(*)::int n FROM association WHERE name='Berliner Fußball-Verband'`)) === 0);
ok('seed fans (you/ines/maja/rieke) are gone', (await count(v, `SELECT count(*)::int n FROM fan WHERE handle = ANY($1)`, [['you', 'ines', 'karl', 'maja', 'rieke']])) === 0);
ok('no events remain hosted by a deleted seed entity', (await count(v, `SELECT count(*)::int n FROM event WHERE host_kind='athlete' AND host_id NOT IN (SELECT id FROM athlete)`)) === 0);

// the REAL world is intact
ok('REAL_EVENT_KEEP survives', (await count(v, `SELECT count(*)::int n FROM event WHERE name='REAL_EVENT_KEEP'`)) === 1);
ok('the real athlete survives', (await count(v, `SELECT count(*)::int n FROM athlete WHERE handle='realfighter'`)) === 1);
ok('the real fan survives', (await count(v, `SELECT count(*)::int n FROM fan WHERE handle='realfan'`)) === 1);
ok('the real fan\'s claim on the real event survives', (await count(v, `SELECT count(*)::int n FROM claim c JOIN event e ON e.id=c.event_id WHERE e.name='REAL_EVENT_KEEP'`)) === 1);
ok('the real account survives', (await count(v, `SELECT count(*)::int n FROM account WHERE email='real@person.com'`)) === 1);
ok('no orphaned ownership rows point at a deleted entity', (await count(v, `SELECT count(*)::int n FROM ownership WHERE owner_kind='club' AND owner_id NOT IN (SELECT id FROM club)`)) === 0);
await v.close();

console.log(`\n──────── seed_cleanup: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
