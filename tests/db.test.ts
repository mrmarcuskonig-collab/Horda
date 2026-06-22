// db.test.ts — the persistent app, end to end, against real Postgres (PGlite).
// Paste -> ingest -> COMMIT to DB -> read the club page back OUT of the DB.
// Plus runtime invariant checks (the verification owed since slice 1).
// Run: node tests/db.test.ts
import { PGliteDatabase, applySchema } from '../src/db/index.ts';
import { getOrCreateSport, getOrCreateVariant, createClubWithTeam, commitResults, commitFixtures, getClubPage } from '../src/db/repo.ts';
import { ingestUserUpload } from '../src/pipeline/index.ts';
import type { KnownEntity } from '../src/pipeline/index.ts';
import type { StandingDef } from '../src/engines/types.ts';

let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}` + (ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};
const expectThrows = async (n: string, fn: () => Promise<unknown>) => {
  try { await fn(); console.log(`  FAIL  ${n} (expected a constraint violation, got none)`); fail++; }
  catch { console.log(`  PASS  ${n}`); pass++; }
};

const db = await PGliteDatabase.open();
const files = await applySchema(db);
console.log(`\n[db] applied ${files.length} migrations on ${(await db.query('select version()')).rows[0].version.split(',')[0]}`);

const sportId = await getOrCreateSport(db, 'football', 'Football');
const variantId = await getOrCreateVariant(db, sportId, '11_a_side', '11-a-side', 'team', 'matchup');

const names = ['FC Beispiel', 'TSV Musterstadt', 'SV Example', 'SpVgg Altdorf', 'Berliner SC'];
const ids: Record<string, string> = {};
for (const n of names) ids[n] = (await createClubWithTeam(db, n, sportId)).teamId;
const known: KnownEntity[] = names.map(n => ({ id: ids[n], name: n }));

const resultsText = `
FC Beispiel 3-1 TSV Musterstadt
SV Example 2:2 FC Beispiel
SpVgg Altdorf 0-4 FC Beispiel
Berliner SC 1-3 FC Beispiel
TSV Musterstadt 1-1 SV Example
SpVgg Altdorf 2-2 Berliner SC
`;
const fixturesText = `
Sa 21.06. 15:00 FC Beispiel – TSV Musterstadt
28.06 FC Beispiel vs SV Example 14:30
So 05.07. Berliner SC - FC Beispiel 16:00
`;

const rRep = ingestUserUpload({ text: resultsText, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });
const fRep = ingestUserUpload({ text: fixturesText, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });

console.log('\n[db · commit] paste -> persisted rows');
eq('committed 6 results', await commitResults(db, rRep, sportId, variantId), 6);
eq('committed 3 fixtures', await commitFixtures(db, fRep, sportId, variantId), 3);
eq('result spine rows persisted', (await db.query(`SELECT count(*)::int n FROM result`)).rows[0].n, 12);
eq('events persisted (6 results + 3 fixtures)', (await db.query(`SELECT count(*)::int n FROM event`)).rows[0].n, 9);
eq('every result tagged source=ingested', (await db.query(`SELECT count(*)::int n FROM result WHERE source<>'ingested'`)).rows[0].n, 0);

console.log('\n[db · read] club page assembled FROM the database');
const standing: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season', config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };
const page = await getClubPage(db, ids['FC Beispiel'], standing);
console.table(page.table.map(t => ({ '#': t.rank, team: t.team, P: t.played, Pts: t.points, GD: t.goalDiff })));
eq('record read from DB: 3W 1D 0L', [page.record.wins, page.record.draws, page.record.losses], [3, 1, 0]);
eq('table top is FC Beispiel on 10 pts', [page.table[0].team, page.table[0].points], ['FC Beispiel', 10]);
eq('4 form items for the club', page.form.length, 4);
eq('3 upcoming fixtures', page.upcoming.length, 3);

console.log('\n[db · invariants enforced at runtime]');
await expectThrows('athlete with source=ingested is rejected (persons self-create)', () =>
  db.query(`INSERT INTO athlete (display_name,source) VALUES ('Should Fail','ingested')`));
await expectThrows('league minted without a governing body is rejected', () =>
  db.query(`INSERT INTO league (name,sport_id,variant_id,creator_type) VALUES ('Rogue League',$1,$2,'league')`, [sportId, variantId]));

// positive: the open_join policy flag auto-accepts via the trigger
const ath = (await db.query<{ id: string }>(`INSERT INTO athlete (display_name) VALUES ('Lukas') RETURNING id`)).rows[0].id;
await db.query(`INSERT INTO relationship_link (kind,a_type,a_id,b_type,b_id,policy) VALUES ('roster_membership','athlete',$1,'team',$2,'open_join')`, [ath, ids['FC Beispiel']]);
eq('open_join roster link auto-accepted by trigger', (await db.query<{ state: string }>(`SELECT state FROM relationship_link LIMIT 1`)).rows[0].state, 'accepted');

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
