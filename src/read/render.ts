// render.ts — render a ClubPageModel to a self-contained, monochrome club page.
// Strictly Ink (#0B0B0C) + Bone (#EDE9DF), per the brand. The FURIA wordmark is
// still placeholder type (open brand item) — set in plain caps until it's cut.
import type { ClubPageModel } from './types.ts';
import { ravenMark } from '../web/brand.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pill = (o: 'win' | 'loss' | 'draw') => o === 'win' ? 'W' : o === 'loss' ? 'L' : 'D';

export function renderClubPage(m: ClubPageModel): string {
  const rec = `${m.record.wins}W ${m.record.draws}D ${m.record.losses}L`;

  const tableRows = m.table.map(r => `
    <tr class="${r.teamId === m.clubId ? 'me' : ''}">
      <td>${r.rank}</td><td class="t">${esc(r.team)}</td>
      <td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td>
      <td>${r.goalsFor}:${r.goalsAgainst}</td><td>${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}</td>
      <td class="pts">${r.points}</td>
    </tr>`).join('');

  const form = m.form.map(f => `
    <li><span class="pill p-${f.outcome}">${pill(f.outcome)}</span>
      <span class="hl">${esc(f.headline)}</span>${f.date ? `<span class="dt">${esc(f.date)}</span>` : ''}</li>`).join('');

  const upcoming = m.upcoming.length ? m.upcoming.map(u => `
    <li><span class="venue">${u.venue === 'home' ? 'H' : 'A'}</span>
      <span class="hl">${esc(u.opponent)}</span>
      <span class="dt">${[u.date, u.time].filter(Boolean).map(esc).join(' · ')}</span>
      ${u.confidence < 0.82 ? '<span class="flag">needs review</span>' : ''}</li>`).join('')
    : '<li class="empty">No upcoming fixtures uploaded yet.</li>';

  const feed = m.feed.map(it => `
    <li><span class="kind">${it.kind === 'result' ? 'RESULT' : 'FIXTURE'}</span>
      <span class="hl">${esc(it.headline)}</span>
      <span class="dt">${esc(it.sub ?? it.date ?? '')}</span></li>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.clubName)} — Furia</title><link rel="icon" href="/favicon.svg">
<style>
  :root{color-scheme:dark;--ink:#0B0B0C;--bone:#EDE9DF;--b:rgba(237,233,223,.16);--mut:rgba(237,233,223,.6)}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.45;max-width:760px;margin:0 auto;padding:0 18px 60px}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--b);padding:16px 0 12px;position:sticky;top:0;background:var(--ink)}
  .mark{display:flex;align-items:center}.mark svg{display:block}
  h1{font-size:30px;font-weight:800;letter-spacing:.5px;margin:22px 0 2px;text-transform:uppercase}
  .rec{color:var(--mut);font-size:14px;font-variant-numeric:tabular-nums}
  h2{font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:800;margin:30px 0 10px;border-bottom:1px solid var(--b);padding-bottom:6px}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}
  th,td{text-align:right;padding:7px 4px;border-bottom:1px solid var(--b)}
  th:nth-child(2),td.t{text-align:left}
  th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
  td.pts{font-weight:800}
  tr.me{background:var(--bone);color:var(--ink)}
  tr.me td{border-color:rgba(11,11,12,.15)}
  ul{list-style:none}
  li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b);font-size:14px}
  .hl{flex:1}
  .dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .pill,.venue,.kind,.flag{font-size:11px;font-weight:800;border:1.5px solid var(--bone);border-radius:6px;padding:1px 7px;white-space:nowrap}
  .p-win{background:var(--bone);color:var(--ink)}
  .p-loss{background:transparent}
  .p-draw{background:transparent}
  .venue,.kind{color:var(--mut);border-color:var(--b);font-weight:700;letter-spacing:1px}
  .flag{border-color:var(--bone);background:repeating-linear-gradient(45deg,var(--bone),var(--bone) 3px,rgba(237,233,223,.4) 3px,rgba(237,233,223,.4) 6px);color:var(--ink)}
  .empty{color:var(--mut)}
  .prov{margin-top:30px;color:var(--mut);font-size:11px;border-top:1px solid var(--b);padding-top:12px}
</style></head><body>
  <div class="top"><div class="mark">${ravenMark(28, 'bone')}</div><div class="rec">${esc(rec)}</div></div>
  <h1>${esc(m.clubName)}</h1>
  <div class="rec">Season record ${esc(rec)} · system of record</div>

  <h2>League table</h2>
  <table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>G</th><th>GD</th><th>Pts</th></tr></thead>
  <tbody>${tableRows}</tbody></table>

  <h2>Recent form</h2><ul>${form || '<li class="empty">No results yet.</li>'}</ul>

  <h2>Upcoming</h2><ul>${upcoming}</ul>

  <h2>Coverage</h2><ul>${feed}</ul>

  <div class="prov">${esc(m.provenance.note)} Source: ${esc(m.provenance.source)}. Generated ${esc(m.provenance.generatedAt)}.</div>
</body></html>`;
}
