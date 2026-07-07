// claim_web.ts — render surfaces for the claim rail: the pass (web/QR bridge
// until native Wallet), the fan Record, and the organizer check-in gate.
import { layout, esc } from './layout.ts';
import type { PassView, RecordRow } from '../db/claim_rail_repo.ts';

const CSS = `
  .pass{border:1px solid var(--b);border-radius:18px;overflow:hidden;background:var(--s);margin:16px 0}
  .passhd{padding:16px 18px;border-bottom:1px dashed var(--b)}
  .passhd .k{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);font-weight:800}
  .passhd h1{font-size:24px;margin:4px 0 0}
  .passbody{padding:18px;text-align:center}
  .code{font-family:"Courier New",monospace;font-size:22px;letter-spacing:3px;font-weight:800;word-break:break-all;padding:14px;border:1px solid var(--b);border-radius:12px;background:var(--ink);color:var(--bone)}
  .passtag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-radius:999px;padding:4px 12px;border:1.5px solid var(--bone)}
  .passtag.ok{background:#3fb950;border-color:#3fb950;color:#06210d}
  .rec{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--b)}
  .rec .stamp{width:40px;height:40px;border-radius:10px;background:var(--s);border:1px solid var(--b);display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 auto}
  .rec .rt{flex:1}.rec .rd{color:var(--mut);font-size:12px}
  .bigcount{font-size:44px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px}`;

export function renderPass(d: { pass: PassView; verifyUrl: string; guest: boolean; fanId: string | null }): string {
  const p = d.pass;
  const statusTag = p.verified
    ? `<span class="passtag ok">✓ Verified — you were in the building</span>`
    : p.status === 'waitlisted' ? `<span class="passtag">Waitlisted</span>`
      : p.status === 'approved' ? `<span class="passtag">Awaiting approval</span>`
        : `<span class="passtag">Claimed · show this at the gate</span>`;
  return layout(`Your pass · ${p.eventTitle}`, `
    <style>${CSS}</style>
    <div class="pass">
      <div class="passhd"><div class="k">Horda pass</div><h1>${esc(p.eventTitle)}</h1><div class="mut" style="font-size:13px;margin-top:4px">${esc(p.startsAt ? new Date(p.startsAt).toLocaleString() : 'Time TBA')}</div></div>
      <div class="passbody">
        <div style="margin-bottom:12px">${statusTag}</div>
        <div class="code">${esc(p.token.replace(/(.{4})/g, '$1 ').trim())}</div>
        <p class="mut" style="font-size:12.5px;margin-top:12px">Identity‑bound, non‑transferable. Show this code (or its link) at the gate — the organizer scans or enters it to count you in.</p>
        <div class="row" style="justify-content:center"><a class="tag mutd" href="${esc(d.verifyUrl)}">Verify link ↗</a><span class="tag mutd">＋ Add to Wallet — soon</span></div>
      </div>
    </div>
    <div class="row"><a class="btn ghost" href="/e/${p.eventId}">Back to the event</a>${p.hostKind ? `<a class="btn ghost" href="${p.hostKind === 'athlete' ? `/athlete/${p.hostId}` : `/${p.hostKind}/${p.hostId}`}">The crowd</a>` : ''}</div>
    <div class="prov">Your presence, once verified, is added to your Record — a passport of where you actually showed up.</div>
  `, { back: `/e/${p.eventId}`, nav: { active: 'you', guest: d.guest, fanId: d.fanId } });
}

export function renderRecord(d: { fanId: string; name: string; rows: RecordRow[]; count: { total: number; inRoom: number } }): string {
  const stamp = (r: RecordRow) => `<div class="rec"><div class="stamp">${r.fidelity === 'online' ? '🖥️' : '📍'}</div><div class="rt"><a class="hl" href="/e/${r.eventId}">${esc(r.title)}</a><div class="rd">${esc(r.date)} · ${r.fidelity === 'online' ? 'online' : 'in the room'}</div></div></div>`;
  return layout('Your Record', `
    <style>${CSS}</style>
    <h1>Your Record</h1>
    <p class="mut">Not what you watched — where you showed up.</p>
    <div class="card" style="text-align:center"><div class="bigcount">${d.count.total}</div><div class="mut" style="font-size:12px;letter-spacing:1px;text-transform:uppercase">verified presences · ${d.count.inRoom} in the room</div></div>
    ${d.rows.length ? d.rows.map(stamp).join('') : '<p class="mut">No stamps yet. Claim a spot and show up — it starts counting the moment you do.</p>'}
    <div class="prov">Real presence, beautifully counted. No points, no streaks.</div>
  `, { back: '/', nav: { active: 'you', guest: false, fanId: d.fanId } });
}

