// events.ts — Luma-adapted event layer: admission (open/register/apply/paid),
// payment checkout, online watch channels, cross-posting (feature), and host
// management with approvals. Built on the shared dark layout().
import { layout, esc } from './layout.ts';
import { UPLOAD_SCRIPT } from './shell.ts';
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

  // watch live (online) — YouTube / Twitch / Discord
  const ch = d.streams || {};
  const watch = [
    ch.youtube ? linkBtn('Watch on YouTube ↗', ch.youtube) : '',
    ch.twitch ? linkBtn('Watch on Twitch ↗', ch.twitch) : '',
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

  const extras = [`<a class="rb" href="/e/${d.id}/ics">＋ Add to calendar</a>`];
  if (ctx.isHost) extras.push(`<a class="rb" href="/manage/${d.id}">Manage</a>`);

  // cross-post: feature this event on one of your own profiles
  const featurable = (ctx.myEntities ?? []).filter(e => !(e.kind === d.hostKind && e.id === d.hostId));
  const feature = (!ctx.guest && featurable.length)
    ? `<div class="cap" style="margin-top:18px">Share on your profile</div><div class="rsvp">${featurable.map(e =>
        `<form method="post" action="/feature"><input type="hidden" name="feat_kind" value="${e.kind}"><input type="hidden" name="feat_id" value="${e.id}"><input type="hidden" name="event_id" value="${d.id}"><button class="rb" type="submit">Feature on ${esc(e.name.split(' ')[0])}</button></form>`).join('')}</div>` : '';

  const body = `
  <style>
    .cap{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--mut);font-weight:800;margin:16px 0 4px}
    .meta{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--b);font-size:14px}
    .meta .k{width:74px;color:var(--mut);font-size:11px;letter-spacing:1px;text-transform:uppercase}
    .desc{font-size:15px;margin:14px 0;white-space:pre-wrap}
    .h3{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;margin:18px 0 8px;border-bottom:1px solid var(--b);padding-bottom:5px}
    .rsvp{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}form{display:inline}
    .rb{display:inline-block;font:inherit;font-size:14px;font-weight:800;border:1.5px solid var(--bone);color:var(--bone);background:transparent;border-radius:999px;padding:9px 16px;cursor:pointer;text-decoration:none}
    .rb.p{background:var(--bone);color:var(--ink)} .rb.on{background:var(--bone);color:var(--ink)}
    .myr{font-size:14px;margin:8px 0}.admtag{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border:1.5px solid var(--bone);border-radius:999px;padding:3px 10px}
    .tk{font-weight:800;margin:6px 0 10px}.tkin{background:var(--s);border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:8px 12px;font:inherit;width:120px;margin-right:6px}
  </style>
  <div class="cap">Event · hosted by <a href="${hostHref(d.hostKind, d.hostId)}" style="color:var(--bone);border-bottom:1px solid var(--b)">${esc(d.hostName)}</a></div>
  <h1>${esc(d.title)}</h1>
  <div style="margin:14px 0">${cover}</div>
  <div class="meta"><span class="k">When</span><span>${esc([d.date, d.time].filter(Boolean).join(' · ') || 'TBA')}</span></div>
  ${d.location ? `<div class="meta"><span class="k">Where</span><span>${esc(d.location)}</span></div>` : ''}
  <div class="meta"><span class="k">Admission</span><span><span class="admtag">${ADMISSION_LABEL[d.admission]}</span>${d.admission === 'paid' ? ` · ${priceLabel(d)}` : ''}</span></div>
  <div class="meta"><span class="k">Going</span><span><b>${d.counts.going}</b> going · ${d.counts.interested} interested${d.counts.pending ? ` · ${d.counts.pending} ${d.admission === 'paid' ? 'awaiting payment' : 'pending'}` : ''}${d.capacity ? ` · cap ${d.capacity}` : ''}</span></div>
  ${d.description ? `<p class="desc">${esc(d.description)}</p>` : ''}
  <div class="h3">Attend in person</div>
  <div class="rsvp">${primary} ${secondary}</div>
  ${watch ? `<div class="h3">Watch live</div><div class="rsvp">${watch}</div>` : ''}
  ${ticketSection}${resaleSection}
  <div class="h3">More</div>
  <div class="rsvp">${extras.join('')}</div>
  ${feature}
  <div class="prov">Public event · viewing is open; attending needs a free account. Calendar export &amp; watch links are open to members.</div>`;
  return layout(d.title, body, { back: hostHref(d.hostKind, d.hostId) });
}

// payment step — Stripe is the production swap; this records the paid state.
export function renderCheckout(d: EventDetail, fanId: string): string {
  const body = `
  <h1>Checkout</h1>
  <div class="card"><b>${esc(d.title)}</b><div class="mut" style="margin:6px 0">${esc([d.date, d.time].filter(Boolean).join(' · '))}${d.location ? ' · ' + esc(d.location) : ''}</div>
    <div style="font-size:30px;font-weight:800;margin-top:10px">${priceLabel(d)}</div></div>
  <form method="post" action="/e/${d.id}/pay"><input type="hidden" name="fan_id" value="${fanId}">
    <div class="row"><button type="submit">Pay ${esc(priceLabel(d))} · get ticket</button></div></form>
  <p class="mut" style="margin-top:12px">Demo checkout — payments are stubbed. Production wires Stripe here; the ticket + guest-list flow is already live.</p>`;
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
    <label style="${fld}">Location<input style="${inp}" name="location" placeholder="Kreuzberg Boxing Club, Berlin"></label>
    <label style="${fld}">Description<textarea style="${inp};min-height:90px" name="description" placeholder="What's happening, who's invited…"></textarea></label>
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
    <label style="${fld}">Discord link<input style="${inp}" name="discord" placeholder="https://discord.gg/…"></label>
    <label style="${fld}">Capacity (optional)<input style="${inp}" type="number" name="capacity" min="1"></label>
    <div class="row"><button type="submit">Publish event</button></div>
  </form>${UPLOAD_SCRIPT}`;
  return layout('Schedule an event', body, { back: hostHref(hostKind, hostId) });
}

// owner: manage — approvals + guest list
export function renderManage(d: EventDetail, guests: { response: string; status: string; fanId: string; name: string; handle: string | null }[]): string {
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
  ${approveList}
  ${group(g => g.response === 'going' && (g.status === 'confirmed' || g.status === 'paid'), 'Going')}
  ${group(g => g.response === 'interested', 'Interested')}
  ${group(g => g.response === 'not_going', "Can't go")}
  ${guests.length ? '' : '<p class="mut">No responses yet.</p>'}
  <div class="row"><a href="/e/${d.id}"><button class="ghost">View public page</button></a></div>`;
  return layout('Manage · ' + d.title, body, { back: `/e/${d.id}` });
}
