// team_aggregate.ts — Boxstall (gym) team table from INDIVIDUAL bouts.
// Same two-axis proof as series_points: result_participant 'individual',
// standing.unit 'team'. A team's score aggregates its members' bout outcomes.
import type { StandingEngine, StandingRow } from './types.ts';
import { label } from './types.ts';

export const teamAggregate: StandingEngine = {
  key: 'team_aggregate',
  compute({ standing, results, ctx }) {
    const mode = standing.config?.aggregate ?? 'bout_wins';
    const teamOf = ctx.teamOf ?? {};

    const acc = new Map<string, { wins: number; bouts: number; draws: number; members: Set<string> }>();
    const ensure = (id: string) =>
      acc.get(id) ?? acc.set(id, { wins: 0, bouts: 0, draws: 0, members: new Set() }).get(id)!;

    for (const r of results) {
      const team = teamOf[r.participantId];
      if (!team) continue;
      const a = ensure(team);
      a.members.add(r.participantId);
      if (r.outcome === 'win' || r.outcome === 'loss' || r.outcome === 'draw') a.bouts++;
      if (r.outcome === 'win') a.wins++;
      if (r.outcome === 'draw') a.draws++;
    }

    const score = (a: { wins: number; draws: number }) =>
      mode === 'bout_points' ? a.wins * 2 + a.draws : a.wins; // default 'bout_wins'

    const rows: StandingRow[] = [...acc.entries()].map(([team, a]) => ({
      rank: 0, unitId: team, label: label(ctx, team),
      points: score(a), wins: a.wins, draws: a.draws, played: a.bouts,
      meta: { boxers: a.members.size, mode },
    }));
    rows.sort((p, q) => (q.points! - p.points!) || (q.wins! - p.wins!));
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  },
};
