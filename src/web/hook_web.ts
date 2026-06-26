// hook_web.ts — render layer for Build Order #3: the Event Room, the AI media
// studio, collective/rivalry goal surfaces, and the creator insights dashboard.
import { layout, esc, linkify } from './layout.ts';
import type { RoomMessage, RoomState, GoalProgress } from '../db/hook_repo.ts';

const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
const ta = 'display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:13px;font:inherit;min-height:90px;line-height:1.5';

const ROOM_CSS = `
  .roomhd{position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--b);margin:14px 0}
  .roomhd svg{width:100%;height:auto;display:block}
  .statepill{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;border:1.5px solid var(--bone);border-radius:999px;padding:4px 12px}
  .statepill.live{background:#e5484d;border-color:#e5484d;color:#fff}
  .statepill.live .dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:pulse 1.4s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  .cd{display:flex;gap:10px;margin:14px 0}
  .cd div{flex:1;text-align:center;border:1px solid var(--b);border-radius:12px;padding:10px 4px;background:var(--s)}
  .cd b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.cd span{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
  .chat{display:flex;flex-direction:column;gap:8px;margin:12px 0;max-height:60vh;overflow:auto}
  .msg{border:1px solid var(--b);border-radius:12px;padding:9px 12px;background:var(--s);font-size:14px}
  .msg.bts{border-color:var(--bone)}.msg .who{font-size:11px;color:var(--mut);font-weight:700;margin-bottom:2px}
  .msg.bts .who{color:var(--bone)}
  .react{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .react form{display:inline}.react button{font-size:18px;background:var(--s);border:1px solid var(--b);border-radius:999px;padding:5px 12px;cursor:pointer;color:var(--bone)}
  .lockbox{border:1px dashed var(--b);border-radius:14px;padding:20px;text-align:center;background:var(--s);margin:12px 0}
  .gbar{height:12px;border-radius:999px;background:var(--s);border:1px solid var(--b);overflow:hidden;margin:8px 0}
  .gbar span{display:block;height:100%;background:var(--bone)}
  .gbar.hit span{background:#3fb950}
  .goalcard{border:1px solid var(--b);border-radius:14px;padding:14px;margin:10px 0;background:var(--s)}
  .h2h{display:flex;align-items:center;gap:10px;margin:6px 0}.h2h .side{flex:1;text-align:center}.h2h .n{font-size:24px;font-weight:800}
  .draft{border:1px solid var(--b);border-radius:14px;padding:14px;margin:12px 0;background:var(--s)}
  .draft svg{width:100%;height:auto;border-radius:10px;display:block;margin-bottom:8px}
  .presence{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--mut);margin:6px 0 10px}
  .presence strong{color:var(--bone)}.pdot{width:8px;height:8px;border-radius:50%;background:#3fb950;box-shadow:0 0 0 3px rgba(63,185,80,.2)}
  .kpi{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
  .kpi .c{border:1px solid var(--b);border-radius:14px;padding:14px;background:var(--s)}
  .kpi .big{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}.kpi .lab{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}`;

