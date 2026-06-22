// types.ts — the contract for the extract → map → resolve → stage pipeline.
// USER-UPLOAD MODE ONLY: every input is data the user brought (pasted fixtures,
// a results block, a scoresheet). No crawling. Scope: non-person entities only —
// the pipeline never mints an athlete (spec §5).

export type UploadKind = 'fixtures' | 'results';

// ---- EXTRACT: raw records lifted out of the messy input ------------------
export interface RawFixture {
  raw: string;                  // the original line, for provenance + review UI
  date?: string;                // ISO date if parseable (yyyy-mm-dd)
  time?: string;                // HH:MM
  homeName: string;             // as written
  awayName: string;             // as written
}
export interface RawResult {
  raw: string;
  date?: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
}

export interface Extractor {
  name: string;
  extractFixtures(text: string): RawFixture[];
  extractResults(text: string): RawResult[];
}

// ---- RESOLVE: tie a written name to a known entity (or propose a new one) -
export type ResolveDecision = 'auto' | 'review' | 'new';
export interface KnownEntity { id: string; name: string; aliases?: string[] }
export interface Resolution {
  input: string;
  matchId: string | null;       // null when decision === 'new'
  matchName: string | null;
  score: number;                // 0..1 similarity
  decision: ResolveDecision;    // auto-link / needs human / create new
  suggestions: { id: string; name: string; score: number }[];
}

// ---- MAP/STAGE: pipeline output, ready for review then commit ------------
export interface StagedEvent {
  kind: 'fixture' | 'result';
  raw: string;
  date?: string;
  time?: string;
  sportKey: string;
  variantKey: string;
  home: Resolution;
  away: Resolution;
  // result-only:
  homeScore?: number;
  awayScore?: number;
  // the materialized spine rows (present for results); fed straight to engines
  spine?: SpineDraft[];
  confidence: number;           // min(home, away) similarity
  status: 'ready' | 'needs_review';
  source: 'ingested';           // user-upload extractions are tagged ingested
  flags: string[];
}

// A draft of a `result` spine row (participant ids only set once resolved).
export interface SpineDraft {
  participantId: string | null; // team id, or null if unresolved/new
  participantType: 'team';
  outcome: 'win' | 'loss' | 'draw';
  detail: { score: number };
}

export interface IngestReport {
  mode: UploadKind;
  extractor: string;
  staged: StagedEvent[];
  readyCount: number;
  reviewCount: number;
  reviewQueue: StagedEvent[];   // never auto-committed (spec guardrail §5)
  newEntities: string[];        // names with no confident match -> create candidates
}
