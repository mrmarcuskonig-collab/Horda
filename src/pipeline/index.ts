// index.ts — the user-upload ingest orchestrator: extract -> map -> resolve -> stage.
// One call takes pasted text + the club's known entities and returns staged
// events split into "ready" and "needs_review", plus new-entity candidates.
// Nothing here writes to the DB; commit is a separate, reviewed step.
import type {
  Extractor, KnownEntity, UploadKind, StagedEvent, IngestReport,
} from './types.ts';
import { ruleBasedExtractor } from './extract.ts';
import { resolveEntity, THRESHOLDS } from './resolve.ts';
import { materializeResult, eventConfidence } from './map.ts';

export interface IngestOptions {
  text: string;
  mode: UploadKind;
  known: KnownEntity[];          // the uploading club's known teams/opponents
  sportKey: string;
  variantKey: string;
  extractor?: Extractor;         // defaults to rule-based; swap in LLM in prod
  reviewBelow?: number;          // confidence floor for auto-accept
}

export function ingestUserUpload(opts: IngestOptions): IngestReport {
  const ex = opts.extractor ?? ruleBasedExtractor;
  const floor = opts.reviewBelow ?? THRESHOLDS.AUTO;
  const staged: StagedEvent[] = [];
  const newNames = new Set<string>();

  const note = (home: any, away: any, ev: StagedEvent) => {
    if (home.decision === 'new') newNames.add(home.input);
    if (away.decision === 'new') newNames.add(away.input);
    for (const r of [home, away]) {
      if (r.decision === 'review') ev.flags.push(`ambiguous: "${r.input}" ~ "${r.matchName}" (${r.score.toFixed(2)})`);
      if (r.decision === 'new') ev.flags.push(`unknown team: "${r.input}" (create?)`);
    }
  };

  if (opts.mode === 'fixtures') {
    for (const f of ex.extractFixtures(opts.text)) {
      const home = resolveEntity(f.homeName, opts.known);
      const away = resolveEntity(f.awayName, opts.known);
      const confidence = eventConfidence(home, away);
      const ev: StagedEvent = {
        kind: 'fixture', raw: f.raw, date: f.date, time: f.time,
        sportKey: opts.sportKey, variantKey: opts.variantKey,
        home, away, confidence,
        status: confidence >= floor ? 'ready' : 'needs_review',
        source: 'ingested', flags: [],
      };
      note(home, away, ev);
      staged.push(ev);
    }
  } else {
    for (const r of ex.extractResults(opts.text)) {
      const home = resolveEntity(r.homeName, opts.known);
      const away = resolveEntity(r.awayName, opts.known);
      const confidence = eventConfidence(home, away);
      const ev: StagedEvent = {
        kind: 'result', raw: r.raw, date: r.date,
        sportKey: opts.sportKey, variantKey: opts.variantKey,
        home, away, homeScore: r.homeScore, awayScore: r.awayScore,
        spine: materializeResult(home, away, r.homeScore, r.awayScore),
        confidence,
        status: confidence >= floor ? 'ready' : 'needs_review',
        source: 'ingested', flags: [],
      };
      note(home, away, ev);
      staged.push(ev);
    }
  }

  const reviewQueue = staged.filter(s => s.status === 'needs_review');
  return {
    mode: opts.mode,
    extractor: ex.name,
    staged,
    readyCount: staged.length - reviewQueue.length,
    reviewCount: reviewQueue.length,
    reviewQueue,
    newEntities: [...newNames],
  };
}

export * from './types.ts';
export { ruleBasedExtractor, LLMExtractor } from './extract.ts';
export { resolveEntity, similarity, THRESHOLDS } from './resolve.ts';
export { outcomeFromScores } from './map.ts';