// --- public progress bar (reused on the athlete page + in the room) --------
export function goalBar(p: GoalProgress, athleteHandleHref?: string): string {
  const g = p.goal;
  const metricLabel = g.metric === 'support' ? `€${Math.round(p.value / 100)} / €${Math.round(g.threshold / 100)}` : `${p.value} / ${g.threshold} ${g.metric}`;
  if (g.rivalKind && g.rivalId) {
    const rv = p.rivalValue ?? 0;
    const lead = p.value === rv ? 'Level' : p.value > rv ? 'Leading' : 'Behind';
    return `<div class="goalcard"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700">Rivalry — ${esc(g.reward)}</div>
      <div class="h2h"><div class="side"><div class="n">${p.value}</div><div class="mut" style="font-size:11px">us</div></div><div style="font-weight:800;color:var(--mut)">${esc(lead)}</div><div class="side"><div class="n">${rv}</div><div class="mut" style="font-size:11px">them</div></div></div></div>`;
  }
  const shareHref = `/share/supporter/${g.ownerKind}/${g.ownerId}`;
  return `<div class="goalcard">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><strong>${esc(g.reward)}</strong><span class="mut" style="font-size:12px">${esc(metricLabel)}</span></div>
    <div class="gbar${p.reached ? ' hit' : ''}"><span style="width:${p.pct}%"></span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:4px"><span class="mut" style="font-size:12px">${p.reached ? '✓ Unlocked — reward is live.' : `${g.threshold - p.value} to go. Recruit to get there faster.`}</span>${p.reached ? '' : `<a class="tag" href="${shareHref}" style="white-space:nowrap">Share ↗</a>`}</div>
  </div>`;
}

function countdown(startsAt: string | null): string {
  if (!startsAt) return '';
  return `<div class="cd" id="cd"><div><b data-d>–</b><span>days</span></div><div><b data-h>–</b><span>hrs</span></div><div><b data-m>–</b><span>min</span></div><div><b data-s>–</b><span>sec</span></div></div>
    <script>(function(){var t=new Date(${JSON.stringify(startsAt)}).getTime();function u(){var s=Math.max(0,Math.floor((t-Date.now())/1000));var el=document.getElementById('cd');if(!el)return;el.querySelector('[data-d]').textContent=Math.floor(s/86400);el.querySelector('[data-h]').textContent=Math.floor(s%86400/3600);el.querySelector('[data-m]').textContent=Math.floor(s%3600/60);el.querySelector('[data-s]').textContent=s%60;}u();setInterval(u,1000);})();</script>`;
}

