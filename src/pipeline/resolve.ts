// resolve.ts — entity resolution. Tie a written team/club name to a known
// entity, with a confidence score, or propose creating a new one.
// Guardrail (spec §5): low confidence NEVER auto-commits — it routes to review.
import type { KnownEntity, Resolution, ResolveDecision } from './types.ts';

const AUTO = 0.82;   // >= this: auto-link
const NEW  = 0.55;   // <  this: treat as a new entity; between: human review

// Common German club name-noise tokens that shouldn't dominate matching.
const NOISE = new Set([
  'fc','sv','tsv','vfb','vfl','sc','sg','spvgg','fsv','tus','vff','bsc','msv',
  'ev','e.v','ev.','1','i','ii','iii','der','die','und','am','bei',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    // German umlaut/ß expansion FIRST so "München" === "Muenchen".
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    // then strip any remaining combining diacritics (é -> e, etc.)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function coreTokens(s: string): string {
  return normalize(s).split(' ').filter(t => t && !NOISE.has(t)).join(' ') || normalize(s);
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/ /g, '');
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

// Sørensen–Dice coefficient over character bigrams of the de-noised names.
export function similarity(a: string, b: string): number {
  const ca = coreTokens(a), cb = coreTokens(b);
  if (ca === cb) return 1;
  const A = bigrams(ca), B = bigrams(cb);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const [g, n] of A) if (B.has(g)) inter += Math.min(n, B.get(g)!);
  return (2 * inter) / ([...A.values()].reduce((s, x) => s + x, 0) + [...B.values()].reduce((s, x) => s + x, 0));
}

export function resolveEntity(input: string, known: KnownEntity[]): Resolution {
  const scored = known
    .map(e => {
      const names = [e.name, ...(e.aliases ?? [])];
      const score = Math.max(...names.map(n => similarity(input, n)));
      return { id: e.id, name: e.name, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  let decision: ResolveDecision;
  if (!best || best.score < NEW) decision = 'new';
  else if (best.score >= AUTO) decision = 'auto';
  else decision = 'review';

  return {
    input,
    matchId: decision === 'auto' ? best.id : decision === 'review' ? best.id : null,
    matchName: decision === 'new' ? null : best?.name ?? null,
    score: best?.score ?? 0,
    decision,
    suggestions: scored.slice(0, 3).filter(s => s.score > 0),
  };
}

export const THRESHOLDS = { AUTO, NEW };
