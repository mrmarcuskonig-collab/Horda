// win_loss_record.ts — boxing career ledger (and any W-L-D record standing).
import type { StandingEngine, StandingRow } from './types.ts';
import { label } from './types.ts';

export const winLossRecord: StandingEngine = {
  key: 'win_loss_record',
  compute({ results, ctx }) {
    const rec = new Map<string, { w: number; l: number; d: number; nc: number }>();
    const ensure = (id: string) =>
      rec.get(id) ?? rec.set(id, { w: 0, l: 0, d: 0, nc: 0 }).get(id)!;

    for (const r of results) {
      const a = ensure(r.participantId);
      if (r.outcome === 'win') a.w++;
      else if (r.outcome === 'loss') a.l++;
      else if (r.outcome === 'draw') a.d++;
      else if (r.outcome === 'no_contest') a.nc++;
    }

    const rows: StandingRow[] = [...rec.entries()].map(([id, a]) => ({
      rank: 0, unitId: id, label: label(ctx, id),
      wins: a.w, losses: a.l, draws: a.d,
      played: a.w + a.l + a.d + a.nc,
      meta: { record: `${a.w}-${a.l}-${a.d}`, no_contests: a.nc },
    }));

    // Rank by wins desc, then fewest losses, then more draws.
    rows.sort((p, q) =>
      (q.wins! - p.wins!) || (p.losses! - q.losses!) || (q.draws! - p.draws!));
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  },
};
