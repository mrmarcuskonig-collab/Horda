// otp_web.ts — the /verify-phone screens. Two steps: send a code, then enter it.
// Delivery goes through the OTP adapter (stub by default); in dev, when no real
// provider is wired, the code is shown on-screen so a developer can complete it.
import { layout, esc } from './layout.ts';

const INP = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:12px;font:inherit;letter-spacing:2px';

export function renderVerifyPhone(d: { stage: 'need_phone' | 'start' | 'code' | 'done'; phone?: string; error?: string; devCode?: string | null; back?: string }): string {
  let body = '';
  if (d.stage === 'done') {
    body = `<div class="card"><strong>Your number is verified ✓</strong><p class="mut" style="font-size:13px;margin-top:6px">Thanks — that keeps your identity solid across the clubs you follow.</p></div>`;
  } else if (d.stage === 'need_phone') {
    body = `<div class="card"><p class="mut">Add your phone number in <a href="/settings" style="border-bottom:1px solid var(--b)">Settings</a> first, then come back to verify it.</p></div>`;
  } else if (d.stage === 'start') {
    body = `<div class="card"><p class="mut">We'll send a 6-digit code to <b style="color:var(--bone)">${esc(d.phone ?? '')}</b>.</p>
      <form method="post" action="/verify-phone/start"><div class="row" style="margin-top:10px"><button type="submit">Send code</button></div></form></div>`;
  } else {
    body = `<div class="card"><p class="mut">Enter the 6-digit code we sent to <b style="color:var(--bone)">${esc(d.phone ?? '')}</b>.</p>
      ${d.devCode ? `<p class="mut" style="font-size:12px">Dev mode — no SMS provider wired. Your code: <b style="color:var(--bone)">${esc(d.devCode)}</b></p>` : ''}
      ${d.error ? `<p style="color:var(--acc);font-size:13px">${esc(d.error)}</p>` : ''}
      <form method="post" action="/verify-phone/confirm">
        <input type="hidden" name="phone" value="${esc(d.phone ?? '')}">
        <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" required placeholder="123456" style="${INP}">
        <div class="row" style="margin-top:10px"><button type="submit">Verify →</button></div>
      </form></div>`;
  }
  return layout('Verify your number', `<h1>Verify your number</h1>${body}`, { back: d.back ?? '/settings' });
}
