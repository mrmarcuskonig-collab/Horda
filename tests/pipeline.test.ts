// pipeline.test.ts — user-upload extract -> map -> resolve -> stage,
// then the extracted results flow into the standings engine to build a table.
// Run: node tests/pipeline.test.ts
import { ingestUserUpload, similarity, resolveEntity } from '../src/pipeline/index.ts';
import type { KnownEntity } from '../src/pipeline/index.ts';
import { computeStanding } from '../src/engines/index.ts';
import type { ResultRow, StandingDef } from '../src/engines/types.ts';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}` + (ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

// The uploading club's known universe (its teams + regular opponents).
const known: KnownEntity[] = [
  { id: 't-fcb', name: 'FC Beispiel' },
  { id: 't-tsv', name: 'TSV Musterstadt' },
  { id: 't-sve', name: 'SV Example', aliases: ['SV Example 1919'] },
  { id: 't-spv', name: 'SpVgg Altdorf' },
];

// ---------------------------------------------------- FIXTURES (messy paste)
console.log('\n[user upload · fixtures]  pasted WhatsApp-style schedule');
{
  const text = `
Sa 21.09. 15:00 FC Beispiel – TSV Musterstadt
28.09 FC Beispiel vs SV Example 14:30
So 05.10. SpVgg Altdorf - FC Beispiel 16:00
12.10. FC Beispiel gegen FC Unbekannt 15:30
`;
  const rep = ingestUserUpload({ text, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });
  console.table(rep.staged.map(s => ({
    date: s.date, time: s.time,
    home: `${s.home.input}→${s.home.matchName ?? '(new)'}`,
    away: `${s.away.input}→${s.away.matchName ?? '(new)'}`,
    conf: s.confidence.toFixed(2), status: s.status,
  })));
  eq('4 fixtures extracted', rep.staged.length, 4);
  eq('first fixture date parsed (year defaults to current)', rep.staged[0].date?.endsWith('-09-21'), true);
  eq('first fixture time parsed', rep.staged[0].time, '15:00');
  eq('home name has no stray date dot', rep.staged[0].home.input, 'FC Beispiel');
  eq('home auto-links to FC Beispiel', [rep.staged[0].home.matchId, rep.staged[0].home.decision], ['t-fcb', 'auto']);
  eq('"SV Example" auto-links', rep.staged[1].away.matchId, 't-sve');
  eq('unknown opponent flagged as new', rep.newEntities.includes('FC Unbekannt'), true);
  eq('that fixture needs review', rep.staged[3].status, 'needs_review');
  eq('known fixtures are ready', rep.readyCount, 3);
}

// ---------------------------------------------------- RESULTS -> live table
console.log('\n[user upload · results]  pasted results, then computed into a table');
{
  const text = `
FC Beispiel 3-1 TSV Musterstadt
SV Example 2:2 FC Beispiel
SpVgg Altdorf 0-4 FC Beispiel
TSV Musterstadt 1-1 SV Example
`;
  const rep = ingestUserUpload({ text, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });
  eq('4 results extracted, all ready', [rep.staged.length, rep.readyCount], [4, 4]);
  eq('extractions tagged ingested', rep.staged.every(s => s.source === 'ingested'), true);
  eq('score parsed (3-1)', [rep.staged[0].homeScore, rep.staged[0].awayScore], [3, 1]);
  eq('outcome derived', rep.staged[0].spine!.map(r => r.outcome), ['win', 'loss']);

  // Feed the staged spine straight into the engine (slice 2 + slice 3 together).
  const rows: ResultRow[] = [];
  rep.staged.forEach((s, i) => {
    for (const d of s.spine!) {
      rows.push({ eventId: `r${i}`, participantId: d.participantId!, participantType: 'team', outcome: d.outcome, detail: d.detail });
    }
  });
  const std: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season',
    config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };
  const labelOf = Object.fromEntries(known.map(k => [k.id, k.name]));
  const table = computeStanding(std, rows, { labelOf });
  console.table(table.map(x => ({ '#': x.rank, team: x.label, P: x.played, W: x.wins, D: x.draws, L: x.losses, GF: x.goalsFor, GA: x.goalsAgainst, GD: x.goalDiff, Pts: x.points })));
  eq('FC Beispiel tops the computed table on 7 pts, GD +6', [table[0].unitId, table[0].points, table[0].goalDiff], ['t-fcb', 7, 6]);
}

// ----------------------------------------------------------- fuzzy sanity
console.log('\n[resolution] similarity sanity');
{
  eq('alias resolves to the canonical entity', resolveEntity('SV Example 1919', known).matchId, 't-sve');
  eq('unknown matches weakly', similarity('FC Unbekannt', 'FC Beispiel') < 0.55, true);
  eq('umlaut/diacritics tolerant', similarity('TSV München', 'TSV Muenchen') > 0.8, true);
}

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
