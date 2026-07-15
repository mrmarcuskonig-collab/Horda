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
  const isStream = p.formatKind === 'stream';
  // Ticket mode = show a scannable QR at the door. Link mode = just reveal the link.
  const isTicket = !isStream && p.accessMode !== 'link';
  const accessLink = isStream ? p.channelUrl : (p.location && /^https?:\/\//i.test(p.location) ? p.location : null);
  const statusTag = p.verified
    ? `<span class="passtag ok">✓ Verified — you were there</span>`
    : p.status === 'waitlisted' ? `<span class="passtag">Waitlisted</span>`
      : p.status === 'approved' ? `<span class="passtag">Awaiting approval</span>`
        : isTicket ? `<span class="passtag">Ticket · show this QR at the door</span>` : `<span class="passtag">You're in</span>`;
  // Client-side QR of the raw token — the organizer's scanner reads it → check-in.
  const qrBlock = `<div class="qrwrap"><div id="hzqr"></div></div>
    <p class="mut" style="font-size:12.5px;margin:10px 0 2px">Show this QR at the door — the organizer scans it to check you in.</p>
    <details style="margin-top:6px"><summary class="mut" style="font-size:12px;cursor:pointer">Can't scan? Show the code</summary><div class="code" style="margin-top:8px">${esc(p.token.replace(/(.{4})/g, '$1 ').trim())}</div></details>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>(function(){function d(){if(!window.QRCode){return setTimeout(d,120)}var el=document.getElementById('hzqr');if(el&&!el.hasChildNodes()){new QRCode(el,{text:${JSON.stringify(p.token)},width:208,height:208,colorDark:'#0B0B0C',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M})}}d()})();</script>`;
  const linkBlock = accessLink
    ? `<a class="rb p" style="display:block;margin:0 0 8px;padding:13px" href="${esc(accessLink)}" target="_blank" rel="noopener">${isStream ? `Watch on ${esc(p.formatLabel || 'the stream')} ↗` : 'Open the event link ↗'}</a><p class="mut" style="font-size:12px">Saved to your pass — we'll send it again before it starts.</p>`
    : `<div class="mut" style="font-size:13.5px">${p.location ? `Where: <b style="color:var(--bone)">${esc(p.location)}</b>` : 'The organizer will share the details here.'}</div>`;
  return layout(`Your pass · ${p.eventTitle}`, `
    <style>${CSS}
      .qrwrap{background:#fff;padding:14px;border-radius:14px;display:inline-block;margin:4px 0 2px}
      #hzqr img,#hzqr canvas{display:block}
    </style>
    <div class="pass">
      <div class="passhd"><div class="k">Horda ${isTicket ? 'ticket' : 'pass'}</div><h1>${esc(p.eventTitle)}</h1><div class="mut" style="font-size:13px;margin-top:4px">${esc(p.startsAt ? new Date(p.startsAt).toLocaleString() : 'Time TBA')}</div></div>
      <div class="passbody">
        <div style="margin-bottom:12px">${statusTag}</div>
        ${p.formatLabel ? `<div class="mut" style="font-size:13px;margin-bottom:10px">Attending via <b style="color:var(--bone)">${esc(p.formatLabel)}</b></div>` : ''}
        ${isTicket ? qrBlock : linkBlock}
        <div class="row" style="justify-content:center;margin-top:12px"><a class="tag mutd" href="/e/${p.eventId}">Change how you attend</a><span class="tag mutd">＋ Add to Wallet — soon</span></div>
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
    <style>${CSS}
      .scanbox{border:1px solid var(--b);border-radius:14px;background:var(--s);padding:14px;margin:12px 0}
      #cam{width:100%;max-width:420px;border-radius:12px;background:#000;display:none}
      .scanbtn{display:inline-flex;align-items:center;gap:8px}
    </style>
    <h1>Check-in</h1>
    <p class="mut">${esc(d.title)}</p>
    <div class="card"><b>${d.verifiedCount}</b> checked in · <b>${d.claimed}</b> registered${d.capacity ? ` · capacity ${d.capacity}` : ''}</div>
    ${banner}
    <div class="scanbox">
      <button type="button" id="scanbtn" class="scanbtn" onclick="hzScan()">📷 Scan a QR ticket</button>
      <div id="scanmsg" class="mut" style="font-size:12.5px;margin-top:8px">Point your camera at the fan's ticket QR — it checks them in automatically.</div>
      <video id="cam" playsinline muted></video>
      <canvas id="cv" style="display:none"></canvas>
    </div>
    <form id="checkform" method="post" action="/e/${d.eventId}/check-in">
      <label class="mut" style="display:block;font-size:13px">…or enter the code by hand<input id="tokfield" class="mono" style="${inp}" name="token" autocomplete="off" placeholder="pass code from the fan"></label>
      <div class="row" style="margin-top:10px"><button type="submit">Check in</button></div>
    </form>
    <p class="mut" style="font-size:12px">Phone-only, no hardware. If a fan can't show a QR, type their code. Offline queueing lands with the Wallet pass.</p>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js"></script>
    <script>(function(){var stream=null;window.hzScan=function(){
      var v=document.getElementById('cam'),cv=document.getElementById('cv'),msg=document.getElementById('scanmsg'),btn=document.getElementById('scanbtn');
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg.textContent='Camera not available on this device — type the code below.';return}
      btn.style.display='none';v.style.display='block';msg.textContent='Scanning… point at the QR';
      navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){
        stream=s;v.srcObject=s;v.setAttribute('playsinline',true);v.play();
        var ctx=cv.getContext('2d');
        function tick(){
          if(v.readyState===v.HAVE_ENOUGH_DATA&&window.jsQR){
            cv.width=v.videoWidth;cv.height=v.videoHeight;ctx.drawImage(v,0,0,cv.width,cv.height);
            var img=ctx.getImageData(0,0,cv.width,cv.height);
            var code=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});
            if(code&&code.data){
              var t=(code.data||'').trim();var m=t.match(/[0-9a-fA-F]{16,}/);if(m)t=m[0];
              document.getElementById('tokfield').value=t;
              if(stream){stream.getTracks().forEach(function(tr){tr.stop()})}
              document.getElementById('checkform').submit();return;
            }
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }).catch(function(){msg.textContent='Camera blocked — allow access or type the code below.';btn.style.display='';v.style.display='none';});
    };})();</script>
  `, { back: `/e/${d.eventId}`, nav: { active: 'you', guest: false, fanId: null } });
}

