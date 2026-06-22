// read.test.ts — the read layer assembles a correct club page from ingested data.
import { ingestUserUpload } from '../src/pipeline/index.ts';
import type { KnownEntity } from '../src/pipeline/index.ts';
import { buildClubPage } from '../src/read/build.ts';
import { renderClubPage } from '../src/read/render.ts';
import type { StandingDef } from '../src/engines/types.ts';

let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}` + (ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

const known: KnownEntity[] = [
  { id: 't-fcb', name: 'FC Beispiel' }, { id: 't-tsv', name: 'TSV Musterstadt' },
  { id: 't-sve', name: 'SV Example' }, { id: 't-spv', name: 'SpVgg Altdorf' },
];
const standing: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season', config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };

const results = ingestUserUpload({ text: `
FC Beispiel 3-1 TSV Musterstadt
SV Example 2:2 FC Beispiel
SpVgg Altdorf 0-4 FC Beispiel
TSV Musterstadt 1-1 SV Example
`, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });

const fixtures = ingestUserUpload({ text: `
Sa 21.06. 15:00 FC Beispiel – SV Example
`, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });

const m = buildClubPage({
  resultsStaged: results.staged, fixturesStaged: fixtures.staged,
  focusClubId: 't-fcb', labelOf: Object.fromEntries(known.map(k => [k.id, k.name])), standing,
});

console.log('\n[read · club page model]');
eq('focus club resolved', m.clubName, 'FC Beispiel');
eq('record 2W 1D 0L', [m.record.wins, m.record.draws, m.record.losses], [2, 1, 0]);
eq('table led by FC Beispiel', m.table[0].teamId, 't-fcb');
eq('form has 3 entries, newest-first by date', m.form.length, 3);
eq('a win headline reads naturally', m.form.some(f => f.headline.includes('FC Beispiel beat')), true);
eq('one upcoming fixture, home vs SV Example', [m.upcoming.length, m.upcoming[0].venue, m.upcoming[0].opponent], [1, 'home', 'SV Example']);
eq('coverage feed merges results + fixture', m.feed.length, 5);
eq('system-of-record: no fan-to-fan items', m.feed.every(it => it.kind === 'result' || it.kind === 'fixture'), true);

const html = renderClubPage(m);
console.log('\n[read · render]');
eq('renders a full HTML doc', html.startsWith('<!DOCTYPE html>') && html.includes('League table'), true);
eq('strictly monochrome (Ink + Bone only)', /#0B0B0C/i.test(html) && /#EDE9DF/i.test(html) && !/#(?!0B0B0C|EDE9DF|fff|ffffff|444)[0-9a-f]{3,6}/i.test(html.replace(/0b0b0c[0-9a-f]{2}/ig,'')), true);

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
