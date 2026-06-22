// time_leaderboard.ts — triathlon/road race finishers ranked by finish time.
// Reads detail.finish_time (seconds; the variant_result_field unit is 's').
import type { ResultRow, StandingEngine, StandingRow } from './types.ts';
import { label } from './types.ts';

const secs = (r: ResultRow): number | null => {
  const v = (r.detail as any).finish_time;
  return v == null ? null : Number(v);
};

export const timeLeaderboard: StandingEngine = {
  key: 'time_leaderboard',
  compute({ standing, results, ctx }) {
    const asc = (standing.config?.order ?? 'asc') === 'asc';

    const finishers = results
      .filter(r => r.outcome === 'finished' && secs(r) != null)
      .map(r => ({ id: r.participantId, t: secs(r)! }));
    finishers.sort((a, b) => (asc ? a.t - b.t : b.t - a.t));

    const rows: StandingRow[] = finishers.map((f, i) => ({
      rank: i + 1, unitId: f.id, label: label(ctx, f.id), timeMs: Math.round(f.t * 1000),
      meta: { finish_time_s: f.t },
    }));

    // DNF/DNS listed after finishers, unranked.
    for (const r of results) {
      if (r.outcome === 'dnf' || r.outcome === 'dns') {
        rows.push({ rank: 0, unitId: r.participantId, label: label(ctx, r.participantId), meta: { status: r.outcome } });
      }
    }
    return rows;
  },
};
