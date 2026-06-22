// types.ts — read models for the fan-facing surfaces.
// These are COVERAGE of real sport (results, fixtures, tables) — never a venue
// for fan-to-fan content (spec §9). Everything here is derived from the spine.

export interface TableRow {
  rank: number; teamId: string; team: string;
  played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number;
}

export interface FormItem {
  date?: string;
  outcome: 'win' | 'loss' | 'draw';      // from the focus club's perspective
  headline: string;                       // "FC Beispiel beat TSV Musterstadt 3–1"
  scoreline: string;                      // "3–1"
}

export interface UpcomingItem {
  date?: string; time?: string;
  opponent: string;
  venue: 'home' | 'away';
  confidence: number;                     // surfaced so unverified fixtures read honestly
}

export interface FeedItem {
  kind: 'result' | 'fixture';
  date?: string;
  headline: string;
  sub?: string;
}

export interface ClubPageModel {
  clubId: string;
  clubName: string;
  record: { wins: number; draws: number; losses: number };
  table: TableRow[];
  form: FormItem[];          // most recent first
  upcoming: UpcomingItem[];  // soonest first
  feed: FeedItem[];          // coverage, newest first
  provenance: { source: 'ingested'; generatedAt: string; note: string };
}