export function renderEventRoom(d: {
  eventId: string; title: string; ownerKind: string; ownerId: string;
  label: string; state: RoomState; result: string | null; startsAt: string | null; tier: string;
  graphic: string; messages: RoomMessage[]; canSeeLive: boolean; isOwner: boolean; guest: boolean; fanId: string | null;
  athleteHref: string; goals?: GoalProgress[]; presence?: { now: number; total: number; names: string[] };
}): string {
  const statePill = d.state === 'live'
    ? `<span class="statepill live"><span class="dot"></span>Live now</span>`
    : d.state === 'recap' ? `<span class="statepill">Recap</span>` : `<span class="statepill">Upcoming</span>`;

  const bts = d.messages.filter(m => m.kind === 'bts' || m.authorKind === 'athlete');
  const chat = d.messages.filter(m => m.kind !== 'bts' && m.authorKind !== 'athlete');

  // Behind-the-scenes from the athlete — the upgrade reason.
  const btsBlock = bts.length
    ? `<h2>From the host</h2><div class="chat">${bts.map(m => `<div class="msg bts"><div class="who">${esc(m.name)} · ${esc(m.date)}</div>${linkify(m.body)}</div>`).join('')}</div>` : '';

  const reactBar = `<div class="react">${['🔥', '🥊', '👏', '💪', '😱', '🎉'].map(e =>
    `<form method="post" action="/e/${d.eventId}/room/react"><input type="hidden" name="emoji" value="${e}"><button type="submit" aria-label="React ${e}">${e}</button></form>`).join('')}</div>`;

  // Live presence (Friend-Activity lesson) — "who's here right now".
  const pr = d.presence;
  const presenceBar = pr && (pr.now > 0 || pr.total > 0)
    ? `<div class="presence">${pr.now > 0 ? `<span class="pdot"></span><strong>${pr.now}</strong> in the room now` : `<strong>${pr.total}</strong> have been in the room`}${pr.names.length ? ` · ${esc(pr.names.slice(0, 3).join(', '))}${pr.total > 3 ? ` +${pr.total - 3}` : ''}` : ''}</div>`
    : '';

  const chatBlock = `<h2>The room ${d.state === 'live' ? '· live' : ''}</h2>
    ${presenceBar}
    ${reactBar}
    <div class="chat">${chat.length ? chat.map(m => `<div class="msg"><div class="who">${esc(m.name)} · ${esc(m.date)}</div>${linkify(m.body)}</div>`).join('') : '<div class="mut" style="font-size:13px">Be the first to say something.</div>'}</div>
    ${d.guest ? '' : `<form method="post" action="/e/${d.eventId}/room/post"><textarea name="body" required placeholder="Say something to the room…" style="${ta};min-height:60px"></textarea><div class="row"><button type="submit">Send</button></div></form>`}`;

  // Free followers get a teaser; tiered access unlocks the live room.
  const liveArea = d.canSeeLive
    ? `${btsBlock}${chatBlock}`
    : `<div class="lockbox"><strong>${d.state === 'live' ? 'The live room is open for superfans.' : 'Superfans get the live room.'}</strong>
        <p class="mut" style="font-size:13px;margin:6px 0 12px">Pre-event access, the host's walkout thoughts, behind-the-scenes and the live reactions — for ${d.tier === 'clubhouse' ? 'Clubhouse' : 'Supporter'} and up.</p>
        <a class="btn" href="${d.guest ? '/signup' : d.athleteHref + '#join'}">${d.guest ? 'Join free, then upgrade' : 'Unlock the room'}</a></div>`;

  const ownerTools = d.isOwner ? `<div class="card"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:8px">Host controls</div>
      <form method="post" action="/e/${d.eventId}/room/bts"><textarea name="body" required placeholder="Drop a behind-the-scenes note for superfans…" style="${ta};min-height:60px"></textarea><div class="row"><button type="submit">Post behind-the-scenes</button></div></form>
      <form method="post" action="/e/${d.eventId}/room/result" style="margin-top:8px"><input name="result" placeholder="Post the result (e.g. 'Won by TKO, round 4')" style="${inp}" ${d.result ? `value="${esc(d.result)}"` : ''}><div class="row"><button class="ghost" type="submit">Post result → recap</button></div></form>
      <div class="row" style="margin-top:8px"><a class="tag" href="/e/${d.eventId}/media">✦ AI media studio</a><a class="tag mutd" href="/e/${d.eventId}/manage">Manage event</a></div>
    </div>` : '';

  const resultBlock = d.result ? `<div class="card" style="border-color:var(--bone)"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700">Result</div><div style="font-size:20px;font-weight:800;margin-top:4px">${esc(d.result)}</div><div class="row" style="margin-top:8px"><a class="tag" href="/share/result/${d.eventId}">Share the result card ↗</a></div></div>` : '';

  const goalsBlock = (d.goals && d.goals.length) ? `<h2>Goals</h2>${d.goals.map(g => goalBar(g)).join('')}` : '';

  return layout(`${d.label} · ${d.title}`, `
    <style>${ROOM_CSS}</style>
    <div class="row" style="justify-content:space-between;margin-top:8px"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);font-weight:800">${esc(d.label)}</div>${statePill}</div>
    <h1 style="margin-top:6px">${esc(d.title)}</h1>
    <div class="roomhd">${d.graphic}</div>
    ${d.state === 'upcoming' ? countdown(d.startsAt) : ''}
    ${resultBlock}
    ${ownerTools}
    ${liveArea}
    ${goalsBlock}
    <div class="prov">Event room · superfans gather on the day. Coverage of what you follow — no fan-to-fan venue beyond this room.</div>
  `, { back: `/e/${d.eventId}`, nav: { active: 'home', guest: d.guest, fanId: d.fanId } });
}

