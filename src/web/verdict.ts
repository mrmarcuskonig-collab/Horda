// verdict.ts — the rating platform's surfaces, slice 1.
//   • renderVerdictForm   the three-tap ask (atmosphere / worth-it / would-return)
//   • renderVerdictDone   confirmation + a shareable card (shares the room, not the note)
//   • roomScoreBlock      PUBLIC event-page meter — shown only above the floor, no notes
//   • verdictReportBlock  ORGANISER-only report on /manage — numbers + verbatim notes
//
// Three questions is a hard ceiling (spec §3.1): response rate is the binding
// constraint on the whole platform and every extra question spends some of it. No JS —
// the form is plain radios, so there's nothing to break on a phone at a noisy door.
import { layout, esc } from './layout.ts';
import { shareButton } from './theme.ts';
import type { EventReport, Attendance } from '../db/verdict_repo.ts';

const CSS = `
  .vq{margin:22px 0 6px}
  .vq .ql{font-size:13px;font-weight:800;letter-spacing:.3px;margin-bottom:8px}
  .vq .qs{font-size:12px;color:var(--mut);font-weight:400;letter-spacing:0}
  .seg{display:flex;gap:6px}
  .seg input{position:absolute;opacity:0;width:0;height:0}
  .seg label{flex:1;text-align:center;padding:12px 0;border:1.5px solid var(--b);border-radius:11px;
    font-weight:800;font-size:16px;cursor:pointer;color:var(--bone);background:var(--s);user-select:none}
  .seg input:checked + label{background:var(--acc);border-color:var(--acc);color:var(--accink)}
  .yn label{font-size:14px}
  .vnote{display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);
    border-radius:12px;color:var(--bone);padding:12px;font:inherit;min-height:70px;line-height:1.5}
  .meter{height:8px;border-radius:999px;background:var(--b);overflow:hidden;margin:8px 0}
  .meter > span{display:block;height:100%;background:var(--acc);border-radius:999px}
  .rs{font-size:34px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
  .rsub{color:var(--mut);font-size:12.5px}
  .vrow{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b);font-size:14px}
  .vrow b{font-variant-numeric:tabular-nums}
  .vnotes{margin-top:12px}
  .vnitem{border:1px solid var(--b);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:13.5px}
  .vnitem .vm{color:var(--mut);font-size:11.5px;font-variant-numeric:tabular-nums;margin-bottom:3px}`;

// the 1–5 segmented control
function scale(name: string, label: string, sub: string, low: string, high: string): string {
  const opts = [1, 2, 3, 4, 5].map(n =>
    `<input type="radio" name="${name}" id="${name}${n}" value="${n}"${n === 3 ? ' required' : ''}><label for="${name}${n}">${n}</label>`).join('');
  return `<div class="vq"><div class="ql">${esc(label)} <span class="qs">${esc(sub)}</span></div>
    <div class="seg">${opts}</div>
    <div class="qs" style="display:flex;justify-content:space-between;margin-top:5px">${esc(low)}<span>${esc(high)}</span></div></div>`;
}

// The three-tap ask. Open to any logged-in fan; the route decides eligibility. The
// intro adapts to how they experienced it (their tier is derived server-side, not
// chosen here — so nobody can self-upgrade to "in the room").
export function renderVerdictForm(d: { eventId: string; title: string; attendance?: Attendance; back?: string }): string {
  const lead = d.attendance === 'in_room' ? "You were there — that's why we're asking. Three taps."
    : d.attendance === 'online' ? 'You watched it live. Three taps.'
    : "You followed this one — your take counts too. The organiser sees it as wider-audience feedback. Three taps.";
  return layout('How was it?', `<style>${CSS}</style>
    <h1>How was it?</h1>
    <p class="mut">${lead}</p>
    <form method="post" action="/e/${esc(d.eventId)}/verdict">
      ${scale('atmosphere', 'Atmosphere', '', 'Flat', 'Electric')}
      ${scale('worth_it', 'Worth it', '', 'Not really', 'Absolutely')}
      <div class="vq yn"><div class="ql">Would you come back?</div>
        <div class="seg">
          <input type="radio" name="return_intent" id="ri_yes" value="1" required><label for="ri_yes">Yes</label>
          <input type="radio" name="return_intent" id="ri_no" value="0"><label for="ri_no">No</label>
        </div></div>
      <div class="vq"><div class="ql">Anything for the organiser? <span class="qs">optional · only they see this</span></div>
        <textarea class="vnote" name="note" maxlength="1000" placeholder="What worked, what didn't…"></textarea></div>
      <div class="row" style="margin-top:16px"><button type="submit">Submit verdict →</button></div>
    </form>`, { back: d.back ?? `/e/${d.eventId}` });
}

