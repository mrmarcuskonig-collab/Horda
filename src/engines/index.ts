// index.ts — the engine registry + dispatcher.
// "engines = code": this is the entire code surface. A new VARIANT that reuses
// one of these engines is a data row (no code). Only a genuinely new scoring
// math adds a file here and a value to the standing_engine enum.
import type {
  StandingEngine, StandingEngineKey, StandingDef, ResultRow, StandingContext, StandingRow,
} from './types.ts';
import { pointsTable } from './points_table.ts';
import { winLossRecord } from './win_loss_record.ts';
import { timeLeaderboard } from './time_leaderboard.ts';
import { seriesPoints } from './series_points.ts';
import { teamAggregate } from './team_aggregate.ts';

export const ENGINES: Record<StandingEngineKey, StandingEngine> = {
  points_table: pointsTable,
  win_loss_record: winLossRecord,
  time_leaderboard: timeLeaderboard,
  series_points: seriesPoints,
  team_aggregate: teamAggregate,
};

export function computeStanding(
  standing: StandingDef,
  results: ResultRow[],
  ctx: StandingContext = {},
): StandingRow[] {
  const engine = ENGINES[standing.engine];
  if (!engine) throw new Error(`no engine for "${standing.engine}"`);
  return engine.compute({ standing, results, ctx });
}

export * from './types.ts';
export { summarize } from './summarize.ts';
