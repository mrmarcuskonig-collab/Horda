// map.ts — map resolved records onto the model via the registry.
// Results materialize into the universal spine (one row per side), tagged
// source='ingested', ready to flow straight into the standings engines.
import type { Resolution, SpineDraft } from './types.ts';

export function outcomeFromScores(my: number, opp: number): 'win' | 'loss' | 'draw' {
  return my > opp ? 'win' : my < opp ? 'loss' : 'draw';
}

// Two spine drafts per match (home + away), mirroring how `result` stores a
// matchup as per-side rows. participantId is null until the side resolves.
export function materializeResult(
  home: Resolution, away: Resolution, homeScore: number, awayScore: number,
): SpineDraft[] {
  return [
    { participantId: home.matchId, participantType: 'team', outcome: outcomeFromScores(homeScore, awayScore), detail: { score: homeScore } },
    { participantId: away.matchId, participantType: 'team', outcome: outcomeFromScores(awayScore, homeScore), detail: { score: awayScore } },
  ];
}

// Confidence of a mapped event = the weaker of its two side resolutions.
export function eventConfidence(home: Resolution, away: Resolution): number {
  return Math.min(home.score, away.score);
}