// Confirmation + a shareable card. We share the fact of being there and the room —
// never the private note.
export function renderVerdictDone(d: { eventId: string; title: string; origin?: string; attendance?: Attendance }): string {
  const url = `${d.origin ?? ''}/e/${d.eventId}`;
  const line = d.attendance === 'in_room' ? 'You were in the room, and you said your piece.'
    : d.attendance === 'online' ? 'You watched it live, and you said your piece.'
    : 'Your take is in — logged as wider-audience feedback for the organiser.';
  const shareLabel = d.attendance === 'off_platform' ? 'Share your take' : 'Share that you were there';
  return layout('Verdict in', `<style>${CSS}</style>
    <h1>Verdict in ✓</h1>
    <p class="mut">Thanks — that's what makes the next one better. Only the organiser sees your note.</p>
    <div class="card"><strong>${esc(d.title)}</strong>
      <p class="mut" style="font-size:13px;margin:6px 0 12px">${line}</p>
      <div class="row">${shareButton({ title: d.title, label: shareLabel, url, cls: 'btn' })}</div>
    </div>
    <div class="row" style="margin-top:10px"><a class="btn ghost" href="/e/${esc(d.eventId)}">Back to the event</a></div>`,
    { back: `/e/${d.eventId}` });
}

// PUBLIC meter for the event page. Caller passes it only when roomScore() cleared
// the floor, so there is no floor logic here — and never a note.
export function roomScoreBlock(d: { score: number; verdicts: number }): string {
  const pct = Math.max(0, Math.min(100, (d.score / 5) * 100));
  return `<style>${CSS}</style><div class="card"><div class="h3" style="margin-top:0">The room's verdict</div>
    <div class="rs">${d.score.toFixed(1)}<span class="rsub"> / 5 atmosphere</span></div>
    <div class="meter"><span style="width:${pct.toFixed(0)}%"></span></div>
    <div class="rsub">From ${d.verdicts} verified attendee${d.verdicts === 1 ? '' : 's'} who were actually there.</div></div>`;
}

// ORGANISER report block for /manage. Includes the verbatim notes — this surface is
// owner-gated by the route, and these must never leak to the public event page.
export function verdictReportBlock(r: EventReport): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const num = (x: number | null) => x == null ? '—' : x.toFixed(1);
  const tierLabel: Record<Attendance, string> = { in_room: 'in the room', online: 'stream', off_platform: 'wider' };
  const notes = r.notes.length
    ? `<div class="vnotes"><div class="h3">What they told you</div>${r.notes.map(n =>
        `<div class="vnitem"><div class="vm">${esc(tierLabel[n.attendance])} · atmosphere ${n.atmosphere} · worth-it ${n.worthIt}</div>${esc(n.note)}</div>`).join('')}</div>`
    : '';
  // The wider (off_platform) block is ORGANISER-ONLY and never blended into the public score.
  const wider = r.widerVerdicts
    ? `<div class="card" style="border-style:dashed"><div class="h3" style="margin-top:0">Wider audience <span class="rsub">— not in your public score</span></div>
        <div class="vrow"><span>Ratings from people who didn't attend</span><b>${r.widerVerdicts}</b></div>
        <div class="vrow"><span>Atmosphere · worth-it</span><b>${num(r.wider.atmosphere)} · ${num(r.wider.worthIt)}</b></div>
        <div class="vrow"><span>Would come</span><b>${r.wider.wouldReturnPct == null ? '—' : r.wider.wouldReturnPct + '%'}</b></div></div>`
    : '';
  return `<style>${CSS}</style><div class="card">
    <div class="h3" style="margin-top:0">Verdict &amp; attendance</div>
    <div class="vrow"><span>Checked in (in the room)</span><b>${r.presences}</b></div>
    <div class="vrow"><span>Verified verdicts</span><b>${r.verifiedVerdicts} · ${pct(r.responseRate)} response</b></div>
    <div class="vrow"><span>· from the stands / the stream</span><b>${r.inRoom.count} · ${r.online.count}</b></div>
    <div class="vrow"><span>No-show rate</span><b>${pct(r.noShowRate)}</b></div>
    <div class="vrow"><span>Atmosphere · worth-it (verified)</span><b>${num(r.verified.atmosphere)} · ${num(r.verified.worthIt)}</b></div>
    <div class="vrow"><span>Would come back</span><b>${r.verified.wouldReturnPct == null ? '—' : r.verified.wouldReturnPct + '%'}</b></div>
    <div class="rsub" style="margin-top:8px">${r.aboveFloor ? 'A public room score is showing on the event page.' : 'The public score stays hidden until 5 verified verdicts and 20% of the room have spoken.'}</div>
    </div>${wider}${notes ? `<div class="card">${notes}</div>` : ''}`;
}
