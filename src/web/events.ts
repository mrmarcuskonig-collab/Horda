// events.ts — Luma-adapted event layer: admission (open/register/apply/paid),
// payment checkout, online watch channels, cross-posting (feature), and host
// management with approvals. Built on the shared dark layout().
import { layout, esc } from './layout.ts';
import { UPLOAD_SCRIPT } from './shell.ts';
import { shareButton } from './theme.ts';
import { type EventDetail, priceLabel } from '../db/events_repo.ts';

const hostHref = (kind: string | null, id: string | null) =>
  kind === 'athlete' ? `/athlete/${id}` : kind === 'team' ? `/team/${id}` : kind === 'association' ? `/association/${id}` : `/club/${id}`;
const money = (c: number, cur = 'EUR') => `${cur === 'EUR' ? '€' : cur + ' '}${(c / 100).toFixed(2).replace(/\.00$/, '')}`;

const ADMISSION_LABEL: Record<string, string> = {
  open: 'Open · free to all', register: 'Free · registration required', apply: 'Approval required', paid: 'Ticketed',
};

export function renderEventPage(d: EventDetail, ctx: {
  guest: boolean; fanId: string | null; myRsvp: { response: string; status: string } | null;
  isHost?: boolean; myEntities?: { kind: string; id: string; name: string }[];
  myTicket?: { id: string; status: string; listPriceCents: number | null } | null;
  listings?: { id: string; priceCents: number; seller: string }[];
  extraTop?: string;
  stickyCta?: string;
}): string {
  const my = ctx.myRsvp;
  const cover = d.coverUrl
    ? `<img src="${esc(d.coverUrl)}" alt="" style="width:100%;height:200px;object-fit:cover;border-radius:14px;border:1px solid var(--b)">`
    : `<div style="height:160px;border-radius:14px;border:1px solid var(--b);background:radial-gradient(120% 120% at 70% 20%,rgba(237,233,223,.10),transparent 60%),var(--ink);display:flex;align-items:flex-end;padding:14px;font-weight:800;letter-spacing:6px;text-transform:uppercase;color:rgba(237,233,223,.25)">${esc(d.hostName)}</div>`;

  // form-button for an RSVP response
  const respForm = (resp: string, label: string, primary = false) =>
    ctx.guest ? `<a class="rb${primary ? ' p' : ''}" href="/signup">${esc(label)}</a>`
      : `<form method="post" action="/rsvp"><input type="hidden" name="fan_id" value="${ctx.fanId}"><input type="hidden" name="event_id" value="${d.id}"><input type="hidden" name="response" value="${resp}"><button class="rb${primary ? ' p' : ''}${my?.response === resp ? ' on' : ''}" type="submit">${my?.response === resp && resp !== 'going' ? '✓ ' : ''}${esc(label)}</button></form>`;
  const linkBtn = (label: string, href: string, primary = false) =>
    `<a class="rb${primary ? ' p' : ''}" href="${ctx.guest ? '/signup' : href}">${esc(label)}</a>`;

  // admission-specific primary action
  let primary = '';
  const goingConfirmed = my?.response === 'going' && (my.status === 'confirmed' || my.status === 'paid');
  if (goingConfirmed) {
    primary = `<div class="myr"><b>You're in ✓</b>${my!.status === 'paid' ? ' · ticket confirmed' : ''}</div>`;
  } else if (my?.response === 'going' && my.status === 'pending') {
    primary = `<div class="myr"><b>${d.admission === 'paid' ? 'Payment pending' : 'Application pending'}</b> — the host will confirm.${d.admission === 'paid' ? ` <a class="rb p" href="/e/${d.id}/checkout">Complete payment</a>` : ''}</div>`;
  } else if (d.admission === 'paid') {
    primary = linkBtn(`Get ticket · ${priceLabel(d)}`, `/e/${d.id}/checkout`, true);
  } else if (d.admission === 'apply') {
    primary = respForm('going', 'Apply to attend', true);
  } else if (d.admission === 'register') {
    primary = respForm('going', 'Register — free', true);
  } else {
    primary = respForm('going', "I'm going", true);
  }

  const secondary = `${respForm('not_going', "Can't go")} ${respForm('interested', 'Interested')}`;

  // watch live (online) — YouTube / Twitch / Instagram / TikTok / Discord
  const ch = d.streams || {};
  const watch = [
    ch.youtube ? linkBtn('Watch on YouTube ↗', ch.youtube) : '',
    ch.twitch ? linkBtn('Watch on Twitch ↗', ch.twitch) : '',
    ch.instagram ? linkBtn('Watch on Instagram ↗', ch.instagram) : '',
    ch.tiktok ? linkBtn('Watch on TikTok ↗', ch.tiktok) : '',
    ch.discord ? linkBtn('Watch in Discord ↗', ch.discord) : '',
  ].filter(Boolean).join('');

  // ticket: hold → gift / sell; plus any resale listings
  let ticketSection = '';
  const t = ctx.myTicket;
  if (t) {
    ticketSection = `<div class="h3">Your ticket</div>
      <div class="tk">🎟 You hold a ticket${t.status === 'listed' ? ` · listed for ${money(t.listPriceCents ?? 0, d.currency)}` : ''}</div>
      <div class="rsvp">
        <form method="post" action="/ticket/gift"><input type="hidden" name="ticket_id" value="${t.id}"><input type="hidden" name="event_id" value="${d.id}"><input name="to_handle" placeholder="@handle" class="tkin"><button class="rb" type="submit">Gift</button></form>
        <form method="post" action="/ticket/list"><input type="hidden" name="ticket_id" value="${t.id}"><input type="hidden" name="event_id" value="${d.id}"><input name="price" type="number" min="0" step="0.5" placeholder="resell €" class="tkin"><button class="rb" type="submit">Sell</button></form>
      </div>`;
  }
  const listings = (ctx.listings ?? []).filter(l => !t || true);
  const resaleSection = listings.length
    ? `<div class="h3">Resale</div><div class="rsvp">${listings.map(l => ctx.guest
        ? `<a class="rb" href="/signup">${money(l.priceCents, d.currency)} · ${esc(l.seller)}</a>`
        : `<form method="post" action="/ticket/buy"><input type="hidden" name="ticket_id" value="${l.id}"><input type="hidden" name="event_id" value="${d.id}"><input type="hidden" name="fan_id" value="${ctx.fanId}"><button class="rb p" type="submit">Buy ${money(l.priceCents, d.currency)} · from ${esc(l.seller)}</button></form>`).join('')}</div>`
    : '';

  const extras = [shareButton({ title: d.title, cls: 'rb' }), `<a class="rb" href="/e/${d.id}/ics">＋ Add to calendar</a>`];
  if (ctx.isHost) extras.push(`<a class="rb" href="/manage/${d.id}">Manage</a>`);

  // cross-post: feature this event on one of your own profiles
  const featurable = (ctx.myEntities ?? []).filter(e => !(e.kind === d.hostKind && e.id === d.hostId));
  const feature = (!ctx.guest && featurable.length)
    ? `<div class="cap" style="margin-top:18px">Share on your profile</div><div class="rsvp">${featurable.map(e =>
        `<form method="post" action="/feature"><input type="hidden" name="feat_kind" value="${e.kind}"><input type="hidden" name="feat_id" value="${e.id}"><input type="hidden" name="event_id" value="${d.id}"><button class="rb" type="submit">Feature on ${esc(e.name.split(' ')[0])}</button></form>`).join('')}</div>` : '';

  // date chip (Luma-style calendar square) from the ISO start
  const dt = d.startsAt ? new Date(d.startsAt) : null;
  const mon = dt ? dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase() : '';
  const day = dt ? dt.getUTCDate() : '';
  const mapsHref = d.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.location)}` : null;

  // host follow (matches Luma's "Folgen")
  const followBtn = ctx.guest
    ? `<a class="rb sm" href="/signup">Follow</a>`
    : `<form method="post" action="/follow"><input type="hidden" name="fan_id" value="${ctx.fanId}"><input type="hidden" name="target_type" value="${d.hostKind}"><input type="hidden" name="target_id" value="${d.hostId}"><button class="rb sm" type="submit">Follow</button></form>`;

  const ICON = {
    cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 21c4-4.5 6-7.9 6-10.7a6 6 0 1 0-12 0C6 13.1 8 16.5 12 21Z"/><circle cx="12" cy="10.4" r="2.2"/></svg>`,
  };

  const body = `
  <style>
    .evgrid{display:grid;grid-template-columns:300px 1fr;gap:30px;align-items:start;margin-top:6px}
    @media(max-width:680px){.evgrid{grid-template-columns:1fr;gap:18px}}
    .evside{position:sticky;top:66px}
    @media(max-width:680px){.evside{position:static}}
    .evcover{width:100%;aspect-ratio:1/1;border-radius:16px;border:1px solid var(--b);object-fit:cover;display:block;background:var(--s)}
    .evcover.ph{display:flex;align-items:flex-end;padding:16px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:var(--mut);background:radial-gradient(120% 120% at 70% 20%,var(--s),transparent 60%),var(--ink)}
    .hostrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--b)}
    .hk{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
    .hn{font-weight:600;font-size:15px}.hn a:hover{border-bottom:1px solid var(--b)}
    .sidelinks{margin-top:14px;display:flex;flex-direction:column;gap:9px;font-size:13px;color:var(--mut)}
    .sidelinks a:hover{color:var(--bone)}
    .evtag{display:inline-block;margin-top:14px;font-size:12px;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:4px 12px}
    .evtitle{font-size:30px;line-height:1.12;font-weight:600;letter-spacing:-.02em;margin:0 0 16px}
    .ww{display:flex;gap:13px;align-items:center;padding:9px 0}
    .ww .wi{width:42px;height:42px;flex:0 0 auto;border:1px solid var(--b);border-radius:11px;display:flex;align-items:center;justify-content:center;color:var(--bone)}
    .ww .wi svg{width:21px;height:21px}
    .ww .cal{flex-direction:column;gap:0;font-weight:600;line-height:1}.ww .cal .m{font-size:9px;letter-spacing:1px;color:var(--mut)}.ww .cal .d{font-size:17px}
    .ww .wt{font-size:14.5px;font-weight:500}.ww .ws{font-size:12.5px;color:var(--mut);margin-top:1px}
    .ww .ws a{border-bottom:1px solid var(--b)}
    .regcard{border:1px solid var(--b);border-radius:16px;background:var(--s);padding:16px;margin:18px 0}
    .regcard .rt{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:600;border-bottom:1px solid var(--b);padding-bottom:9px;margin-bottom:12px}
    .regcard .rsub{font-size:13.5px;color:var(--mut);margin-bottom:12px}
    .h3{font-size:11.5px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;color:var(--bone);margin:22px 0 9px}
    .desc{font-size:15px;line-height:1.65;margin:8px 0 0;white-space:pre-wrap}
    .rsvp{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}form{display:inline}
    .rb{display:inline-block;font:inherit;font-size:14px;font-weight:600;border:1px solid var(--b);color:var(--bone);background:transparent;border-radius:999px;padding:9px 16px;cursor:pointer;text-decoration:none}
    .rb:hover{border-color:var(--bone)}
    .rb.sm{font-size:12.5px;padding:6px 13px}
    /* primary = an action to take (outlined, emphasized); on = your current selection (filled) */
    .rb.p{background:transparent;color:var(--bone);border-color:var(--bone);font-weight:700}.rb.p:hover{background:rgba(237,233,223,.08)}
    .rb.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}
    .rb.block{display:block;width:100%;text-align:center;padding:12px;font-size:15px}
    .myr{font-size:14px;margin:4px 0}.admtag{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;border:1px solid var(--b);color:var(--mut);border-radius:999px;padding:3px 10px}
    .tk{font-weight:600;margin:6px 0 10px}.tkin{background:var(--ink);border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:8px 12px;font:inherit;width:120px;margin-right:6px}
  </style>
  <div class="poster">
    ${d.coverUrl ? `<img src="${esc(d.coverUrl)}" alt="">` : `<div style="width:100%;height:100%;background:radial-gradient(130% 130% at 70% 8%,rgba(237,233,223,.12),transparent 55%),var(--ink)"></div>`}
    <div class="pcap">
      <span class="pkick">${esc(ADMISSION_LABEL[d.admission])}</span>
      <div class="ptitle">${esc(d.title)}</div>
      <div class="pmeta">${d.date ? `<span>${esc(d.date)}${d.time ? ` · ${esc(d.time)}` : ''}</span>` : ''}${(d.location && d.locationKind !== 'online') ? `<span>${esc(d.location)}</span>` : (d.locationKind === 'online' ? '<span>Online</span>' : '')}</div>
    </div>
  </div>
  <div class="evgrid">
    <aside class="evside">
      <div class="hostrow" style="border-top:0;padding-top:0;margin-top:2px"><div><div class="hk">Hosted by</div><div class="hn"><a href="${hostHref(d.hostKind, d.hostId)}">${esc(d.hostName)}</a></div></div>${followBtn}</div>
      <div class="sidelinks">
        <a href="${hostHref(d.hostKind, d.hostId)}">Contact the host →</a>
        <a href="/e/${d.id}/ics">＋ Add to calendar</a>
      </div>
      <span class="evtag"># ${esc(ADMISSION_LABEL[d.admission])}</span>
    </aside>

    <main class="evmain">
      <div id="claim">${ctx.extraTop ?? ''}</div>

      <div class="ww"><div class="wi cal">${dt ? `<span class="m">${mon}</span><span class="d">${day}</span>` : ICON.cal}</div>
        <div><div class="wt">${esc(d.date || 'Date TBA')}</div><div class="ws">${esc(d.time ? d.time + (dt ? '' : '') : 'Time TBA')}${d.capacity ? ` · capacity ${d.capacity}` : ''}${d.recurrence && d.recurrence !== 'none' ? ` · repeats ${esc(d.recurrence)}` : ''}</div></div></div>
      ${d.location ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">${d.locationKind === 'online' ? 'Online event' : esc(d.location)}</div><div class="ws">${d.locationKind === 'online' ? `<a href="${esc(d.location)}" target="_blank" rel="noopener">Join link ↗</a>` : d.locationKind === 'hybrid' ? `In person + streamed${mapsHref ? ` · <a href="${mapsHref}" target="_blank" rel="noopener">Maps ↗</a>` : ''}` : (mapsHref ? `<a href="${mapsHref}" target="_blank" rel="noopener">Open in Maps ↗</a>` : '')}</div></div></div>` : (d.locationKind === 'online' ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">Online event</div></div></div>` : '')}

      ${watch ? `<div class="h3">Watch live</div><div class="rsvp">${watch}</div>` : ''}
      ${ticketSection}${resaleSection}

      ${d.description ? `<div class="h3">About this event</div><p class="desc">${esc(d.description)}</p>` : ''}

      ${d.location ? `<div class="h3">Location</div><p class="desc" style="margin-bottom:8px">${esc(d.location)}</p><div class="rsvp">${mapsHref ? `<a class="rb" href="${mapsHref}" target="_blank" rel="noopener">Open in Maps ↗</a>` : ''}</div>` : ''}

      <div class="h3">More</div>
      <div class="rsvp">${extras.join('')}</div>
      ${feature}
      <div class="prov">Public event · viewing is open; attending needs a free account. Calendar export &amp; watch links are open to members.</div>
    </main>
  </div>
  ${ctx.stickyCta ? `<div style="height:76px"></div>${ctx.stickyCta}` : ''}`;
  return layout(d.title, body, { back: hostHref(d.hostKind, d.hostId) });
}

// payment step — real card payment via Stripe Checkout when configured.
export function renderCheckout(d: EventDetail, fanId: string, live = false): string {
  const body = `
  <h1>Checkout</h1>
  <div class="card"><b>${esc(d.title)}</b><div class="mut" style="margin:6px 0">${esc([d.date, d.time].filter(Boolean).join(' · '))}${d.location ? ' · ' + esc(d.location) : ''}</div>
    <div style="font-size:30px;font-weight:800;margin-top:10px">${priceLabel(d)}</div></div>
  <form method="post" action="/e/${d.id}/pay"><input type="hidden" name="fan_id" value="${fanId}">
    <div class="row"><button type="submit">${live ? `Pay ${esc(priceLabel(d))} with card` : `Pay ${esc(priceLabel(d))} · get ticket`}</button></div></form>
  <p class="mut" style="margin-top:12px">${live
    ? 'Secure payment by Stripe — you’ll be taken to Stripe’s checkout, then straight back with your ticket. Your card details never touch Horda.'
    : 'Demo checkout — payments are stubbed (set STRIPE_SECRET_KEY to charge for real). The ticket + guest-list flow is already live.'}</p>`;
  return layout('Checkout · ' + d.title, body, { back: `/e/${d.id}` });
}

// owner: schedule an event
export function renderCreateEvent(hostKind: string, hostId: string, hostName: string): string {
  const fld = 'display:block;margin:12px 0;font-size:13px;color:var(--mut)';
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  const body = `
  <h1>Schedule an event</h1>
  <p class="mut">As ${esc(hostName)}. Choose how fans get in, and add live-watch links if it's streamed.</p>
  <form method="post" action="/events" onsubmit="return hzPrep(this)">
    <input type="hidden" name="host_kind" value="${esc(hostKind)}"><input type="hidden" name="host_id" value="${esc(hostId)}">
    <label style="${fld}">Title<input style="${inp}" name="title" required placeholder="Open sparring night"></label>
    <label style="${fld}">Date &amp; time<input style="${inp}" type="datetime-local" name="starts_at" required></label>
    <label style="${fld}">Type
      <select name="location_kind" style="${inp}">
        <option value="in_person">In person</option>
        <option value="online">Online</option>
        <option value="hybrid">Hybrid — in person + streamed</option>
      </select></label>
    <label style="${fld}">Location / link<input style="${inp}" name="location" placeholder="Kreuzberg Boxing Club, Berlin — or a stream URL"></label>
    <label style="${fld}">Repeats
      <select name="recurrence" style="${inp}">
        <option value="none">One-off</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select></label>
    <label style="${fld}">About this event <span class="mut">(optional)</span><textarea style="${inp};min-height:100px" name="description" placeholder="What's happening, who's invited, what to expect, schedule, rules…"></textarea></label>
    <label style="${fld}">Cover image<input type="file" accept="image/*" data-target="cover" style="margin-top:6px;color:inherit"></label>
    <input type="hidden" name="cover">
    <label style="${fld}">Admission
      <select name="admission" style="${inp}">
        <option value="open">Open — free, just show up</option>
        <option value="register">Free — registration required</option>
        <option value="apply">Apply — host approves</option>
        <option value="paid">Paid — buy a ticket</option>
      </select></label>
    <label style="${fld}">Price € (paid only)<input style="${inp}" type="number" name="price" min="0" step="0.5" placeholder="15"></label>
    <label style="${fld}">YouTube live link<input style="${inp}" name="youtube" placeholder="https://youtube.com/…"></label>
    <label style="${fld}">Twitch link<input style="${inp}" name="twitch" placeholder="https://twitch.tv/…"></label>
    <label style="${fld}">Instagram Live link<input style="${inp}" name="instagram" placeholder="https://instagram.com/…"></label>
    <label style="${fld}">TikTok Live link<input style="${inp}" name="tiktok" placeholder="https://tiktok.com/@…/live"></label>
    <label style="${fld}">Discord link<input style="${inp}" name="discord" placeholder="https://discord.gg/…"></label>
    <label style="${fld}">Capacity (optional)<input style="${inp}" type="number" name="capacity" min="1"></label>

    <div style="border-top:1px solid var(--b);margin-top:14px;padding-top:12px">
      <div style="font-weight:700;font-size:15px">Ways to attend</div>
      <p class="mut" style="font-size:12.5px;margin:4px 0 6px">Offer this event in one or more formats. Horda confirms attendance for each — in-person tickets and stream viewers alike — so you see exactly what to expect and what to optimise for.</p>
      <label style="${fld};margin-top:4px"><input type="checkbox" name="fmt_inperson" value="1" checked style="vertical-align:-2px;margin-right:6px">In person — attendance confirmed on Horda</label>
      <label style="${fld}">In-person ticket price € <span class="mut">(blank = free entry)</span><input style="${inp}" name="fmt_inperson_price" inputmode="decimal" placeholder="25"></label>
      <label style="${fld}">In-person capacity <span class="mut">(optional)</span><input style="${inp}" type="number" name="fmt_inperson_cap" min="1"></label>
      <label style="${fld}">Stream 1 — label<input style="${inp}" name="fmt_stream1_label" placeholder="TikTok Live"></label>
      <label style="${fld}">Stream 1 — watch link<input style="${inp}" name="fmt_stream1_url" placeholder="https://tiktok.com/@…/live"></label>
      <label style="${fld}">Stream 2 — label<input style="${inp}" name="fmt_stream2_label" placeholder="Sportdeutschland.TV / media partner"></label>
      <label style="${fld}">Stream 2 — watch link<input style="${inp}" name="fmt_stream2_url" placeholder="https://…"></label>
    </div>

    <div style="border-top:1px solid var(--b);margin-top:14px;padding-top:12px">
      <div style="font-weight:700;font-size:15px">Repeat &amp; season schedule</div>
      <p class="mut" style="font-size:12.5px;margin:4px 0 6px">Repeat this event automatically, or paste a whole season — Horda creates every event for you, each with the formats above.</p>
      <label style="${fld};margin-top:4px">Repeat for how many times <span class="mut">(uses the “Repeats” setting above; blank/1 = one-off)</span><input style="${inp}" type="number" name="recurrence_count" min="1" max="52" placeholder="e.g. 10"></label>
      <label style="${fld}">Or paste a season schedule — one per line: <span class="mut">Title | 2026-08-01 19:00 | Venue</span>
        <textarea style="${inp};min-height:90px" name="season_schedule" placeholder="Round 1 · SC Berlin vs FC Köln | 2026-08-01 19:00 | Olympiastadion
Round 2 · SC Berlin vs VfB | 2026-08-08 18:30 | Away"></textarea></label>
    </div>

    <div style="border-top:1px solid var(--b);margin-top:14px;padding-top:12px">
      <label style="${fld};margin-top:0"><input type="checkbox" name="room_enabled" value="1" checked style="vertical-align:-2px;margin-right:6px">Open an Event Room (countdown → live → recap)</label>
      <label style="${fld}">Room name<input style="${inp}" name="room_label" placeholder="Matchday / Fight Night / Race Day"></label>
      <label style="${fld}">Who gets the live room?
        <select name="room_tier" style="${inp}">
          <option value="supporter">★ Supporters &amp; up</option>
          <option value="clubhouse">✦ Clubhouse only</option>
          <option value="public">Everyone</option>
        </select></label>
    </div>
    <div class="row"><button type="submit">Publish event</button></div>
  </form>${UPLOAD_SCRIPT}`;
  return layout('Schedule an event', body, { back: hostHref(hostKind, hostId) });
}

// owner: manage — approvals + guest list + per-format attendance breakdown
export function renderManage(d: EventDetail, guests: { response: string; status: string; fanId: string; name: string; handle: string | null }[],
  formats: { id: string; kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; going: number; revenueCents: number }[] = []): string {
  const money2 = (c: number) => `€${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const totalGoing = formats.reduce((a, f) => a + f.going, 0);
  const totalRev = formats.reduce((a, f) => a + (f.requiresTicket ? f.revenueCents : 0), 0);
  const formatBreakdown = formats.length
    ? `<h2>Attendance by format · ${totalGoing}</h2>
       <div class="fmtgrid">${formats.map(f => `<div class="fmtcard"><div class="fk">${f.kind === 'stream' ? '📺 ' : '📍 '}${esc(f.label)}${f.requiresTicket && f.priceCents ? ` · ${money2(f.priceCents)}` : ' · free'}</div><div class="fn">${f.going}</div><div class="fl">${f.kind === 'stream' ? 'watching' : 'attending'}${f.requiresTicket ? ` · ${money2(f.revenueCents)} sold` : ''}</div>${f.channelUrl ? `<a class="fu" href="${esc(f.channelUrl)}" target="_blank" rel="noopener">Channel ↗</a>` : ''}</div>`).join('')}</div>
       ${totalRev ? `<p class="mut" style="margin-top:6px">Tickets sold on Horda: <b>${money2(totalRev)}</b></p>` : ''}
       <style>.fmtgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:10px 0}.fmtcard{border:1px solid var(--b);border-radius:12px;padding:12px;background:var(--s)}.fk{font-size:12.5px;font-weight:600}.fn{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:4px}.fl{font-size:11.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px}.fu{font-size:12px;border-bottom:1px solid var(--b);display:inline-block;margin-top:6px}</style>`
    : '';
  return renderManageInner(d, guests, formatBreakdown);
}
function renderManageInner(d: EventDetail, guests: { response: string; status: string; fanId: string; name: string; handle: string | null }[], formatBreakdown: string): string {
  const pending = guests.filter(g => g.response === 'going' && g.status === 'pending');
  const approveList = pending.length
    ? `<h2>${d.admission === 'paid' ? 'Awaiting payment' : 'Applications'} · ${pending.length}</h2><ul>${pending.map(g =>
        `<li><span class="hl">${esc(g.name)}</span>${d.admission === 'apply' ? `<form method="post" action="/e/${d.id}/approve"><input type="hidden" name="fan_id" value="${g.fanId}"><button class="ghost">Approve</button></form>` : `<span class="tag mutd">unpaid</span>`}</li>`).join('')}</ul>` : '';
  const group = (test: (g: any) => boolean, label: string) => {
    const list = guests.filter(test); if (!list.length) return '';
    return `<h2>${esc(label)} · ${list.length}</h2><ul>${list.map(g => `<li><span class="hl">${esc(g.name)}</span><span class="dt">${g.handle ? '@' + esc(g.handle) : ''}</span></li>`).join('')}</ul>`;
  };
  const body = `
  <h1>${esc(d.title)}</h1>
  <p class="mut">Host view · ${esc([d.date, d.time].filter(Boolean).join(' · ') || 'TBA')} · ${ADMISSION_LABEL[d.admission]}${d.admission === 'paid' ? ' · ' + priceLabel(d) : ''}</p>
  <div class="card"><b>${d.counts.going}</b> going · <b>${d.counts.pending}</b> ${d.admission === 'paid' ? 'awaiting payment' : 'pending'} · <b>${d.counts.interested}</b> interested · <b>${d.counts.not_going}</b> can't go${d.capacity ? ` · capacity ${d.capacity}` : ''}</div>
  ${formatBreakdown}
  ${approveList}
  ${group(g => g.response === 'going' && (g.status === 'confirmed' || g.status === 'paid'), 'Going')}
  ${group(g => g.response === 'interested', 'Interested')}
  ${group(g => g.response === 'not_going', "Can't go")}
  ${guests.length ? '' : '<p class="mut">No responses yet.</p>'}
  <div class="row"><a href="/e/${d.id}"><button class="ghost">View public page</button></a></div>`;
  return layout('Manage · ' + d.title, body, { back: `/e/${d.id}` });
}