// Multi-format attendance picker — one event, several ways to attend it, each
// confirmed on Horda so the organizer gets clean per-format counts. The fan
// commits to a single format (switching allowed). In-person can be ticketed;
// streams carry a watch link. Shown in place of the plain claim CTA when the
// organizer has defined formats.
export function formatPicker(d: {
  eventId: string; guest: boolean; full: boolean; fanId?: string | null; via?: string | null; promo?: string | null;
  formats: { id: string; kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; going: number }[];
  mine: { status: string; token: string; formatId: string | null } | null;
}): string {
  const claimAction = `/claim/${d.eventId}${d.promo ? `?p=${encodeURIComponent(d.promo)}` : d.via ? `?via=${encodeURIComponent(d.via)}` : ''}`;
  // Same logic + design as the athlete profile "Next up" block: a .card with a
  // "You're not attending yet." line and an .opts row of buttons (primary .btn for
  // in-person, .btn ghost for streams), or a bold .going note once you're in.
  const money = (c: number) => `€${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--ink);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const guestFields = d.guest
    ? `<label class="mut" style="display:block;font-size:13px;margin-bottom:8px">Name<input name="name" required style="${inp}"></label><label class="mut" style="display:block;font-size:13px;margin-bottom:12px">Email<input name="contact" type="email" required style="${inp}"></label>`
    : '';
  // One button per way to attend. NONE is filled/pre-selected — a filled button
  // would read as "already registered". They're outlined actions; the in-person
  // option gets a subtle emphasis (fmt-primary) without looking chosen.
  const btnFor = (f: typeof d.formats[number]) => {
    const label = f.kind === 'stream'
      ? `Stream on ${esc(f.label)}`
      : (f.requiresTicket && f.priceCents ? `Get ticket · ${money(f.priceCents)}` : "I'll be there");
    return `<button class="btn ghost${f.kind === 'stream' ? '' : ' fmt-primary'}" type="submit" name="format_id" value="${f.id}">${label}</button>`;
  };
  const cantAttend = d.guest
    ? `<a class="btn ghost" href="/signup">Can’t attend</a>`
    : `<form method="post" action="/rsvp"><input type="hidden" name="fan_id" value="${esc(d.fanId ?? '')}"><input type="hidden" name="event_id" value="${esc(d.eventId)}"><input type="hidden" name="response" value="not_going"><button class="btn ghost" type="submit">Can’t attend</button></form>`;
  const going = d.formats.filter(f => f.kind !== 'stream').reduce((a, f) => a + f.going, 0);
  const watching = d.formats.filter(f => f.kind === 'stream').reduce((a, f) => a + f.going, 0);
  const summary = `<div class="ws" style="margin-top:10px;color:var(--mut);font-size:12.5px"><b>${going}</b> going${watching ? ` · <b>${watching}</b> streaming` : ''}</div>`;
  // Already in → a bold .going note (wording mirrors the profile block) + watch link + pass.
  const mineFmt = d.mine ? d.formats.find(f => f.id === d.mine!.formatId) : null;
  const goingNote = mineFmt && mineFmt.kind === 'stream' ? "You're streaming this" : (mineFmt && mineFmt.requiresTicket ? "You're ticketed — see you there" : "You're going");
  const inner = d.mine
    ? `<div class="going">${goingNote} ✓</div>
       ${mineFmt && mineFmt.kind === 'stream' && mineFmt.channelUrl ? `<div class="opts" style="margin-top:10px"><a class="btn ghost" href="${esc(mineFmt.channelUrl)}" target="_blank" rel="noopener">Watch on ${esc(mineFmt.label)} ↗</a></div>` : ''}
       <div class="opts" style="margin-top:10px"><a class="btn" href="/pass/${esc(d.mine.token)}">View your pass →</a></div>`
    : `<form method="post" action="${claimAction}">${guestFields}<div class="notyet">You're not attending yet.</div><div class="opts">${d.formats.map(btnFor).join('')}</div></form>
       <div class="opts" style="margin-top:8px">${cantAttend}</div>`;
  return `<section class="card"><h2>Attend</h2>${inner}${summary}
    <style>.notyet{color:var(--mut);margin-bottom:10px}.opts{display:flex;gap:8px;flex-wrap:wrap}.opts form{display:inline}.going{font-weight:800}.btn.fmt-primary{box-shadow:inset 0 0 0 1px var(--bone)}</style>
  </section>`;
}

// The claim CTA block injected on the public event page — scarcity-forward.
export function claimCta(d: { eventId: string; remaining: number | null; full: boolean; mine: { status: string; token: string } | null; guest: boolean; priceLabel: string; mode: string; accessMode?: string; via?: string | null; promo?: string | null; standing?: { have: number; need: number } }): string {
  const claimAction = `/claim/${d.eventId}${d.promo ? `?p=${encodeURIComponent(d.promo)}` : d.via ? `?via=${encodeURIComponent(d.via)}` : ''}`;
  const isLink = d.accessMode === 'link';
  const paid = !!d.priceLabel && d.priceLabel !== 'Free';
  // Verb matches how they get in: link = "Get access", ticket = claim/get ticket.
  const verb = d.full ? 'Join the waitlist' : isLink ? (paid ? `Get access · ${d.priceLabel}` : 'Get access') : (paid ? `Get ticket · ${d.priceLabel}` : 'Claim your spot');
  if (d.mine) {
    return `<div class="card" style="border-color:var(--bone)"><strong>You're in.</strong> ${d.mine.status === 'waitlisted' ? "You're on the waitlist — we'll bump you if a spot opens." : d.mine.status === 'approved' ? 'Awaiting the host\'s approval.' : isLink ? 'Your access is ready.' : 'Your ticket is ready.'}<div class="row" style="margin-top:8px"><a class="btn" href="/pass/${esc(d.mine.token)}">${isLink ? 'Get the link →' : 'View your ticket →'}</a></div></div>`;
  }
  const spots = d.remaining == null ? '' : `<div class="mut" style="font-size:13px;margin-bottom:8px">${d.full ? 'Full — join the waitlist' : `<strong>${d.remaining}</strong> spot${d.remaining === 1 ? '' : 's'} remaining`}</div>`;
  const gate = d.mode === 'standing' && d.standing && d.standing.have < d.standing.need
    ? `<div class="card"><strong>Earned access.</strong> This one opens at ${d.standing.need} verified presences with this crowd — you have ${d.standing.have}. Show up to unlock it.</div>`
    : `<form method="post" action="${claimAction}">
        ${d.guest ? `<label class="mut" style="display:block;font-size:13px">Name<input name="name" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label><label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Email or phone<input name="contact" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label>` : ''}
        <div class="row" style="margin-top:10px"><button type="submit" style="font-size:16px;padding:12px 22px">${verb}</button></div>
      </form>`;
  const note = isLink ? 'No passwords — your details unlock the link, saved to your account.' : 'Identity‑bound and non‑transferable — you get a QR ticket to show at the door.';
  return `<div class="card" style="border-color:var(--bone)">${spots}${gate}<p class="mut" style="font-size:11px;margin-top:8px">${note}</p></div>`;
}
