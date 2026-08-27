// demo.ts — the whole product, end to end: a paste becomes a finished club page.
// Run: node examples/demo.ts   ->  writes furia-club-page.html
import { writeFileSync } from 'node:fs';
import { ingestUserUpload } from '../src/pipeline/index.ts';
import type { KnownEntity } from '../src/pipeline/index.ts';
import { buildClubPage } from '../src/read/build.ts';
import { renderClubPage } from '../src/read/render.ts';
import type { StandingDef } from '../src/engines/types.ts';

// What a club admin would have on hand (their teams + regular opponents).
const known: KnownEntity[] = [
  { id: 't-fcb', name: 'FC Beispiel' },
  { id: 't-tsv', name: 'TSV Musterstadt' },
  { id: 't-sve', name: 'SV Example', aliases: ['SV Example 1919'] },
  { id: 't-spv', name: 'SpVgg Altdorf' },
  { id: 't-bsc', name: 'Berliner SC' },
];

// What they paste — straight out of a WhatsApp group, messy.
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

const results = ingestUserUpload({ text: resultsText, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });
const fixtures = ingestUserUpload({ text: fixturesText, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });

const standing: StandingDef = {
  name: 'League table', unit: 'team', engine: 'points_table', scope: 'season',
  config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] },
};

const model = buildClubPage({
  resultsStaged: results.staged,
  fixturesStaged: fixtures.staged,
  focusClubId: 't-fcb',
  labelOf: Object.fromEntries(known.map(k => [k.id, k.name])),
  standing,
});

console.log(`\n${model.clubName} — record ${model.record.wins}W ${model.record.draws}D ${model.record.losses}L`);
console.log(`league table: ${model.table.map(t => `${t.rank}.${t.team}(${t.points})`).join('  ')}`);
console.log(`form: ${model.form.map(f => f.headline).join('  |  ')}`);
console.log(`upcoming: ${model.upcoming.map(u => `${u.venue.toUpperCase()} ${u.opponent} ${u.date ?? ''}`).join('  |  ')}`);

const html = renderClubPage(model);
writeFileSync('furia-club-page.html', html);
console.log(`\nWrote furia-club-page.html (${html.length} bytes) — ${results.readyCount} results + ${fixtures.readyCount} fixtures ingested.`);
