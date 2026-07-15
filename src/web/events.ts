// events.ts — Luma-adapted event layer: admission (open/register/apply/paid),
// payment checkout, online watch channels, cross-posting (feature), and host
// management with approvals. Built on the shared dark layout().
import { layout, esc } from './layout.ts';
import { UPLOAD_SCRIPT } from './shell.ts';
import { shareButton } from './theme.ts';
import { socialIcon } from './icons.ts';
import { type EventDetail, type EventParty, type SubEvent, priceLabel } from '../db/events_repo.ts';

const hostHref2 = (kind: string | null, id: string | null) =>
  kind === 'athlete' ? `/athlete/${id}` : kind === 'team' ? `/team/${id}` : kind === 'association' ? `/association/${id}` : `/club/${id}`;

// The line-up: organizers, the two sides (versus), attending athletes + sponsors.
// Unclaimed slots invite the rival to join Horda to claim their side + fans + tickets.
export function renderRoster(d: {
  eventId: string; archetype: string; parties: EventParty[]; guest: boolean;
  canClaim: boolean; isOrganizer: boolean;
}): string {
  if (!d.parties.length) return '';
  const nameEl = (p: EventParty) => p.entityId
    ? `<a href="${hostHref2(p.entityKind, p.entityId)}">${esc(p.name)}</a>`
    : `<span>${esc(p.name)}</span>`;
  const claimBtn = (p: EventParty) => d.guest
    ? `<a class="rb sm" href="/signup?next=/e/${d.eventId}">Claim this — join Horda</a>`
    : d.canClaim
      ? `<form method="post" action="/e/${d.eventId}/party/${p.id}/claim"><button class="rb sm p" type="submit">Claim this side</button></form>`
      : `<span class="mut" style="font-size:12px">Unclaimed — the ${p.role === 'side' ? 'rival' : 'athlete'} claims it by joining</span>`;
  const row = (p: EventParty) => `<div class="prow"><div class="pn">${nameEl(p)}${p.status === 'unclaimed' ? ' <span class="ptag">unclaimed</span>' : ''}</div>${p.status === 'unclaimed' ? claimBtn(p) : (d.isOrganizer ? `<form method="post" action="/e/${d.eventId}/party/${p.id}/remove"><button class="rb sm" type="submit">Remove</button></form>` : '')}</div>`;
  const sides = d.parties.filter(p => p.role === 'side');
  const organizers = d.parties.filter(p => p.role === 'organizer');
  const athletes = d.parties.filter(p => p.role === 'attending_athlete');
  const sponsors = d.parties.filter(p => p.role === 'sponsor' || p.role === 'venue');
  const sideA = sides.find(s => s.side === 'A'); const sideB = sides.find(s => s.side === 'B');
  const versus = (sideA || sideB)
    ? `<div class="versus"><div class="vside">${sideA ? row(sideA) : '<div class="mut">TBD</div>'}</div><div class="vs">VS</div><div class="vside">${sideB ? row(sideB) : '<div class="mut">TBD</div>'}</div></div>`
    : '';
  const group = (label: string, list: EventParty[]) => list.length ? `<div class="pgrp"><div class="pgl">${label}</div>${list.map(row).join('')}</div>` : '';
  return `<div class="h3">Line-up</div>
    <style>
      .versus{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin:8px 0}
      .versus .vside{border:1px solid var(--b);border-radius:12px;padding:12px}
      .versus .vs{font-weight:800;color:var(--mut);font-size:13px}
      .pgrp{margin:10px 0}.pgl{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
      .prow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--b)}
      .prow .pn a:hover{border-bottom:1px solid var(--b)}
      .ptag{font-size:10px;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:1px 7px;margin-left:6px}
    </style>
    ${versus}${group('Organiser', organizers)}${group('On the card', athletes)}${group('Partners', sponsors)}`;
}

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
  hasAccess?: boolean;       // may the viewer see the watch/join link right now?
  shareRef?: string | null;  // this viewer's attributable ?via= token (logged-in only)
  hostLinks?: Record<string, string>;  // host's public socials — the way to reach them
  parties?: EventParty[];    // multi-party line-up (organizers, sides, roster)
  subs?: SubEvent[];         // sub-events (fight card / race-within-race)
  parent?: { id: string; title: string } | null;  // if this is a sub-event
  canClaim?: boolean;        // viewer owns an entity that could claim an unclaimed slot
  myPromoToken?: string | null;  // the viewer's own participant promo link (+ their draw)
  myPromoDraw?: { identities: number; ticketBuyers: number };
}): string {
  const my = ctx.myRsvp;
  // How a fan reaches the host: their public socials (the real contact path, since
  // there's no in-app DM) + a link to their Horda page.
  const hostSocials = Object.entries(ctx.hostLinks ?? {}).filter(([, v]) => v)
    .map(([k, v]) => `<a class="ic" aria-label="${esc(k)}" href="${esc(v)}" target="_blank" rel="noopener">${socialIcon(k)}</a>`).join('');
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

  // watch live (online) — YouTube / Twitch / Instagram / TikTok / Discord.
  // Only the organizer's chosen access decides who sees the link:
  //   public → shown to everyone (incl. logged-out); link/ticket → only after a claim.
  const isPublicAccess = d.accessMode === 'public';
  const canWatch = !!ctx.isHost || isPublicAccess || !!ctx.hasAccess;
  const ch = d.streams || {};
  const watchLinks = [
    ch.youtube ? `<a class="rb" href="${esc(ch.youtube)}" target="_blank" rel="noopener">Watch on YouTube ↗</a>` : '',
    ch.twitch ? `<a class="rb" href="${esc(ch.twitch)}" target="_blank" rel="noopener">Watch on Twitch ↗</a>` : '',
    ch.discord ? `<a class="rb" href="${esc(ch.discord)}" target="_blank" rel="noopener">Watch in Discord ↗</a>` : '',
  ].filter(Boolean).join('');
  // Is this an online/stream event that hands out a link at all?
  const hasStreamLink = !!(watchLinks || (d.locationKind === 'online' && d.location));
  const watch = canWatch
    ? watchLinks
    : (hasStreamLink ? `<div class="lockrow">🔒 <span>Claim your spot to unlock the watch link${d.admission === 'paid' ? ` · ${priceLabel(d)}` : ' — it\'s free'}.</span> <a class="rb sm" href="#claim">Claim to watch</a></div>` : '');

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

  // Plain Share = anonymous (bare /e/:id link). Available to everyone, logged in
  // or not — the system can't attribute it because it doesn't know who shared.
  const extras = [shareButton({ title: d.title, cls: 'rb', label: 'Share' }), `<a class="rb" href="/e/${d.id}/ics">＋ Add to calendar</a>`];
  if (ctx.isHost) extras.push(`<a class="rb" href="/manage/${d.id}">Manage</a>`);

  // Attributable share = only once we know who you are (logged in). We hand out a
  // personal /e/:id?via=<token> link; every claim through it is credited to you.
  const attributableShare = (!ctx.guest && ctx.shareRef)
    ? `<div class="cap" style="margin-top:18px">Bring your crowd</div>
       <div class="rsvp">${shareButton({ title: d.title, cls: 'rb p', label: 'Share under your name', url: `/e/${d.id}?via=${ctx.shareRef}` })}</div>
       <p class="mut" style="font-size:12px;margin:2px 0 0">Claims from your link are credited to you. A plain Share above stays anonymous.</p>`
    : (ctx.guest ? `<p class="mut" style="font-size:12px;margin:10px 0 0"><a href="/signup" style="border-bottom:1px solid var(--b)">Log in</a> to share under your name and get credit for who you bring.</p>` : '');

  // cross-post: feature this event on one of your own profiles (also attributed)
  const featurable = (ctx.myEntities ?? []).filter(e => !(e.kind === d.hostKind && e.id === d.hostId));
  const feature = attributableShare + ((!ctx.guest && featurable.length)
    ? `<div class="cap" style="margin-top:18px">Feature on a page you run</div><div class="rsvp">${featurable.map(e =>
        `<form method="post" action="/feature"><input type="hidden" name="feat_kind" value="${e.kind}"><input type="hidden" name="feat_id" value="${e.id}"><input type="hidden" name="event_id" value="${d.id}"><button class="rb" type="submit">Feature on ${esc(e.name.split(' ')[0])}</button></form>`).join('')}</div>` : '');

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
    .hostsoc{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hostsoc .hsl{font-size:12px;color:var(--mut)}
    .hostsoc .ic{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--b);border-radius:9px;color:var(--bone)}.hostsoc .ic:hover{border-color:var(--bone)}.hostsoc .ic svg{width:16px;height:16px}
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
    .lockrow{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:13.5px;color:var(--mut);border:1px dashed var(--b);border-radius:12px;padding:11px 14px}
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
        <a href="${hostHref(d.hostKind, d.hostId)}">View ${esc(d.hostName)} on Horda →</a>
        ${hostSocials ? `<div class="hostsoc"><span class="hsl">Reach the host</span>${hostSocials}</div>` : `<span class="mut" style="font-size:12px">Reach the host via their Horda page — follow to get their updates.</span>`}
        <a href="/e/${d.id}/ics">＋ Add to calendar</a>
      </div>
      <span class="evtag"># ${esc(ADMISSION_LABEL[d.admission])}</span>
    </aside>

    <main class="evmain">
      <div id="claim">${ctx.extraTop ?? ''}</div>

      <div class="ww"><div class="wi cal">${dt ? `<span class="m">${mon}</span><span class="d">${day}</span>` : ICON.cal}</div>
        <div><div class="wt">${esc(d.date || 'Date TBA')}</div><div class="ws">${esc(d.time ? d.time + (dt ? '' : '') : 'Time TBA')}${d.capacity ? ` · capacity ${d.capacity}` : ''}${d.recurrence && d.recurrence !== 'none' ? ` · repeats ${esc(d.recurrence)}` : ''}</div></div></div>
      ${d.location ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">${d.locationKind === 'online' ? 'Online event' : esc(d.location)}</div><div class="ws">${d.locationKind === 'online' ? (canWatch ? `<a href="${esc(d.location)}" target="_blank" rel="noopener">Join link ↗</a>` : `<span class="mut">🔒 Link revealed after you claim</span>`) : d.locationKind === 'hybrid' ? `In person + streamed${mapsHref ? ` · <a href="${mapsHref}" target="_blank" rel="noopener">Maps ↗</a>` : ''}` : (mapsHref ? `<a href="${mapsHref}" target="_blank" rel="noopener">Open in Maps ↗</a>` : '')}</div></div></div>` : (d.locationKind === 'online' ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">Online event</div></div></div>` : '')}

      ${watch ? `<div class="h3">Watch live</div><div class="rsvp">${watch}</div>` : ''}

      ${ctx.parent ? `<div class="lockrow" style="border-style:solid">Part of <a class="hl" href="/e/${ctx.parent.id}" style="color:var(--bone);border-bottom:1px solid var(--b)">${esc(ctx.parent.title)}</a> — one ticket covers the whole event.</div>` : ''}
      ${renderRoster({ eventId: d.id, archetype: d.archetype, parties: ctx.parties ?? [], guest: ctx.guest, canClaim: !!ctx.canClaim, isOrganizer: !!ctx.isHost })}
      ${ctx.myPromoToken ? `<div class="card" style="border-color:var(--bone);margin-top:10px"><strong>Your promo link.</strong> <span class="mut">Every claim through it is credited to you.</span>
        <div class="rsvp" style="margin-top:8px">${shareButton({ title: d.title, cls: 'rb p', label: 'Copy my promo link', url: `/e/${d.id}?p=${ctx.myPromoToken}` })}</div>
        <div class="mut" style="font-size:12.5px;margin-top:6px">You've driven <b style="color:var(--bone)">${ctx.myPromoDraw?.identities ?? 0}</b> identities · <b style="color:var(--bone)">${ctx.myPromoDraw?.ticketBuyers ?? 0}</b> ticket buyers.</div></div>` : ''}
      ${(ctx.subs && ctx.subs.length) ? `<div class="h3">On the card${ctx.isHost ? '' : ''} · ${ctx.subs.length}</div><div class="rsvp" style="flex-direction:column;align-items:stretch">${ctx.subs.map(s => `<a class="rb" style="text-align:left" href="/e/${s.id}">${esc(s.title)}${s.date ? ` <span class="mut">· ${esc(s.date)}</span>` : ''}</a>`).join('')}</div>` : ''}
      ${ctx.isHost && !ctx.parent ? `<div class="rsvp"><a class="rb" href="/host/${d.hostKind}/${d.hostId}/new?parent=${d.id}">＋ Add a bout / sub-event</a></div>` : ''}

      ${ticketSection}${resaleSection}

      ${d.description ? `<div class="h3">About this event</div><p class="desc">${esc(d.description)}</p>` : ''}

      ${(d.location && d.locationKind !== 'online') ? `<div class="h3">Location</div><p class="desc" style="margin-bottom:8px">${esc(d.location)}</p><div class="rsvp">${mapsHref ? `<a class="rb" href="${mapsHref}" target="_blank" rel="noopener">Open in Maps ↗</a>` : ''}</div>` : ''}

      <div class="h3">More</div>
      <div class="rsvp">${extras.join('')}</div>
      ${feature}
      <div class="prov">Public event · viewing is open; attending needs a free account. Calendar export &amp; watch links are open to members.</div>
    </main>
  </div>
  ${ctx.stickyCta ? `<div style="height:76px"></div>${ctx.stickyCta}` : ''}`;
  return layout(d.title, body, { back: hostHref(d.hostKind, d.hostId) });
}

// Organizer payouts (Stripe Connect). The gate for paid ticketing: connect a
// Stripe account (KYC via Stripe) before you can collect money. 10% platform fee.
export function renderPayouts(d: { hostKind: string; hostId: string; hostName: string; connected: boolean; payoutsEnabled: boolean; started: boolean; live: boolean }): string {
  const connectAction = `/host/${d.hostKind}/${d.hostId}/connect`;
  const status = d.connected
    ? `<div class="card" style="border-color:var(--bone)"><strong>✓ Payouts connected.</strong> <span class="mut">You can sell paid tickets. Horda keeps a flat <b style="color:var(--bone)">10%</b>; the rest is paid out to your connected account.</span></div>`
    : d.started
      ? `<div class="card"><strong>Almost there.</strong> <span class="mut">Your Stripe onboarding isn't finished — Stripe still needs a few details before you can accept payments.</span><form method="post" action="${connectAction}" style="margin-top:8px"><button type="submit">Finish setup →</button></form></div>`
      : `<div class="card"><strong>Connect payouts to sell paid tickets.</strong> <span class="mut">Free events need nothing. To charge for tickets, connect a Stripe account — Stripe handles identity verification; payouts land in your bank. Horda takes a flat 10%.</span><form method="post" action="${connectAction}" style="margin-top:8px"><button type="submit">Connect payouts →</button></form></div>`;
  return layout('Payouts · ' + d.hostName, `
    <h1>Payments &amp; payouts</h1>
    <p class="mut">For ${esc(d.hostName)}. ${d.live ? '' : 'Demo mode — set STRIPE_SECRET_KEY for real Stripe Connect. '}Web-first checkout; card details never touch Horda.</p>
    ${status}
    <p class="mut" style="font-size:12.5px;margin-top:12px">Free tickets are always frictionless — this only applies where money changes hands. We gate money, not creation.</p>
  `, { back: hostHref(d.hostKind, d.hostId) });
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

// owner: schedule an event. `parent` set when adding a sub-event (bout / race).
export function renderCreateEvent(hostKind: string, hostId: string, hostName: string, parent?: { id: string; title: string }): string {
  const fld = 'display:block;margin:12px 0;font-size:13px;color:var(--mut)';
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  const body = `
  <h1>${parent ? 'Add a sub-event' : 'Schedule an event'}</h1>
  <p class="mut">${parent ? `Under <b style="color:var(--bone)">${esc(parent.title)}</b> — a bout or race-within-the-race. It gets its own sides and promo links; attribution rolls up.` : `As ${esc(hostName)}. Choose the shape, who's on the card, and how fans get in.`}</p>
  <form method="post" action="/events" onsubmit="return hzPrep(this)">
    <input type="hidden" name="host_kind" value="${esc(hostKind)}"><input type="hidden" name="host_id" value="${esc(hostId)}">
    ${parent ? `<input type="hidden" name="parent_id" value="${esc(parent.id)}">` : ''}
    <label style="${fld}">Title<input style="${inp}" name="title" required placeholder="${parent ? 'Rico vs. Tariq' : 'Open sparring night'}"></label>
    <label style="${fld}">Shape
      <select id="ev_arch" name="archetype" style="${inp}" onchange="var v=this.value;document.getElementById('ev_versus').style.display=v==='versus'?'block':'none';document.getElementById('ev_roster').style.display=v==='multi'?'block':'none'">
        <option value="single">Single — one host, open roster (a run club, a mass race)</option>
        <option value="versus"${parent ? ' selected' : ''}>Versus — two sides (a match, a bout); both promote to their fans</option>
        <option value="multi">Multi-participant — many attending clubs/athletes on the card</option>
      </select></label>
    <div id="ev_versus" style="display:${parent ? 'block' : 'none'}">
      <label style="${fld}">Side B (the rival)<input style="${inp}" name="side_b_name" placeholder="FC Rival — they claim their side & fans by joining Horda"></label>
      <p class="mut" style="font-size:12px;margin:-6px 0 0">You're side A. List side B even if they're not on Horda yet — they join to claim their side, their fans and their ticket share.</p>
    </div>
    <div id="ev_roster" style="display:none">
      <label style="${fld}">On the card (comma-separated)<input style="${inp}" name="roster" placeholder="Rico Vargas, Tariq Bello, Otto Kahn"></label>
      <p class="mut" style="font-size:12px;margin:-6px 0 0">Each becomes an attending slot with its own promo link; they claim it by joining.</p>
    </div>
    <label style="${fld}">Date &amp; time<input style="${inp}" type="datetime-local" name="starts_at" required></label>
    <label style="${fld}">Where
      <select id="ev_loc_kind" name="location_kind" style="${inp}" onchange="hzAccess(this.value)">
        <option value="in_person">In person (a venue)</option>
        <option value="online">Online (a stream / call link)</option>
        <option value="hybrid">Hybrid — in person + streamed</option>
      </select></label>
    <label style="${fld}">Address or link<input style="${inp}" name="location" placeholder="Kreuzberg Boxing Club, Berlin — or a YouTube / Instagram / Zoom URL"></label>

    <label style="${fld}">How do people get in?
      <select id="ev_access" name="access_mode" style="${inp}">
        <option value="ticket">🎟 Ticket + QR check-in — they register, get a QR ticket, show it at the door; you scan to confirm who showed up</option>
        <option value="link">🔒 Claim to get the link — they must claim a spot (free or paid) to unlock the stream/details; you see exactly who's in</option>
        <option value="public">🌐 Public link — anyone can watch, no sign-up (you won't know who watched)</option>
      </select></label>
    <p class="mut" style="font-size:12px;margin:-6px 0 0">Ticket + QR is for in-person events you check people into. "Claim to get the link" gates a stream behind a free/paid claim so you capture who's coming. "Public link" is fully open.</p>
    <script>function hzAccess(where){var s=document.getElementById('ev_access');if(!s)return;var opts=[].slice.call(s.options);function show(v,on){var o=opts.filter(function(x){return x.value===v})[0];if(o)o.hidden=!on}
      if(where==='in_person'){show('ticket',true);show('link',false);show('public',false);s.value='ticket'}
      else{show('ticket',false);show('link',true);show('public',true);if(s.value==='ticket')s.value='link'}}
      hzAccess(document.getElementById('ev_loc_kind').value);</script>
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
  formats: { id: string; kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; going: number; revenueCents: number }[] = [],
  attribution: { fanId: string; name: string; token: string; clicks: number; claims: number }[] = [],
  promo?: { rows: { partyId: string; name: string; role: string; side: string | null; token: string; kind: string; status: string; clicks: number; identities: number; ticketBuyers: number; subEvent?: string }[]; total: { identities: number; ticketBuyers: number; clicks: number } },
  payout?: { hostKind: string; hostId: string; connected: boolean }): string {
  // Paid event → surface payout status: connect payouts (KYC) before selling.
  const payoutBanner = (d.admission === 'paid' && payout)
    ? (payout.connected
        ? `<div class="card" style="border-color:var(--bone)"><strong>✓ Payouts connected.</strong> <span class="mut">Selling tickets · Horda keeps 10%.</span> <a class="rb sm" href="/manage-payouts/${payout.hostKind}/${payout.hostId}">Manage payouts</a></div>`
        : `<div class="card"><strong>Connect payouts to sell tickets.</strong> <span class="mut">This is a paid event — connect a Stripe account (Stripe handles KYC) before you can collect money.</span><form method="post" action="/host/${payout.hostKind}/${payout.hostId}/connect" style="margin-top:8px"><button class="rb p" type="submit">Connect payouts →</button></form></div>`)
    : '';
  // The share panel — every participant's promo link with its live counts, the
  // roll-up across sub-events, and a "+ create custom link". Measurement only.
  const roleLabel: Record<string, string> = { organizer: 'Organiser', side: 'Side', attending_athlete: 'On the card', sponsor: 'Partner', venue: 'Venue', promoter: 'Custom link' };
  const sharePanel = (promo && promo.rows.length)
    ? `<h2>Share panel · ${promo.total.identities} identities · ${promo.total.ticketBuyers} ticket buyers</h2>
       <p class="mut" style="font-size:12.5px">Every participant has a ready-to-share promo link. Counts roll up across sub-events. Measurement only — no payouts yet.</p>
       <div class="promos">${promo.rows.map(r => `<div class="promo"><div class="pl"><b>${esc(r.name)}</b> <span class="prole">${esc(roleLabel[r.role] ?? r.role)}${r.side ? ' ' + r.side : ''}${r.subEvent ? ` · ${esc(r.subEvent)}` : ''}${r.status === 'unclaimed' ? ' · unclaimed' : ''}</span><div class="pc">${r.identities} identities · ${r.ticketBuyers} tickets · ${r.clicks} clicks</div></div>${shareButton({ title: d.title, cls: 'rb sm', label: 'Copy', url: `/e/${d.id}?p=${r.token}` })}</div>`).join('')}</div>
       <form method="post" action="/e/${d.id}/promo" class="rsvp" style="margin-top:10px"><input name="label" placeholder="Custom link label (e.g. an influencer)" class="tkin" style="width:220px"><button class="rb" type="submit">＋ Create custom link</button></form>
       <style>.promos{display:flex;flex-direction:column;gap:8px;margin:8px 0}.promo{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--b);border-radius:12px;padding:10px 12px}.promo .prole{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin-left:6px}.promo .pc{font-size:12.5px;color:var(--mut);margin-top:3px}</style>`
    : '';
  const money2 = (c: number) => `€${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const totalGoing = formats.reduce((a, f) => a + f.going, 0);
  const totalRev = formats.reduce((a, f) => a + (f.requiresTicket ? f.revenueCents : 0), 0);
  // "Who brought people" — fans who shared under their name, ranked by claims driven.
  const movers = attribution.filter(a => a.clicks > 0 || a.claims > 0);
  const attributionBlock = movers.length
    ? `<h2>Who brought people · ${movers.reduce((a, m) => a + m.claims, 0)} attributed</h2>
       <ul>${movers.map(m => `<li><span class="hl">${esc(m.name)}</span><span class="dt"><b>${m.claims}</b> claim${m.claims === 1 ? '' : 's'} · ${m.clicks} click${m.clicks === 1 ? '' : 's'}</span></li>`).join('')}</ul>
       <p class="mut" style="font-size:12px">From fans who shared under their name. Measurement only.</p>`
    : '';
  const formatBreakdown = formats.length
    ? `<h2>Attendance by format · ${totalGoing}</h2>
       <div class="fmtgrid">${formats.map(f => `<div class="fmtcard"><div class="fk">${f.kind === 'stream' ? '📺 ' : '📍 '}${esc(f.label)}${f.requiresTicket && f.priceCents ? ` · ${money2(f.priceCents)}` : ' · free'}</div><div class="fn">${f.going}</div><div class="fl">${f.kind === 'stream' ? 'watching' : 'attending'}${f.requiresTicket ? ` · ${money2(f.revenueCents)} sold` : ''}</div>${f.channelUrl ? `<a class="fu" href="${esc(f.channelUrl)}" target="_blank" rel="noopener">Channel ↗</a>` : ''}</div>`).join('')}</div>
       ${totalRev ? `<p class="mut" style="margin-top:6px">Tickets sold on Horda: <b>${money2(totalRev)}</b></p>` : ''}
       <style>.fmtgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:10px 0}.fmtcard{border:1px solid var(--b);border-radius:12px;padding:12px;background:var(--s)}.fk{font-size:12.5px;font-weight:600}.fn{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:4px}.fl{font-size:11.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px}.fu{font-size:12px;border-bottom:1px solid var(--b);display:inline-block;margin-top:6px}</style>`
    : '';
  return renderManageInner(d, guests, payoutBanner + sharePanel + formatBreakdown + attributionBlock);
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
