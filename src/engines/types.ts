// types.ts — the contract between catalog data and engine code.
// Mirrors the DB enums/columns. "Catalog = data, engines = code": these types
// are the engine side; the values that drive them come from registry rows.

export type ParticipantUnit = 'individual' | 'team';
export type CompetitionShape = 'matchup' | 'field';
export type StandingEngineKey =
  | 'points_table'
  | 'win_loss_record'
  | 'time_leaderboard'
  | 'series_points'
  | 'team_aggregate';
export type StandingScope = 'season' | 'career' | 'event' | 'series';
export type ResultOutcome =
  | 'win' | 'loss' | 'draw' | 'finished' | 'dnf' | 'dns' | 'no_contest';

// One uniform row per participant — the universal spine (the `result` table).
export interface ResultRow {
  eventId: string;
  participantId: string;            // athlete id or team id
  participantType: ParticipantUnit; // == variant.result_participant
  outcome: ResultOutcome;
  rank?: number | null;             // placement in a field; null for plain matchups
  detail: Record<string, unknown>;  // validated against variant_result_field
}

// A standing definition = a row from variant_standing / template_standing.
// `unit` (what we rank) is deliberately independent of the result's participant
// type — that's what lets an individual sport produce a team table.
export interface StandingDef {
  name: string;
  unit: ParticipantUnit;
  engine: StandingEngineKey;
  scope: StandingScope;
  config: Record<string, any>;
}

// Context the engine may need beyond the raw results — e.g. the map from an
// individual to the team they score for (roster/league membership at event time).
export interface StandingContext {
  // athleteId -> teamId, for individual-result -> team-standing aggregation.
  teamOf?: Record<string, string>;
  // optional display labels
  labelOf?: Record<string, string>;
}

export interface StandingRow {
  rank: number;
  unitId: string;          // the ranked entity (team id or athlete id)
  label?: string;
  // engine-specific payloads (only the relevant ones are populated):
  points?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDiff?: number;
  timeMs?: number;
  meta?: Record<string, unknown>;
}

export interface StandingEngine {
  key: StandingEngineKey;
  // Engines never invent data; they fold spine rows into a ranking.
  compute(input: {
    standing: StandingDef;
    results: ResultRow[];
    ctx: StandingContext;
  }): StandingRow[];
}

export function label(ctx: StandingContext, id: string): string | undefined {
  return ctx.labelOf?.[id] ?? id;
}