export function renderCheckin(d: { eventId: string; title: string; claimed: number; capacity: number | null; verifiedCount: number; result?: { ok: boolean; already?: boolean; fanName?: string } }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:12px;font:inherit';
  const banner = d.result
    ? (d.result.ok
      ? `<div class="card" style="border-color:#3fb950"><strong>${d.result.already ? 'Already checked in' : '✓ Checked in'}: ${esc(d.result.fanName ?? 'A fan')}</strong></div>`
      : `<div class="card" style="border-color:#e5484d"><strong>Not a valid pass.</strong></div>`)
    : '';
  return layout(`Check-in · ${d.title}`, `
    <style>${CSS}</style>
    <h1>Check-in</h1>
    <p class="mut">${esc(d.title)}</p>
    <div class="card"><b>${d.verifiedCount}</b> verified · <b>${d.claimed}</b> claimed${d.capacity ? ` · capacity ${d.capacity}` : ''}</div>
    ${banner}
    <form method="post" action="/e/${d.eventId}/check-in">
      <label class="mut" style="display:block;font-size:13px">Scan or enter the pass code<input class="mono" style="${inp}" name="token" autofocus autocomplete="off" placeholder="pass code from the fan"></label>
      <div class="row" style="margin-top:10px"><button type="submit">Verify presence</button></div>
    </form>
    <p class="mut" style="font-size:12px">Phone-only, no hardware. QR scanning + offline mode land with the Wallet pass.</p>
  `, { back: `/e/${d.eventId}`, nav: { active: 'you', guest: false, fanId: null } });
}

// The claim CTA block injected on the public event page — scarcity-forward.
export function claimCta(d: { eventId: string; remaining: number | null; full: boolean; mine: { status: string; token: string } | null; guest: boolean; priceLabel: string; mode: string; standing?: { have: number; need: number } }): string {
  if (d.mine) {
    return `<div class="card" style="border-color:var(--bone)"><strong>You're in.</strong> ${d.mine.status === 'waitlisted' ? "You're on the waitlist — we'll bump you if a spot opens." : d.mine.status === 'approved' ? 'Awaiting the host\'s approval.' : 'Your pass is ready.'}<div class="row" style="margin-top:8px"><a class="btn" href="/pass/${esc(d.mine.token)}">View your pass →</a></div></div>`;
  }
  const spots = d.remaining == null ? '' : `<div class="mut" style="font-size:13px;margin-bottom:8px">${d.full ? 'Full — join the waitlist' : `<strong>${d.remaining}</strong> spot${d.remaining === 1 ? '' : 's'} remaining`}</div>`;
  const gate = d.mode === 'standing' && d.standing && d.standing.have < d.standing.need
    ? `<div class="card"><strong>Earned access.</strong> This one opens at ${d.standing.need} verified presences with this crowd — you have ${d.standing.have}. Show up to unlock it.</div>`
    : `<form method="post" action="/claim/${d.eventId}">
        ${d.guest ? `<label class="mut" style="display:block;font-size:13px">Name<input name="name" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label><label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Email or phone<input name="contact" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label>` : ''}
        <div class="row" style="margin-top:10px"><button type="submit" style="font-size:16px;padding:12px 22px">${d.full ? 'Join the waitlist' : `Claim your spot${d.priceLabel && d.priceLabel !== 'Free' ? ' · ' + d.priceLabel : ''}`}</button></div>
      </form>`;
  return `<div class="card" style="border-color:var(--bone)">${spots}${gate}<p class="mut" style="font-size:11px;margin-top:8px">Your spot is identity‑bound and non‑transferable. No passwords — the claim is your account.</p></div>`;
}
