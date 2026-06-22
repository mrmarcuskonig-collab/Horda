// summarize.ts — the spine -> headline seam. Turns a validated result row into
// the precomputed `headline` the feed/profile/notifications render. Deterministic
// and factual only: it formats real data, it never invents a stat or a voice
// (spec §4 — "infrastructure and curation, never fake personality").
import type { ResultRow } from './types.ts';

export interface SummarizeCtx {
  shape: 'matchup' | 'field';
  labelOf?: Record<string, string>;
  // for matchups: the opponent row in the same event
  opponentOf?: (r: ResultRow) => ResultRow | undefined;
}

const name = (ctx: SummarizeCtx, id: string) => ctx.labelOf?.[id] ?? id;
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60), sec = (s % 60).toFixed(0).padStart(2, '0');
  const h = Math.floor(m / 60), mm = (m % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${sec}` : `${m}:${sec}`;
};

export function summarize(r: ResultRow, ctx: SummarizeCtx): string {
  const me = name(ctx, r.participantId);
  if (ctx.shape === 'matchup') {
    const opp = ctx.opponentOf?.(r);
    const them = opp ? name(ctx, opp.participantId) : 'TBD';
    const myScore = (r.detail as any).score;
    const oppScore = opp ? (opp.detail as any).score : undefined;
    if (myScore != null && oppScore != null) {
      const verb = r.outcome === 'win' ? 'beat' : r.outcome === 'loss' ? 'lost to' : 'drew with';
      return `${me} ${verb} ${them} ${myScore}–${oppScore}`;
    }
    const method = (r.detail as any).method;
    if (method) {
      const round = (r.detail as any).round;
      const tail = round ? ` (R${round})` : '';
      if (r.outcome === 'win') return `${me} def. ${them} by ${method}${tail}`;
      if (r.outcome === 'loss') return `${me} lost to ${them} by ${method}${tail}`;
      return `${me} vs ${them}: ${method}${tail}`;
    }
    return `${me} vs ${them}`;
  }
  // field
  const t = (r.detail as any).finish_time;
  if (r.outcome === 'finished' && t != null) {
    const place = r.rank ? ` — P${r.rank}` : '';
    return `${me} finished in ${fmtTime(Number(t))}${place}`;
  }
  if (r.outcome === 'dnf') return `${me} did not finish`;
  if (r.outcome === 'dns') return `${me} did not start`;
  return `${me} — result recorded`;
}
