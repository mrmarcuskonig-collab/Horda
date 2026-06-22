// build.ts — assemble fan-facing read models from ingested events.
// ingest (slice 3) -> engines (slice 2) -> this. One paste becomes a finished page.
import type { StagedEvent } from '../pipeline/types.ts';
import { computeStanding } from '../engines/index.ts';
import { summarize } from '../engines/summarize.ts';
import type { ResultRow, StandingDef } from '../engines/types.ts';
import type { ClubPageModel, TableRow, FormItem, UpcomingItem, FeedItem } from './types.ts';

const DASH = '–';
const byDateDesc = (a?: string, b?: string) => (b ?? '').localeCompare(a ?? '');
const byDateAsc  = (a?: string, b?: string) => (a ?? '￿').localeCompare(b ?? '￿');

export interface BuildArgs {
  resultsStaged: StagedEvent[];
  fixturesStaged: StagedEvent[];
  focusClubId: string;
  labelOf: Record<string, string>;
  standing: StandingDef;
}

export function buildClubPage(a: BuildArgs): ClubPageModel {
  const name = (id: string | null) => (id && a.labelOf[id]) || '(unknown)';

  // ---- league table (reuses the slice-2 engine) ----
  const rows: ResultRow[] = [];
  a.resultsStaged.forEach((s, i) => {
    for (const d of s.spine ?? []) {
      if (!d.participantId) continue; // unresolved sides don't pollute the table
      rows.push({ eventId: `e${i}`, participantId: d.participantId, participantType: 'team', outcome: d.outcome, detail: d.detail });
    }
  });
  const standing = computeStanding(a.standing, rows, { labelOf: a.labelOf });
  const table: TableRow[] = standing.map(r => ({
    rank: r.rank, teamId: r.unitId, team: r.label ?? r.unitId,
    played: r.played ?? 0, wins: r.wins ?? 0, draws: r.draws ?? 0, losses: r.losses ?? 0,
    goalsFor: r.goalsFor ?? 0, goalsAgainst: r.goalsAgainst ?? 0, goalDiff: r.goalDiff ?? 0, points: r.points ?? 0,
  }));

  // ---- focus club's form (with headlines) ----
  const form: FormItem[] = [];
  for (const s of a.resultsStaged) {
    const isHome = s.home.matchId === a.focusClubId;
    const isAway = s.away.matchId === a.focusClubId;
    if (!isHome && !isAway) continue;
    const me = isHome ? s.home : s.away;
    const opp = isHome ? s.away : s.home;
    const myScore = isHome ? s.homeScore! : s.awayScore!;
    const oppScore = isHome ? s.awayScore! : s.homeScore!;
    const outcome = myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
    const myRow: ResultRow = { eventId: 'f', participantId: me.matchId!, participantType: 'team', outcome, detail: { score: myScore } };
    const oppRow: ResultRow = { eventId: 'f', participantId: opp.matchId ?? 'opp', participantType: 'team', outcome: 'loss', detail: { score: oppScore } };
    const headline = summarize(myRow, { shape: 'matchup', labelOf: a.labelOf, opponentOf: () => oppRow });
    form.push({ date: s.date, outcome, headline, scoreline: `${myScore}${DASH}${oppScore}` });
  }
  form.sort((x, y) => byDateDesc(x.date, y.date));

  // ---- upcoming fixtures for the focus club ----
  const upcoming: UpcomingItem[] = a.fixturesStaged
    .filter(s => s.home.matchId === a.focusClubId || s.away.matchId === a.focusClubId)
    .map(s => {
      const home = s.home.matchId === a.focusClubId;
      const opp = home ? s.away : s.home;
      return { date: s.date, time: s.time, opponent: opp.matchName ?? opp.input, venue: home ? 'home' as const : 'away' as const, confidence: s.confidence };
    })
    .sort((x, y) => byDateAsc(x.date, y.date));

  // ---- coverage feed (results + fixtures, newest first) ----
  const feed: FeedItem[] = [
    ...a.resultsStaged.map(s => ({
      kind: 'result' as const, date: s.date,
      headline: `${name(s.home.matchId)} ${s.homeScore}${DASH}${s.awayScore} ${name(s.away.matchId)}`,
      sub: 'Full time',
    })),
    ...a.fixturesStaged.map(s => ({
      kind: 'fixture' as const, date: s.date,
      headline: `${name(s.home.matchId)} vs ${name(s.away.matchId)}`,
      sub: [s.date, s.time].filter(Boolean).join(' · ') || 'Upcoming',
    })),
  ].sort((x, y) => byDateDesc(x.date, y.date));

  const focusRow = table.find(t => t.teamId === a.focusClubId);
  return {
    clubId: a.focusClubId,
    clubName: name(a.focusClubId),
    record: { wins: focusRow?.wins ?? 0, draws: focusRow?.draws ?? 0, losses: focusRow?.losses ?? 0 },
    table, form, upcoming, feed,
    provenance: { source: 'ingested', generatedAt: new Date().toISOString(), note: 'Auto-generated from uploaded results & fixtures.' },
  };
}
