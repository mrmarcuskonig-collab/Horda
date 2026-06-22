// trio.test.ts — runs the §3.2 worked example through the real engines.
// Run: node tests/trio.test.ts   (Node 22+, native TypeScript)
import { computeStanding, summarize } from '../src/engines/index.ts';
import type { ResultRow, StandingDef, StandingContext } from '../src/engines/types.ts';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}` + (ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};
const ev = (id: string) => ({ eventId: id });

// ---------------------------------------------------------------- Football
console.log('\n[football · 11-a-side] team · points_table · season  (unit == result_participant)');
{
  const std: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season',
    config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };
  const r: ResultRow[] = [
    { ...ev('m1'), participantId: 'A', participantType: 'team', outcome: 'win',  detail: { score: 2 } },
    { ...ev('m1'), participantId: 'B', participantType: 'team', outcome: 'loss', detail: { score: 1 } },
    { ...ev('m2'), participantId: 'B', participantType: 'team', outcome: 'win',  detail: { score: 3 } },
    { ...ev('m2'), participantId: 'C', participantType: 'team', outcome: 'loss', detail: { score: 0 } },
    { ...ev('m3'), participantId: 'A', participantType: 'team', outcome: 'draw', detail: { score: 1 } },
    { ...ev('m3'), participantId: 'C', participantType: 'team', outcome: 'draw', detail: { score: 1 } },
  ];
  const t = computeStanding(std, r, { labelOf: { A: 'A', B: 'B', C: 'C' } });
  console.table(t.map(x => ({ '#': x.rank, team: x.label, P: x.played, W: x.wins, D: x.draws, L: x.losses, GF: x.goalsFor, GA: x.goalsAgainst, GD: x.goalDiff, Pts: x.points })));
  eq('A top on 4 pts', [t[0].unitId, t[0].points], ['A', 4]);
  eq('B 2nd on 3 pts, GD +2', [t[1].unitId, t[1].points, t[1].goalDiff], ['B', 3, 2]);
  eq('C last on 1 pt', [t[2].unitId, t[2].points], ['C', 1]);
}

// ------------------------------------------------------------------ Boxing
console.log('\n[boxing · bout] individual · win_loss_record · career  (unit == result_participant)');
{
  const std: StandingDef = { name: 'Career record', unit: 'individual', engine: 'win_loss_record', scope: 'career', config: {} };
  const r: ResultRow[] = [
    { ...ev('b1'), participantId: 'X', participantType: 'individual', outcome: 'win',  detail: { method: 'KO', round: 3 } },
    { ...ev('b2'), participantId: 'X', participantType: 'individual', outcome: 'win',  detail: { method: 'UD' } },
    { ...ev('b3'), participantId: 'X', participantType: 'individual', outcome: 'loss', detail: { method: 'TKO', round: 7 } },
    { ...ev('b4'), participantId: 'X', participantType: 'individual', outcome: 'draw', detail: { method: 'Draw' } },
    { ...ev('b5'), participantId: 'Y', participantType: 'individual', outcome: 'win',  detail: { method: 'KO', round: 1 } },
    { ...ev('b6'), participantId: 'Y', participantType: 'individual', outcome: 'loss', detail: { method: 'SD' } },
  ];
  const t = computeStanding(std, r, { labelOf: { X: 'Boxer X', Y: 'Boxer Y' } });
  console.table(t.map(x => ({ '#': x.rank, boxer: x.label, record: (x.meta as any).record })));
  eq('X record 2-1-1', (t.find(x => x.unitId === 'X')!.meta as any).record, '2-1-1');
  eq('headline KO win', summarize(r[0], { shape: 'matchup', labelOf: { X: 'Boxer X' }, opponentOf: () => ({ ...ev('b1'), participantId: 'Z', participantType: 'individual', outcome: 'loss', detail: {} }) }).includes('by KO (R3)'), true);
}

// ---------------------------------------------- Boxing TEAM from individuals
console.log('\n[boxing · Boxstall team] team · team_aggregate · season  *** unit (team) != result_participant (individual) ***');
{
  const std: StandingDef = { name: 'Boxstall table', unit: 'team', engine: 'team_aggregate', scope: 'season', config: { aggregate: 'bout_wins' } };
  const teamOf = { x1: 'G1', x2: 'G1', y1: 'G2', y2: 'G2' };
  const r: ResultRow[] = [
    { ...ev('c1'), participantId: 'x1', participantType: 'individual', outcome: 'win',  detail: {} },
    { ...ev('c2'), participantId: 'x2', participantType: 'individual', outcome: 'win',  detail: {} },
    { ...ev('c3'), participantId: 'y1', participantType: 'individual', outcome: 'win',  detail: {} },
    { ...ev('c4'), participantId: 'y2', participantType: 'individual', outcome: 'loss', detail: {} },
  ];
  const t = computeStanding(std, r, { teamOf, labelOf: { G1: 'Gym G1', G2: 'Gym G2' } });
  console.table(t.map(x => ({ '#': x.rank, gym: x.label, wins: x.wins, boxers: (x.meta as any).boxers })));
  eq('G1 top with 2 member wins', [t[0].unitId, t[0].wins], ['G1', 2]);
  eq('result rows are individuals, standing ranks teams', [r[0].participantType, std.unit], ['individual', 'team']);
}

// ------------------------------------------------------------- Triathlon
console.log('\n[triathlon] individual · time_leaderboard · event  (unit == result_participant)');
{
  const std: StandingDef = { name: 'Finish times', unit: 'individual', engine: 'time_leaderboard', scope: 'event', config: { order: 'asc' } };
  const r: ResultRow[] = [
    { ...ev('t1'), participantId: 'a', participantType: 'individual', outcome: 'finished', detail: { finish_time: 3600 } },
    { ...ev('t1'), participantId: 'b', participantType: 'individual', outcome: 'finished', detail: { finish_time: 3540 } },
    { ...ev('t1'), participantId: 'c', participantType: 'individual', outcome: 'finished', detail: { finish_time: 3700 } },
    { ...ev('t1'), participantId: 'd', participantType: 'individual', outcome: 'dnf',      detail: {} },
  ];
  const t = computeStanding(std, r, { labelOf: { a: 'Ana', b: 'Bo', c: 'Cy', d: 'Di' } });
  console.table(t.map(x => ({ '#': x.rank, athlete: x.label, time_s: (x.meta as any).finish_time_s ?? '—', status: (x.meta as any).status ?? 'finished' })));
  eq('Bo fastest', [t[0].unitId, (t[0].meta as any).finish_time_s], ['b', 3540]);
  eq('DNF unranked', t.find(x => x.unitId === 'd')!.rank, 0);
}

// -------------------------------- Triathlon Bundesliga: TWO standings at once
console.log('\n[triathlon · Bundesliga] individual time_leaderboard  +  TEAM series_points  *** unit (team) != result_participant (individual) ***');
{
  const teamOf = { a1: 'T1', a2: 'T1', a3: 'T1', b1: 'T2', b2: 'T2' };
  const ctx: StandingContext = { teamOf, labelOf: { T1: 'Tri Team 1', T2: 'Tri Team 2', a1: 'a1', a2: 'a2', a3: 'a3', b1: 'b1', b2: 'b2' } };
  const pts = { score_top_n: 2, points_by_rank: [25, 20, 16, 13, 11] };
  // Race R1 order: a1,b1,a2,b2,a3   Race R2 order: a1,a2,b1,b2
  const r: ResultRow[] = [
    { ...ev('R1'), participantId: 'a1', participantType: 'individual', outcome: 'finished', rank: 1, detail: { finish_time: 3500 } },
    { ...ev('R1'), participantId: 'b1', participantType: 'individual', outcome: 'finished', rank: 2, detail: { finish_time: 3520 } },
    { ...ev('R1'), participantId: 'a2', participantType: 'individual', outcome: 'finished', rank: 3, detail: { finish_time: 3540 } },
    { ...ev('R1'), participantId: 'b2', participantType: 'individual', outcome: 'finished', rank: 4, detail: { finish_time: 3560 } },
    { ...ev('R1'), participantId: 'a3', participantType: 'individual', outcome: 'finished', rank: 5, detail: { finish_time: 3580 } },
    { ...ev('R2'), participantId: 'a1', participantType: 'individual', outcome: 'finished', rank: 1, detail: { finish_time: 3490 } },
    { ...ev('R2'), participantId: 'a2', participantType: 'individual', outcome: 'finished', rank: 2, detail: { finish_time: 3510 } },
    { ...ev('R2'), participantId: 'b1', participantType: 'individual', outcome: 'finished', rank: 3, detail: { finish_time: 3530 } },
    { ...ev('R2'), participantId: 'b2', participantType: 'individual', outcome: 'finished', rank: 4, detail: { finish_time: 3550 } },
  ];
  // Standing 1: individual leaderboard (one race)
  const indiv: StandingDef = { name: 'Race finish times', unit: 'individual', engine: 'time_leaderboard', scope: 'event', config: { order: 'asc' } };
  const lead = computeStanding(indiv, r.filter(x => x.eventId === 'R1'), ctx);
  console.log('  individual leaderboard (R1):', lead.map(x => `${x.rank}.${x.label}`).join('  '));

  // Standing 2: TEAM series points — individuals aggregated into a club table
  const team: StandingDef = { name: 'Bundesliga table', unit: 'team', engine: 'series_points', scope: 'series', config: pts };
  const tbl = computeStanding(team, r, ctx);
  console.table(tbl.map(x => ({ '#': x.rank, team: x.label, points: x.points, scorers: (x.meta as any).scoring_athletes })));
  // R1: T1 best2 = 25(a1)+16(a2)=41 ; T2 best2 = 20(b1)+13(b2)=33
  // R2: T1 best2 = 25(a1)+20(a2)=45 ; T2 best2 = 16(b1)+13(b2)=29
  // totals: T1=86, T2=62
  eq('T1 wins the team table on 86', [tbl[0].unitId, tbl[0].points], ['T1', 86]);
  eq('T2 second on 62',             [tbl[1].unitId, tbl[1].points], ['T2', 62]);
  eq('same rows, individual results -> team standing', [r[0].participantType, team.unit], ['individual', 'team']);
}

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
