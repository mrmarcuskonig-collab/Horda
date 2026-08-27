// persist-demo.ts — the persistent app, end to end:
//   paste  ->  ingest  ->  COMMIT to Postgres  ->  read the page back OUT of the DB  ->  render.
// Uses embedded Postgres (PGlite). Pass a dataDir to persist to disk across runs:
//   const db = await PGliteDatabase.open('./.furia-data');   // durable
// Here we use in-memory so it runs cleanly anywhere; the commit/read path is identical.
import { writeFileSync } from 'node:fs';
import { PGliteDatabase, applySchema } from '../src/db/index.ts';
import { getOrCreateSport, getOrCreateVariant, createClubWithTeam, commitResults, commitFixtures, getClubPage } from '../src/db/repo.ts';
import { ingestUserUpload } from '../src/pipeline/index.ts';
import { renderClubPage } from '../src/read/render.ts';
import type { StandingDef } from '../src/engines/types.ts';

const db = await PGliteDatabase.open();
await applySchema(db);

const sportId = await getOrCreateSport(db, 'football', 'Football');
const variantId = await getOrCreateVariant(db, sportId, '11_a_side', '11-a-side', 'team', 'matchup');

const names = ['FC Beispiel', 'TSV Musterstadt', 'SV Example', 'SpVgg Altdorf', 'Berliner SC'];
const ids: Record<string, string> = {};
for (const n of names) ids[n] = (await createClubWithTeam(db, n, sportId)).teamId;
const known = names.map(n => ({ id: ids[n], name: n }));

// the messy paste
const r = ingestUserUpload({ text: `
FC Beispiel 3-1 TSV Musterstadt
SV Example 2:2 FC Beispiel
SpVgg Altdorf 0-4 FC Beispiel
Berliner SC 1-3 FC Beispiel
TSV Musterstadt 1-1 SV Example
SpVgg Altdorf 2-2 Berliner SC`, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });
const f = ingestUserUpload({ text: `
Sa 21.06. 15:00 FC Beispiel – TSV Musterstadt
28.06 FC Beispiel vs SV Example 14:30
So 05.07. Berliner SC - FC Beispiel 16:00`, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });

const nR = await commitResults(db, r, sportId, variantId);
const nF = await commitFixtures(db, f, sportId, variantId);
console.log(`committed to Postgres: ${nR} results, ${nF} fixtures`);

// read the page back OUT of the database (nothing held in memory from above)
const standing: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season', config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };
const page = await getClubPage(db, ids['FC Beispiel'], standing);
console.log(`read from DB -> ${page.clubName}: ${page.record.wins}W ${page.record.draws}D ${page.record.losses}L · top: ${page.table[0].team} (${page.table[0].points} pts)`);

writeFileSync('furia-club-page.html', renderClubPage(page));
console.log('rendered furia-club-page.html from the database.');
await db.close();
