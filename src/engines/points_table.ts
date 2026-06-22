// points_table.ts — football league table (and any W/D/L points competition).
// Consumes matchup spine rows (one per team per event) carrying detail.score.
import type { ResultRow, StandingDef, StandingContext, StandingRow, StandingEngine } from './types.ts';
import { label } from './types.ts';

interface Acc {
  played: number; wins: number; draws: number; losses: number;
  gf: number; ga: number; points: number;
}

export const pointsTable: StandingEngine = {
  key: 'points_table',
  compute({ standing, results, ctx }) {
    const cfg = standing.config ?? {};
    const W = cfg.win ?? 3, D = cfg.draw ?? 1, L = cfg.loss ?? 0;
    const tiebreakers: string[] = cfg.tiebreakers ?? ['goal_diff', 'goals_for'];

    // Pair the two sides of each matchup so goals-against = opponent's goals-for.
    const byEvent = new Map<string, ResultRow[]>();
    for (const r of results) {
      if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
      byEvent.get(r.eventId)!.push(r);
    }

    const table = new Map<string, Acc>();
    const ensure = (id: string) =>
      table.get(id) ?? table.set(id, { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 }).get(id)!;

    for (const [, rows] of byEvent) {
      for (const r of rows) {
        const opp = rows.find(x => x.participantId !== r.participantId);
        const gf = Number((r.detail as any).score ?? 0);
        const ga = Number((opp?.detail as any)?.score ?? 0);
        const a = ensure(r.participantId);
        a.played++; a.gf += gf; a.ga += ga;
        if (r.outcome === 'win') { a.wins++; a.points += W; }
        else if (r.outcome === 'draw') { a.draws++; a.points += D; }
        else if (r.outcome === 'loss') { a.losses++; a.points += L; }
      }
    }

    const head2head = (x: string, y: string): number => {
      // points x took off y minus points y took off x, over their meetings.
      let px = 0, py = 0;
      for (const [, rows] of byEvent) {
        const rx = rows.find(r => r.participantId === x);
        const ry = rows.find(r => r.participantId === y);
        if (rx && ry) {
          if (rx.outcome === 'win') px += W; else if (rx.outcome === 'draw') px += D;
          if (ry.outcome === 'win') py += W; else if (ry.outcome === 'draw') py += D;
        }
      }
      return py - px; // sort desc later, so invert
    };

    const rows: StandingRow[] = [...table.entries()].map(([id, a]) => ({
      rank: 0, unitId: id, label: label(ctx, id),
      played: a.played, wins: a.wins, draws: a.draws, losses: a.losses,
      goalsFor: a.gf, goalsAgainst: a.ga, goalDiff: a.gf - a.ga, points: a.points,
    }));

    rows.sort((p, q) => {
      if (q.points! !== p.points!) return q.points! - p.points!;
      for (const tb of tiebreakers) {
        if (tb === 'goal_diff' && q.goalDiff! !== p.goalDiff!) return q.goalDiff! - p.goalDiff!;
        if (tb === 'goals_for' && q.goalsFor! !== p.goalsFor!) return q.goalsFor! - p.goalsFor!;
        if (tb === 'head_to_head') { const h = head2head(p.unitId, q.unitId); if (h !== 0) return h; }
      }
      return (p.label ?? p.unitId).localeCompare(q.label ?? q.unitId);
    });
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  },
};
