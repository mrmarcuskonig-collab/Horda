// extract.ts — turn pasted text into raw records.
// The rule-based extractor is the deterministic, testable core AND the fallback.
// In production an LLMExtractor handles photos / freeform / OCR'd scoresheets;
// the interface is identical so the rest of the pipeline doesn't care which ran.
import type { Extractor, RawFixture, RawResult } from './types.ts';

const WEEKDAYS = /\b(mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b\.?/gi;
// match vs / v / gegen / dash family / "x" between two teams
const SEPARATORS = /\s+(?:vs\.?|v\.?|gegen|x|[-–—:])\s+/i;
// No trailing \b: a date like "21.09." ends in a dot, and \b would force the
// optional dot to be dropped from the match, leaving a stray "." in the name.
const DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/;
const TIME_RE = /\b(\d{1,2}):(\d{2})\b/;            // mm must be 2 digits -> excludes scores like "2:2"
const SCORE_RE = /(\d{1,2})\s*[:\-]\s*(\d{1,2})/;   // 3-1 or 2:2

function toIso(d?: string, m?: string, y?: string): string | undefined {
  if (!d || !m) return undefined;
  const year = y ? (y.length === 2 ? '20' + y : y) : String(new Date().getFullYear());
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const clean = (s: string) =>
  s.replace(WEEKDAYS, ' ').replace(/[,;]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

function splitTeams(s: string): [string, string] | null {
  const parts = s.split(SEPARATORS);
  if (parts.length < 2) return null;
  // Re-join in case a team name itself contained a separator-like token:
  // take first chunk as home, the rest re-joined as away only if exactly 2.
  const home = clean(parts[0]);
  const away = clean(parts.slice(1).join(' '));
  if (!home || !away) return null;
  return [home, away];
}

export const ruleBasedExtractor: Extractor = {
  name: 'rule-based-v1',

  extractFixtures(text: string): RawFixture[] {
    const out: RawFixture[] = [];
    for (const lineRaw of text.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line) continue;
      const date = line.match(DATE_RE);
      const time = line.match(TIME_RE);
      // strip date + time, keep the rest for team splitting
      let rest = line;
      if (date) rest = rest.replace(date[0], ' ');
      if (time) rest = rest.replace(time[0], ' ');
      const teams = splitTeams(clean(rest));
      if (!teams) continue;
      out.push({
        raw: line,
        date: date ? toIso(date[1], date[2], date[3]) : undefined,
        time: time ? `${time[1].padStart(2, '0')}:${time[2]}` : undefined,
        homeName: teams[0], awayName: teams[1],
      });
    }
    return out;
  },

  extractResults(text: string): RawResult[] {
    const out: RawResult[] = [];
    for (const lineRaw of text.split(/\r?\n/)) {
      const line = lineRaw.trim();
      if (!line) continue;
      const date = line.match(DATE_RE);
      let work = date ? line.replace(date[0], ' ') : line;
      const score = work.match(SCORE_RE);
      if (!score) continue;
      const before = clean(work.slice(0, score.index!));
      const after = clean(work.slice(score.index! + score[0].length));
      if (!before || !after) continue;
      out.push({
        raw: line,
        date: date ? toIso(date[1], date[2], date[3]) : undefined,
        homeName: before, awayName: after,
        homeScore: Number(score[1]), awayScore: Number(score[2]),
      });
    }
    return out;
  },
};

// Production adapter: same interface, model does the extraction. Not invoked in
// tests (needs an API key); shown so the seam is explicit and swappable.
export class LLMExtractor implements Extractor {
  name = 'llm-v1';
  private callModel: (prompt: string, input: string) => Promise<string>;
  constructor(callModel: (prompt: string, input: string) => Promise<string>) {
    this.callModel = callModel;
  }
  private async parse(_kind: string, _text: string): Promise<any[]> {
    // const json = await this.callModel(EXTRACTION_PROMPT[kind], text);
    // return JSON.parse(json);  // schema-validated downstream
    throw new Error('LLMExtractor requires a configured model client');
  }
  extractFixtures(_t: string): RawFixture[] { throw new Error('use async path in prod'); }
  extractResults(_t: string): RawResult[] { throw new Error('use async path in prod'); }
}