// --- AI media studio (human-in-the-loop) -----------------------------------
export function renderMediaStudio(d: {
  eventId: string; athleteId: string; title: string; label: string; hasResult: boolean;
  assets: { graphic: string; hypePost: string; recap: string | null; supporterCard: string };
}): string {
  const a = d.assets;
  const draft = (heading: string, svg: string | null, text: string | null, postKind: string, postVis = 'public') => `
    <div class="draft"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:8px">${esc(heading)}</div>
      ${svg ? svg : ''}
      <form method="post" action="/e/${d.eventId}/media/post">
        <input type="hidden" name="post_kind" value="${esc(postKind)}">
        ${svg ? `<input type="hidden" name="graphic" value="1">` : ''}
        ${text !== null ? `<textarea name="body" style="${ta}">${esc(text)}</textarea>` : ''}
        <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Who sees it
          <select name="visibility" style="${inp}"><option value="public"${postVis === 'public' ? ' selected' : ''}>Everyone — free to follow</option><option value="supporter">★ Supporters &amp; Clubhouse members</option><option value="clubhouse">✦ Only Clubhouse members</option></select></label>
        <div class="row" style="margin-top:10px"><button type="submit">Review &amp; post →</button></div>
      </form>
    </div>`;
  return layout('AI media studio', `
    <style>${ROOM_CSS}</style>
    <h1>✦ Media studio</h1>
    <p class="mut">Your always-on media team. We drafted on-brand assets for <strong>${esc(d.title)}</strong>. Edit anything, then post — nothing goes out until you approve it.</p>
    ${draft(`${d.label} graphic + hype post`, a.graphic, a.hypePost, 'hype')}
    ${d.hasResult && a.recap !== null ? draft('Result recap', null, a.recap, 'recap') : `<div class="draft"><div class="mut" style="font-size:13px">Post the event result in the room to unlock the AI recap asset.</div></div>`}
    <div class="draft"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin-bottom:8px">Free shareable supporter card</div>
      ${a.supporterCard}
      <p class="mut" style="font-size:12.5px">Fans share this — it carries your brand out of the walled garden with a rich link back.</p>
      <div class="row"><a class="tag" href="/share/supporter/athlete/${d.athleteId}">Open shareable card ↗</a></div>
    </div>
    <div class="prov">Human-in-the-loop · we draft, you approve. We never invent results, stats or quotes.</div>
  `, { back: `/e/${d.eventId}/room`, nav: { active: 'you', guest: false, fanId: null } });
}

// --- creator insights dashboard --------------------------------------------
export function renderInsights(d: {
  name: string; athleteId: string;
  conversion: { conversions: number; opens: number; rate: number };
  returnRate: number; goalSignups: number; artifactShares: number; aiAdoption: number; events: number;
}): string {
  return layout('Insights', `
    <style>${ROOM_CSS}</style>
    <h1>Insights</h1>
    <p class="mut">The validation data for ${esc(d.name)} — the metrics that tell us if the hook works.</p>
    <div class="kpi">
      <div class="c"><div class="big">${d.conversion.rate}%</div><div class="lab">Event-day conversion</div><div class="mut" style="font-size:12px;margin-top:4px">${d.conversion.conversions} superfans on ${d.conversion.opens} event days</div></div>
      <div class="c"><div class="big">${d.returnRate}%</div><div class="lab">Next-event return</div><div class="mut" style="font-size:12px;margin-top:4px">superfans back for the next room</div></div>
      <div class="c"><div class="big">${d.goalSignups}</div><div class="lab">Goal-driven signups / shares</div></div>
      <div class="c"><div class="big">${d.events ? Math.round((d.aiAdoption / d.events) * 100) : 0}%</div><div class="lab">AI media adoption</div><div class="mut" style="font-size:12px;margin-top:4px">${d.aiAdoption} of ${d.events} events used an AI asset</div></div>
    </div>
    <div class="prov">Event-day conversion + next-event return are the kill/continue signals for this release.</div>
  `, { back: `/athlete/${d.athleteId}`, nav: { active: 'you', guest: false, fanId: null } });
}
