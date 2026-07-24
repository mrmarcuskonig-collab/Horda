// claim_web.ts — render surfaces for the claim rail: the pass (web/QR bridge
// until native Wallet), the fan Record, and the organizer check-in gate.
import { layout, esc } from './layout.ts';
import { inZone, zoneLabel } from './tz.ts';
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
  .bigcount{font-size:44px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px}
  .wal{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
  .walbtn{display:inline-flex;align-items:center;gap:7px;background:#000;color:#fff;border:1px solid rgba(255,255,255,.3);
    border-radius:9px;padding:9px 15px;font-size:13px;font-weight:600}
  .walbtn:hover{border-color:#fff}
  .walnote{color:var(--mut);font-size:11.5px;margin-top:8px;line-height:1.5}`;

// Add to Wallet — shown ONLY when the pass can actually be built.
//
// The old state here was a dead "＋ Add to Wallet — soon" chip. A ticket surface
// is the wrong place to advertise a plan: the fan taps it AT THE DOOR, with a
// queue behind them. Either the button works or it isn't there.
//
// Both wallets are gated on credentials that must be bought/registered (Apple:
// €99/yr Developer Program + Pass Type cert; Google: a Wallet issuer account) —
// see src/web/wallet.ts. Until those exist, this renders nothing at all, and the
// QR above is the ticket, exactly as it is today.
function walletRow(w: { google: string | null; apple: string | null } | undefined, isTicket: boolean): string {
  if (!isTicket || !w || (!w.google && !w.apple)) return '';
  const apple = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M16.4 12.8c0-2 1.6-3 1.7-3-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.4-1.9.8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.2zM14.5 6.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.1z"/></svg>`;
  const goog = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V9h-6a3 3 0 0 0 0 6h6v1.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Zm12 3h6v3h-6a1.5 1.5 0 0 1 0-3Z"/></svg>`;
  return `<div class="wal">
      ${w.apple ? `<a class="walbtn" href="${esc(w.apple)}">${apple} Add to Apple Wallet</a>` : ''}
      ${w.google ? `<a class="walbtn" href="${esc(w.google)}" target="_blank" rel="noopener">${goog} Save to Google Wallet</a>` : ''}
    </div>
    <p class="walnote">Works offline, on your lock screen — no signal, no login, no hunting for the tab.</p>`;
}

export function renderPass(d: {
  pass: PassView; verifyUrl: string; guest: boolean; fanId: string | null;
  /** Absent/null per wallet = that wallet isn't configured (no cert / no issuer). */
  wallet?: { google: string | null; apple: string | null };
}): string {
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
      <div class="passhd"><div class="k">Horda ${isTicket ? 'ticket' : 'pass'}</div><h1>${esc(p.eventTitle)}</h1>${/* The ticket MUST carry the venue's local time, with the zone spelled out.
     This used to be toLocaleString() with no zone — evaluated on the SERVER, so
     it printed the server's idea of the time to every fan on earth. */''}
<div class="mut" style="font-size:13px;margin-top:4px">${p.startsAt ? `${esc(inZone(p.startsAt, p.timezone))}${zoneLabel(p.startsAt, p.timezone) ? ` <b style="color:var(--bone)">${esc(zoneLabel(p.startsAt, p.timezone))}</b>` : ''}` : 'Time TBA'}</div>
${p.startsAt && p.timezone ? `<div class="mut" style="font-size:11.5px;margin-top:3px">Local time at the venue — set your alarm to this.</div>` : ''}</div>
      <div class="passbody">
        <div style="margin-bottom:12px">${statusTag}</div>
        ${p.formatLabel ? `<div class="mut" style="font-size:13px;margin-bottom:10px">Attending via <b style="color:var(--bone)">${esc(p.formatLabel)}</b></div>` : ''}
        ${isTicket ? qrBlock : linkBlock}
        ${walletRow(d.wallet, isTicket)}
        <div class="row" style="justify-content:center;margin-top:12px"><a class="tag mutd" href="/e/${p.eventId}">Change how you attend</a></div>
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
    <script>(function(){
      var stream=null, running=false, detector=null;
      function el(id){return document.getElementById(id);}
      // Accept the raw token whether the QR encodes just the code or a full URL.
      function extract(s){s=(s||'').trim();var u=s.match(/[?&]token=([0-9a-fA-F]{12,})/)||s.match(/\\/pass\\/([0-9a-fA-F]{12,})/);if(u)return u[1];var m=s.match(/[0-9a-fA-F]{12,}/);return m?m[0]:s;}
      function found(raw){
        if(!running)return; running=false;
        el('tokfield').value=extract(raw);
        if(stream){stream.getTracks().forEach(function(t){t.stop()});}
        el('scanmsg').textContent='Ticket read — checking in…';
        el('checkform').submit();
      }
      function stop(m){running=false;if(stream){stream.getTracks().forEach(function(t){t.stop()});}el('cam').style.display='none';el('scanbtn').style.display='';el('scanmsg').textContent=m;}
      window.hzScan=function(){
        var v=el('cam'),msg=el('scanmsg'),btn=el('scanbtn');
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.isSecureContext){
          msg.textContent='Camera needs a secure (https) connection — type the code below.';return;
        }
        btn.style.display='none';v.style.display='block';msg.textContent='Starting camera…';
        navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(s){
          stream=s;v.srcObject=s;v.setAttribute('playsinline','');v.muted=true;running=true;
          var start=function(){msg.textContent='Point the camera at the ticket QR — fill the frame.';loop();};
          v.onloadedmetadata=function(){var p=v.play();if(p&&p.catch)p.catch(function(){});start();};
          // Some browsers fire play readiness without loadedmetadata — belt & braces.
          if(v.readyState>=1){var p=v.play();if(p&&p.catch)p.catch(function(){});start();}
          // Native detector is far more reliable than a JS decoder where present.
          if('BarcodeDetector' in window){try{detector=new window.BarcodeDetector({formats:['qr_code']});}catch(e){detector=null;}}
        }).catch(function(err){
          stop(err&&err.name==='NotAllowedError'?'Camera blocked — allow access in your browser, or type the code below.':'Couldn’t open the camera — type the code below.');
        });
      };
      function loop(){
        if(!running)return;
        var v=el('cam');
        if(v.readyState>=2&&v.videoWidth){
          if(detector){
            detector.detect(v).then(function(codes){if(codes&&codes.length){found(codes[0].rawValue);}}).catch(function(){detector=null;});
          }
          if(!detector&&window.jsQR){
            var cv=el('cv'),ctx=cv.getContext('2d',{willReadFrequently:true});
            cv.width=v.videoWidth;cv.height=v.videoHeight;ctx.drawImage(v,0,0,cv.width,cv.height);
            try{var img=ctx.getImageData(0,0,cv.width,cv.height);var c=window.jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});if(c&&c.data)found(c.data);}catch(e){}
          }
        }
        if(running)requestAnimationFrame(loop);
      }
    })();</script>
  `, { back: `/e/${d.eventId}`, nav: { active: 'you', guest: false, fanId: null } });
}

// Multi-format attendance picker — one event, several ways to attend it, each
// confirmed on Horda so the organizer gets clean per-format counts. The fan
// commits to a single format (switching allowed). In-person can be ticketed;
// streams carry a watch link. Shown in place of the plain claim CTA when the
// organizer has defined formats.
export function formatPicker(d: {
  eventId: string; guest: boolean; full: boolean; fanId?: string | null; via?: string | null; promo?: string | null;
  /** The organiser sees their own inventory — spots-left is their number. */
  isHost?: boolean;
  formats: { id: string; kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; going: number;
    // Per-door capacity state + how many spots one person may take here.
    // Optional so older call sites keep working; absent = unlimited, 1 each.
    maxPerPerson?: number; remaining?: number | null; full?: boolean }[];
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
  // One BLOCK per door. A door says its price, how many spots are left in IT (a
  // full hall must not read as "event full" when the stream is open), and — when
  // the organiser allows it — lets one person take several spots.
  //
  // ONE FORM, not one per door. A guest types name + email ONCE; each door is a
  // submit button carrying its own format_id. A form per door (the obvious way
  // to get a per-door quantity) would make a guest fill in their details twice
  // on a hybrid event — worse than the problem it solves. So each door's
  // quantity posts as party_size_<formatId> and the server reads the one for the
  // door actually submitted.
  //
  // QUANTITY IS A STEPPER, NOT A DROPDOWN. Almost everyone takes one ticket, so
  // the default state is just the button — no decision, no interaction. Bringing
  // people is a "+" away, and the CTA re-reads live ("Get 3 tickets · €75") so
  // you always know what you're about to be charged before you commit.
  const stepFor = (f: typeof d.formats[number], ceiling: number) => ceiling <= 1 ? '' : `
    <div class="step" data-for="${f.id}">
      <span class="steplbl">Tickets</span>
      <div class="stepctl">
        <button type="button" class="stepbtn" data-d="-1" aria-label="One fewer">−</button>
        <input type="number" name="party_size_${f.id}" class="stepin" value="1" min="1" max="${ceiling}"
               inputmode="numeric" aria-label="How many tickets">
        <button type="button" class="stepbtn" data-d="1" aria-label="One more">+</button>
      </div>
    </div>`;

  // WHO SEES THE COUNTDOWN.
  //
  // Spots-left is a decision aid for someone deciding, and nothing else. Once
  // you're in, "3 left" answers a question you no longer have — and it does real
  // harm three ways: it reads as pressure aimed at a person who already paid; it
  // invites you to watch a number you can't act on; and when it drops it feels
  // like something is being taken from you rather than sold to someone.
  //
  // So: prospective attendees see it (it's true and it's useful), the organiser
  // sees it (it's their inventory), and someone who already claimed does not.
  const showCount = !d.mine || !!d.isHost;

  const doorFor = (f: typeof d.formats[number]) => {
    const maxPP = f.maxPerPerson ?? 1;
    const remaining = f.remaining ?? null;
    const isFull = f.full ?? d.full;
    const price = f.requiresTicket && f.priceCents ? money(f.priceCents) : 'Free';
    const paid = f.requiresTicket && !!f.priceCents;
    const label = isFull ? 'Join the waitlist'
      : f.kind === 'stream' ? (f.requiresTicket ? `Get access · ${price}` : `Stream on ${esc(f.label)}`)
      : (paid ? `Get ticket · ${price}` : "I'll be there");
    const left = (remaining == null || !showCount) ? '' : isFull ? 'Full' : `${remaining} left`;
    // Never offer more spots than are actually left, or the stepper promises
    // something the server will refuse.
    const ceiling = Math.min(maxPP, remaining == null ? maxPP : Math.max(1, remaining));
    return `<div class="door">
      <div class="dhead"><b>${esc(f.kind === 'stream' ? f.label : 'In person')}</b><span class="dmeta">${price}${left ? ` · ${left}` : ''}</span></div>
      ${isFull ? '' : stepFor(f, ceiling)}
      <button class="btn${f.kind === 'stream' ? ' ghost' : ''}" type="submit" name="format_id" value="${f.id}"
        style="width:100%;margin-top:9px" data-cta="${f.id}"
        data-unit="${paid ? f.priceCents : 0}" data-one="${esc(label)}"
        data-many="${paid ? 'Get {n} tickets · {total}' : "I'll bring {n}"}">${label}</button>
    </div>`;
  };
  const cantAttend = d.guest
    ? `<a class="btn ghost" href="/signup">Can’t attend</a>`
    : `<form method="post" action="/rsvp"><input type="hidden" name="fan_id" value="${esc(d.fanId ?? '')}"><input type="hidden" name="event_id" value="${esc(d.eventId)}"><input type="hidden" name="response" value="not_going"><button class="btn ghost" type="submit">Can’t attend</button></form>`;
  // "N going" STAYS for everyone, deliberately — including people who already
  // claimed. It is not scarcity, it's the crowd: how many people you'll be
  // standing with. That's the reason to be there, and it only grows.
  //
  // The distinction is the whole point of the rule: hide the number that counts
  // DOWN toward a door closing, keep the number that counts UP toward a room
  // filling.
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
    : `<form method="post" action="${claimAction}">${guestFields}
         <div class="notyet">${d.formats.length > 1 ? 'Choose how you want to be there:' : "You're not attending yet."}</div>
         <div class="doors opts">${d.formats.map(doorFor).join('')}</div>
       </form>
       <div class="opts" style="margin-top:10px">${cantAttend}</div>`;
  return `<section class="card"><h2>Attend</h2>${inner}${summary}
    <style>.notyet{color:var(--mut);margin-bottom:10px}.opts{display:flex;gap:8px;flex-wrap:wrap}.opts form{display:inline}.going{font-weight:800}
      .doors{display:grid;gap:10px}
      .door{border:1px solid var(--b);border-radius:14px;padding:13px 14px;background:var(--s)}
      .door .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
      .door .dhead b{font-size:15px}
      .door .dmeta{color:var(--mut);font-size:12.5px}
      /* The stepper: quiet by default (almost everyone takes one), one tap to
         bring someone. Tabular numerals so the count doesn't jitter on change. */
      .step{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
      .step .steplbl{color:var(--mut);font-size:13px}
      .stepctl{display:inline-flex;align-items:center;border:1px solid var(--b);border-radius:999px;background:var(--ink);overflow:hidden}
      .stepbtn{width:34px;height:34px;border:0;background:transparent;color:var(--bone);font-size:17px;line-height:1;cursor:pointer;padding:0;
        display:flex;align-items:center;justify-content:center;transition:background .12s}
      .stepbtn:hover:not(:disabled){background:rgba(237,233,223,.08)}
      .stepbtn:disabled{color:var(--mut);opacity:.35;cursor:default}
      .stepin{width:34px;height:34px;border:0;background:transparent;color:var(--bone);text-align:center;font:inherit;font-size:15px;font-weight:700;
        font-variant-numeric:tabular-nums;padding:0;-moz-appearance:textfield}
      .stepin::-webkit-outer-spin-button,.stepin::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
      .stepin:focus{outline:none}
    </style>
    <script>(function(){
      // Live stepper. The CTA re-reads as you add people ("Get 3 tickets · €75")
      // so the price is never a surprise at checkout.
      function eur(c){ return '€' + (c/100).toFixed(2).replace(/\.00$/, ''); }
      function sync(box){
        var id = box.getAttribute('data-for');
        var input = box.querySelector('.stepin');
        var n = Math.max(1, Math.min(+input.max || 1, +input.value || 1));
        input.value = n;
        box.querySelector('[data-d="-1"]').disabled = n <= 1;
        box.querySelector('[data-d="1"]').disabled  = n >= (+input.max || 1);
        var cta = document.querySelector('[data-cta="' + id + '"]');
        if (!cta) return;
        var unit = +cta.getAttribute('data-unit') || 0;
        cta.textContent = n === 1
          ? cta.getAttribute('data-one')
          : cta.getAttribute('data-many').replace('{n}', n).replace('{total}', eur(unit * n));
      }
      [].forEach.call(document.querySelectorAll('.step'), function(box){
        box.addEventListener('click', function(e){
          var b = e.target.closest('.stepbtn'); if (!b) return;
          e.preventDefault();                       // never submits the form
          var input = box.querySelector('.stepin');
          input.value = (+input.value || 1) + (+b.getAttribute('data-d'));
          sync(box);
        });
        // Typing straight into the field is allowed; clamp on the way out.
        box.querySelector('.stepin').addEventListener('input', function(){ sync(box); });
        sync(box);
      });
    })();</script>
  </section>`;
}

// The claim CTA block injected on the public event page — scarcity-forward.
//
// `ways` = the doors on this event. When there's more than one (a hybrid: be in
// the room OR watch the stream) the FAN chooses, and each door carries its own
// price and its own remaining count. When the chosen door lets one person take
// several spots, a quantity picker appears. Previously this block rendered a
// single button regardless, so on a hybrid event a fan could only ever take
// whichever door the code happened to assume.
export function claimCta(d: { eventId: string; remaining: number | null; full: boolean; mine: { status: string; token: string } | null; guest: boolean; priceLabel: string; mode: string; accessMode?: string; via?: string | null; promo?: string | null; standing?: { have: number; need: number };
  ways?: { id: string; kind: string; label: string; requiresTicket: boolean; priceCents: number | null; capacity: number | null; maxPerPerson: number; going: number; remaining: number | null; full: boolean }[] }): string {
  const claimAction = `/claim/${d.eventId}${d.promo ? `?p=${encodeURIComponent(d.promo)}` : d.via ? `?via=${encodeURIComponent(d.via)}` : ''}`;
  const isLink = d.accessMode === 'link';
  const paid = !!d.priceLabel && d.priceLabel !== 'Free';
  // Verb matches how they get in: link = "Get access", ticket = claim/get ticket.
  const verb = d.full ? 'Join the waitlist' : isLink ? (paid ? `Get access · ${d.priceLabel}` : 'Get access') : (paid ? `Get ticket · ${d.priceLabel}` : 'Claim your spot');
  // Already in → no spots-left anywhere below. Same rule as formatPicker: the
  // countdown is for people deciding, not for people who've decided.
  if (d.mine) {
    return `<div class="card" style="border-color:var(--bone)"><strong>You're in.</strong> ${d.mine.status === 'waitlisted' ? "You're on the waitlist — we'll bump you if a spot opens." : d.mine.status === 'approved' ? 'Awaiting the host\'s approval.' : isLink ? 'Your access is ready.' : 'Your ticket is ready.'}<div class="row" style="margin-top:8px"><a class="btn" href="/pass/${esc(d.mine.token)}">${isLink ? 'Get the link →' : 'View your ticket →'}</a></div></div>`;
  }
  const ways = d.ways ?? [];
  const eur = (c: number) => `€${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const guestF = d.guest ? `<label class="mut" style="display:block;font-size:13px">Name<input name="name" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label><label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Email or phone<input name="contact" required style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit"></label>` : '';

  // Scarcity is per DOOR once there's more than one — "3 spots remaining" over a
  // hybrid event is meaningless when the stream is unlimited.
  const spots = ways.length > 1 || d.remaining == null ? '' : `<div class="mut" style="font-size:13px;margin-bottom:8px">${d.full ? 'Full — join the waitlist' : `<strong>${d.remaining}</strong> spot${d.remaining === 1 ? '' : 's'} remaining`}</div>`;

  const qtyFor = (w: { id: string; maxPerPerson: number; remaining: number | null }) => {
    // Never offer more spots than are actually left, or the picker promises
    // something the server will refuse.
    const ceiling = Math.min(w.maxPerPerson, w.remaining == null ? w.maxPerPerson : Math.max(1, w.remaining));
    if (ceiling <= 1) return '';
    const opts = Array.from({ length: ceiling }, (_, i) => `<option value="${i + 1}">${i + 1 === 1 ? 'Just me' : `${i + 1} people`}</option>`).join('');
    return `<label class="qty">How many? <select name="party_size">${opts}</select></label>`;
  };

  const doorBlock = (w: NonNullable<typeof d.ways>[number]) => {
    const price = w.requiresTicket && w.priceCents ? eur(w.priceCents) : 'Free';
    const label = w.full ? 'Join the waitlist' : w.kind === 'stream' ? (w.requiresTicket ? `Get access · ${price}` : 'Claim your spot to watch') : (w.requiresTicket ? `Get ticket · ${price}` : 'Claim your spot');
    const left = w.remaining == null ? (w.kind === 'stream' ? 'Unlimited' : '') : w.full ? 'Full' : `${w.remaining} left`;
    return `<form method="post" action="${claimAction}" class="door">
      <input type="hidden" name="format_id" value="${esc(w.id)}">
      ${guestF}
      <div class="dhead"><b>${esc(w.kind === 'stream' ? w.label : 'In person')}</b><span class="dmeta">${price}${left ? ` · ${left}` : ''}</span></div>
      ${qtyFor(w)}
      <button type="submit" class="${w.kind === 'stream' ? 'btn ghost' : 'btn'}" style="width:100%;margin-top:8px">${label}</button>
    </form>`;
  };

  const gate = d.mode === 'standing' && d.standing && d.standing.have < d.standing.need
    ? `<div class="card"><strong>Earned access.</strong> This one opens at ${d.standing.need} verified presences with this crowd — you have ${d.standing.have}. Show up to unlock it.</div>`
    : ways.length
      ? `${ways.length > 1 ? '<div class="mut" style="font-size:13px;margin-bottom:9px">Choose how you want to be there:</div>' : ''}
         <div class="doors">${ways.map(doorBlock).join('')}</div>`
      // No doors defined (legacy events, sub-events): the original single button.
      : `<form method="post" action="${claimAction}">${guestF}
          <div class="row" style="margin-top:10px"><button type="submit" style="font-size:16px;padding:12px 22px">${verb}</button></div>
        </form>`;
  const note = isLink ? 'No passwords — your details unlock the link, saved to your account.' : 'Identity‑bound and non‑transferable — you get a QR ticket to show at the door.';
  return `<div class="card" style="border-color:var(--bone)">${spots}${gate}<p class="mut" style="font-size:11px;margin-top:8px">${note}</p>
    <style>
      .doors{display:grid;gap:10px}
      .door{border:1px solid var(--b);border-radius:14px;padding:13px 14px;background:var(--s)}
      .door .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
      .door .dhead b{font-size:15px}
      .door .dmeta{color:var(--mut);font-size:12.5px}
      .door .qty{display:flex;align-items:center;gap:8px;margin-top:9px;color:var(--mut);font-size:13px}
      .door .qty select{background:var(--ink);border:1px solid var(--b);border-radius:9px;color:var(--bone);padding:7px 9px;font:inherit;font-size:13.5px}
    </style></div>`;
}
