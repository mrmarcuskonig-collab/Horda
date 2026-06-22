// series_points.ts — triathlon Bundesliga TEAM table built from INDIVIDUAL races.
// This is the load-bearing proof of the design: variant.result_participant is
// 'individual' (every result row is one athlete's race), yet the standing.unit
// is 'team'. Individual rows aggregate into a club table with NO new result type.
//
// Scoring model: within each race, athletes earn points by finishing position;
// each team scores its best `score_top_n` athletes that race; season total is
// the sum across races. (spec §3, §3.2 — Triathlon Bundesliga)
import type { ResultRow, StandingEngine, StandingRow } from './types.ts';
import { label } from './types.ts';

export const seriesPoints: StandingEngine = {
  key: 'series_points',
  compute({ standing, results, ctx }) {
    const cfg = standing.config ?? {};
    const topN: number = cfg.score_top_n ?? 4;
    const byRank: number[] | undefined = cfg.points_by_rank;
    const base: number = cfg.base ?? 25;
    const teamOf = ctx.teamOf ?? {};

    const pointsForRank = (rank: number): number =>
      byRank ? (byRank[rank - 1] ?? 0) : Math.max(0, base - (rank - 1));

    // Group finishers per event, rank them (use spine rank or derive from time).
    const byEvent = new Map<string, ResultRow[]>();
    for (const r of results) {
      if (r.outcome !== 'finished') continue;
      if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []);
      byEvent.get(r.eventId)!.push(r);
    }

    const teamTotal = new Map<string, number>();
    const teamAthletes = new Map<string, Set<string>>();

    for (const [, rows] of byEvent) {
      // ensure each finisher has a rank within this event
      const ranked = [...rows].sort((a, b) => {
        const ar = a.rank ?? Number((a.detail as any).finish_time ?? Infinity);
        const br = b.rank ?? Number((b.detail as any).finish_time ?? Infinity);
        return ar - br;
      });
      // per-team points this race
      const perTeam = new Map<string, number[]>();
      ranked.forEach((r, i) => {
        const rank = r.rank ?? i + 1;
        const team = teamOf[r.participantId];
        if (!team) return; // an athlete not scoring for a team (individual-only entry)
        if (!perTeam.has(team)) perTeam.set(team, []);
        perTeam.get(team)!.push(pointsForRank(rank));
        if (!teamAthletes.has(team)) teamAthletes.set(team, new Set());
        teamAthletes.get(team)!.add(r.participantId);
      });
      for (const [team, pts] of perTeam) {
        const best = pts.sort((a, b) => b - a).slice(0, topN).reduce((s, x) => s + x, 0);
        teamTotal.set(team, (teamTotal.get(team) ?? 0) + best);
      }
    }

    const rows: StandingRow[] = [...teamTotal.entries()].map(([team, total]) => ({
      rank: 0, unitId: team, label: label(ctx, team), points: total,
      meta: { scoring_athletes: teamAthletes.get(team)?.size ?? 0, score_top_n: topN },
    }));
    rows.sort((p, q) => (q.points! - p.points!) || (p.label ?? p.unitId).localeCompare(q.label ?? q.unitId));
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  },
};
