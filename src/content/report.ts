// report.ts — factual narrative from the spine. THE BRIGHT LINE (spec §4):
// these only restate recorded facts (names, scores, method, date, record). They
// never invent a quote, a voice, or a stat. AI may later POLISH phrasing, but the
// inputs are real and nothing here fabricates. Deterministic + testable.

export interface ResultSide { name: string; score?: number; outcome: string; method?: string; round?: number; isHome?: boolean }

export function matchReport(d: { sport: string; sides: ResultSide[]; date?: string; competition?: string }): string {
  const when = d.date ? `On ${d.date}, ` : '';
  const ctx = d.competition ? ` (${d.competition})` : '';
  // matchup with scores (football/futsal)
  if (d.sides.length === 2 && d.sides.every(s => s.score != null)) {
    const home = d.sides.find(s => s.isHome) ?? d.sides[0];
    const away = d.sides.find(s => s !== home) ?? d.sides[1];
    const line = `${home.name} ${home.score}, ${away.name} ${away.score}`;
    if (home.score === away.score) return `${when}${home.name} and ${away.name} drew ${home.score}–${away.score}${ctx}. The sides shared the points.`;
    const w = home.score! > away.score! ? home : away, l = w === home ? away : home;
    return `${when}${line}${ctx}. ${w.name} beat ${l.name} ${w.score}–${l.score}.`;
  }
  // matchup decided by method (boxing bout)
  const win = d.sides.find(s => s.outcome === 'win'), lose = d.sides.find(s => s.outcome === 'loss');
  if (win && lose) {
    const how = win.method ? ` by ${win.method}${win.round ? ` in round ${win.round}` : ''}` : '';
    return `${when}${win.name} defeated ${lose.name}${how}${ctx}.`;
  }
  return `${when}Result recorded${ctx}.`;
}

export function fightHype(d: { a: string; b: string; date?: string; recordA?: string; ticket?: boolean; stream?: boolean }): string {
  const head = `${d.a} vs ${d.b}${d.date ? ` is set for ${d.date}` : ' is confirmed'}.`;
  const rec = d.recordA ? ` ${d.a} comes in at ${d.recordA}.` : '';
  const ways: string[] = ['follow on Furia'];
  if (d.ticket) ways.unshift('buy tickets'); if (d.stream) ways.push('stream live');
  return `${head}${rec} You can ${ways.join(', ')}.`;
}

export function weekDrop(d: { fanName: string; results: { headline: string; date?: string }[]; upcoming: { headline: string; date?: string }[] }): string {
  const r = d.results.length, u = d.upcoming.length;
  const head = `${d.fanName}'s week in the Furia — ${r} result${r === 1 ? '' : 's'}, ${u} coming up.`;
  const body = [
    ...d.results.slice(0, 4).map(x => `• ${x.headline}`),
    ...d.upcoming.slice(0, 3).map(x => `• Upcoming: ${x.headline}${x.date ? ` (${x.date})` : ''}`),
  ].join('\n');
  return body ? `${head}\n${body}` : head;
}

// short text for an outbound share (tweet/WhatsApp) — facts + the link
export const shareText = (headline: string) => `${headline} — on Furia. joinfuria.com`;
