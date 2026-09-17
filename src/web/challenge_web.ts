// challenge_web.ts — the /c/:kind/:id challenges page + the fan-facing hero strip.
// Owners create challenges (picking which events count), export the qualifier list
// (they fulfil rewards manually), and fans see active challenges + their progress.
import { layout, esc } from './layout.ts';
import type { Challenge } from '../db/challenge_repo.ts';

const INP = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';

// The compact ember strip shown near the top of the issuer's page (Option C).
export function renderChallengeStrip(d: { kind: string; id: string; c: Challenge; progress?: { count: number; threshold: number; met: boolean } | null }): string {
  const line = d.progress ? (d.progress.met ? '✓ You qualified — the organiser fulfils it.' : `You're at ${d.progress.count} of ${d.c.threshold}.`) : `Attend ${d.c.threshold} to earn it.`;
  return `<a href="/c/${esc(d.kind)}/${esc(d.id)}" style="text-decoration:none;display:block;margin:0 0 14px">
    <div style="display:flex;align-items:center;gap:10px;border:1px solid var(--acc);border-radius:12px;padding:11px 12px;background:color-mix(in srgb, var(--acc) 8%, transparent)">
      <span aria-hidden="true" style="color:var(--acc);font-size:18px;line-height:1">✦</span>
      <div style="min-width:0">
        <div style="color:var(--bone);font-size:13px;font-weight:800">${esc(d.c.title)}${d.c.rewardText ? ` → ${esc(d.c.rewardText)}` : ''}</div>
        <div style="color:var(--mut);font-size:11.5px;margin-top:1px">${esc(line)}</div>
      </div>
      <span aria-hidden="true" style="color:var(--mut);font-size:18px;margin-left:auto">›</span>
    </div></a>`;
}

export function renderChallengesPage(d: {
  kind: string; id: string; name: string; isOwner: boolean; back?: string;
  linkable?: { id: string; title: string; startsAt: string | null }[];
  challenges: { c: Challenge; progress?: { count: number; threshold: number; met: boolean } | null; eventCount: number }[];
}): string {
  const list = d.challenges.length ? d.challenges.map(({ c, progress, eventCount }) => {
    const bar = progress ? `<div class="meter"><span style="width:${Math.min(100, Math.round(progress.count / progress.threshold * 100))}%"></span></div>
      <div class="rsub">${progress.met ? '✓ You qualified — the organiser fulfils the reward.' : `You're at ${progress.count} of ${c.threshold}.`}</div>` : '';
    const owner = d.isOwner ? `<div class="row" style="margin-top:8px"><a class="btn ghost sm" href="/c/${esc(d.kind)}/${esc(d.id)}/${esc(c.id)}/qualifiers.csv">Export qualifiers ↓</a></div>` : '';
    return `<div class="card"><strong>${esc(c.title)}</strong>
      <div class="rsub">Attend ${c.threshold} of ${eventCount} event${eventCount === 1 ? '' : 's'}${c.rewardText ? ` · reward: ${esc(c.rewardText)}` : ''}</div>
      ${bar}${owner}</div>`;
  }).join('') : '<p class="mut">No challenges yet.</p>';

  const evChecks = (d.linkable ?? []).map(e =>
    `<label class="mut" style="display:flex;gap:8px;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid var(--b)"><input type="checkbox" name="ev_${esc(e.id)}" style="width:auto;margin:0"> ${esc(e.title)}${e.startsAt ? ` <span class="rsub">· ${new Date(e.startsAt).toLocaleDateString()}</span>` : ''}</label>`).join('');

  const create = d.isOwner ? `<div class="card"><div class="h3" style="margin-top:0">New challenge</div>
    <form method="post" action="/c/${esc(d.kind)}/${esc(d.id)}">
      <label class="mut" style="font-size:13px;display:block">Title<input name="title" required maxlength="140" placeholder="Come to 5 home games this season" style="${INP}"></label>
      <label class="mut" style="font-size:13px;display:block;margin-top:8px">Attend how many?<input name="threshold" type="number" min="1" value="5" required style="${INP}"></label>
      <label class="mut" style="font-size:13px;display:block;margin-top:8px">Reward <span class="rsub">— you fulfil this yourself</span><input name="reward" maxlength="300" placeholder="20% off merch" style="${INP}"></label>
      <div style="margin-top:12px"><div class="mut" style="font-size:13px">Which events count?</div>
        ${evChecks || '<p class="rsub" style="margin:6px 0">No events yet — add one below by link.</p>'}</div>
      <label class="mut" style="font-size:13px;display:block;margin-top:10px">Add other events by link or ID <span class="rsub">— one per line; works for events you don't organise</span>
        <textarea name="extra_events" rows="2" placeholder="https://joinfuria.com/e/…" style="${INP};min-height:56px"></textarea></label>
      <div class="row" style="margin-top:12px"><button type="submit">Create challenge</button></div>
    </form></div>` : '';

  return layout(`Challenges · ${d.name}`, `<h1>Challenges</h1><p class="mut">${esc(d.name)}</p>${create}${list}
    <style>.meter{height:8px;border-radius:999px;background:var(--b);overflow:hidden;margin:8px 0}.meter>span{display:block;height:100%;background:var(--acc)}.rsub{color:var(--mut);font-size:12.5px}</style>`,
    { back: d.back ?? `/${d.kind}/${d.id}` });
}
