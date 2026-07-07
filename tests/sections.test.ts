// sections.test.ts — per-sport default sections + athlete layout persistence +
// the feature-request channel. Run: node tests/sections.test.ts
import { defaultLayout, resolveLayout, SECTIONS } from '../src/web/sections.ts';
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { getAthleteSport, setAthleteSport, getAthleteLayout, setAthleteLayout, createFeatureRequest } from '../src/db/layout_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[sections · per-sport defaults]');
const box = defaultLayout('boxing');
ok('boxing leads with the W-L-D record (on by default)', box.find(s => s.key === 'record')!.on === true);
ok('football athlete hides the record by default', defaultLayout('football').find(s => s.key === 'record')!.on === false);
ok('every default key has catalog metadata', box.every(s => !!SECTIONS[s.key]));

console.log('\n[sections · resolve saved layout]');
const saved = [{ key: 'events', on: true }, { key: 'record', on: false }, { key: 'bogus', on: true }];
const r = resolveLayout('boxing', saved);
ok('saved order is respected (events first)', r[0].key === 'events');
ok('unknown keys are dropped', !r.find(s => s.key === 'bogus'));
ok('a section turned off stays off', r.find(s => s.key === 'record')!.on === false);
ok('newly-available sections are appended', r.length === defaultLayout('boxing').length);
ok('null saved → sport default', resolveLayout('boxing', null)[0].key === 'record');

console.log('\n[sections · persistence + feature requests]');
const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;
await setAthleteSport(db, rico, 'boxing');
ok('athlete sport persists', (await getAthleteSport(db, rico)) === 'boxing');
ok('layout starts null (uses default)', (await getAthleteLayout(db, rico)) === null);
await setAthleteLayout(db, rico, [{ key: 'events', on: true }, { key: 'record', on: false }]);
const got = await getAthleteLayout(db, rico);
ok('layout saved + reloads in order', !!got && got[0].key === 'events' && got[1].on === false);
await createFeatureRequest(db, ids.demoAccountId, 'boxing', 'athlete-page', 'A sponsors section please');
const fr = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM feature_request WHERE body LIKE 'A sponsors%'`)).rows[0].n;
ok('feature request is stored for the roadmap', fr === 1);
ok('empty feature request is ignored', await (async () => { await createFeatureRequest(db, ids.demoAccountId, null, null, '   '); return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM feature_request`)).rows[0].n === 1; })());

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
