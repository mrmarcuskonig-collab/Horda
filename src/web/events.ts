// events.ts — Luma-adapted event layer: admission (open/register/apply/paid),
// payment checkout, online watch channels, cross-posting (feature), and host
// management with approvals. Built on the shared dark layout().
import { layout, esc, ogMeta } from './layout.ts';
import { eventJsonLd } from './schema.ts';
import { UPLOAD_SCRIPT } from './shell.ts';
import { shareButton } from './theme.ts';
import { mapsChooser } from './maps.ts';
import { socialIcon } from './icons.ts';
import { sportSelect } from './pages.ts';
import { type EventDetail, type EventParty, type SubEvent, priceLabel } from '../db/events_repo.ts';

// The words that ride alongside the card. Kept short and factual — the picture is
// doing the persuading, and a receiver reading a sales pitch from their mate
// discounts both.
export function shareLine(d: EventDetail): string {
  const bits = [d.date, d.locationKind === 'online' ? 'online' : (d.location || '').split(',')[0]].filter(Boolean);
  return `${d.title}${bits.length ? ` · ${bits.join(' · ')}` : ''}`;
}

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
  // Invite-only: the OTHER side isn't claimable by whoever clicks first. Only the
  // organiser invites it, via a private link meant for the rival's manager. The
  // organiser sees "Invite the other side" (mints/shows the link); everyone else
  // sees a waiting state. (An unclaimed non-side placeholder, e.g. an athlete on
  // the card, is just a name until they're invited too.)
  const claimBtn = (p: EventParty) => d.isOrganizer
    ? `<form method="post" action="/e/${d.eventId}/party/${p.id}/invite"><button class="rb sm p" type="submit">Invite the other side →</button></form>`
    : `<span class="mut" style="font-size:12px">Awaiting ${p.role === 'side' ? 'the other side' : 'this participant'} — the organiser sends the invite</span>`;
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
  isHost?: boolean; isCoOrg?: boolean;
  // a co-organizer's read-only panel: their promo link + event stats (no editing)
  coOrg?: { promoToken: string | null; going: number; draw: { identities: number; ticketBuyers: number } | null } | null;
  myEntities?: { kind: string; id: string; name: string }[];
  myTicket?: { id: string; status: string; listPriceCents: number | null } | null;
  listings?: { id: string; priceCents: number; seller: string }[];
  extraTop?: string;
  stickyCta?: string;
  hasAccess?: boolean;       // may the viewer see the watch/join link right now?
  shareRef?: string | null;  // this viewer's attributable ?via= token (logged-in only)
  hostLinks?: Record<string, string>;  // host's public socials — the way to reach them
  origin?: string;           // absolute origin — og:image MUST be absolute or crawlers drop it
  listable?: boolean;        // public + listed → emit schema.org Event JSON-LD for AI/search
  going?: number;            // tickets sold, for schema.org availability (SoldOut vs InStock)
  parties?: EventParty[];    // multi-party line-up (organizers, sides, roster)
  subs?: SubEvent[];         // sub-events (fight card / race-within-race)
  parent?: { id: string; title: string } | null;  // if this is a sub-event
  canClaim?: boolean;        // viewer owns an entity that could claim an unclaimed slot
  myPromoToken?: string | null;  // the viewer's own participant promo link (+ their draw)
  myPromoDraw?: { identities: number; ticketBuyers: number };
}): string {
  const my = ctx.myRsvp;
  // "Club A vs Club B" belongs right under the event name — the matchup is the
  // headline. The main organiser still lives in "Hosted by"; this line is the two
  // sides. For a multi-participant event we show the first couple of names as an
  // at-a-glance overview instead.
  const _parties = ctx.parties ?? [];
  const _sideA = _parties.find(p => p.role === 'side' && p.side === 'A');
  const _sideB = _parties.find(p => p.role === 'side' && p.side === 'B');
  const _pn = (p?: EventParty) => p ? esc(p.name || 'TBD') : 'TBD';
  const versusLine = (d.archetype === 'versus' && (_sideA || _sideB))
    ? `<div class="pversus">${_pn(_sideA)} <span class="vsx">vs</span> ${_pn(_sideB)}</div>`
    : (d.archetype === 'multi'
        ? (() => { const named = _parties.filter(p => (p.role === 'side' || p.role === 'attending_athlete') && p.name); return named.length ? `<div class="pversus pmulti">${named.slice(0, 3).map(p => esc(p.name)).join(' · ')}${named.length > 3 ? ` +${named.length - 3}` : ''}</div>` : ''; })()
        : '');
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

  // RESALE AND GIFTING ARE NOT OFFERED — and this is where they used to be.
  //
  // A "Sell" box and a "Resale" shelf rendered here for months while the AGB
  // said, in writing, that tickets are personengebunden and resale is not
  // offered. The page and the contract disagreed; the page was wrong.
  //
  // Both are also built on the legacy bearer-`ticket` table, which the claim rail
  // replaced: they hand over a ticket rather than reissuing it, so the old QR
  // stays live and one screenshot admits two people. The logic that replaces them
  // (void + reissue + ledger) lives in src/db/transfer_repo.ts, switched off.
  //
  // Nothing renders here on purpose. Don't reintroduce a "coming soon" — a
  // resale affordance is a promise, and it changes who buys a ticket and why.
  const ticketSection = '';
  const resaleSection = '';

  // SHARING SENDS THE CARD, NOT A LINK.
  //
  // `card` is the PNG at /e/:id/card.png — the same picture that unfurls in
  // WhatsApp (og:image) and the same file the OS share sheet hands to Instagram.
  // A bare URL asks the receiver to trust a stranger's link; the card tells them
  // what, when, where and how much before they decide.
  const cardUrl = `/e/${d.id}/card.png`;
  const extras = [
    shareButton({ title: d.title, cls: 'rb', label: 'Share', img: cardUrl, text: shareLine(d) }),
    `<a class="rb" href="/e/${d.id}/ics">＋ Add to calendar</a>`,
  ];
  if (ctx.isHost) extras.push(`<a class="rb" href="/manage/${d.id}">Manage</a>`);

  // Attributable share = only once we know who you are (logged in). We hand out a
  // personal /e/:id?via=<token> link; every claim through it is credited to you.
  // The card travels with it — the ?via= token rides in the URL, so the picture
  // is identical and the credit is intact.
  const attributableShare = (!ctx.guest && ctx.shareRef)
    ? `<div class="cap" style="margin-top:18px">Bring your crowd</div>
       <div class="rsvp">${shareButton({ title: d.title, cls: 'rb p', label: 'Share the matchday card', url: `/e/${d.id}?via=${ctx.shareRef}`, img: cardUrl, text: shareLine(d) })}</div>
       <p class="mut" style="font-size:12px;margin:2px 0 0">Sends the whole card. Claims from it are credited to you — a plain Share above stays anonymous.</p>
       <details style="margin-top:8px"><summary class="mut" style="font-size:12px;cursor:pointer">See the card</summary>
         <img src="${esc(cardUrl)}" alt="Preview of the shareable matchday card for ${esc(d.title)}" loading="lazy"
              style="width:100%;max-width:420px;margin-top:8px;border:1px solid var(--b);border-radius:12px;display:block">
       </details>`
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
  // Maps: ASK which one, don't guess. See src/web/maps.ts — guessing Google on an
  // iPhone costs someone the first ten minutes of the event they paid for.
  const hasVenue = !!d.location && d.locationKind !== 'online';
  const mapsBtn = (cls: string, label?: string) => hasVenue ? mapsChooser({ query: d.location!, cls, label }) : '';

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
    /* The inline maps trigger reads as the link it replaced, not as a button —
       it sits in a line of muted metadata and shouldn't shout. */
    .maplink{color:var(--mut);border-bottom:1px solid var(--b);font-size:12.5px}
    .maplink:hover{color:var(--bone)}
    /* "Club A vs Club B" under the event name — the matchup is the headline. */
    .pversus{font-weight:800;font-size:15px;margin:2px 0 2px;color:var(--bone);letter-spacing:-.01em}
    .pversus .vsx{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:0 4px}
    .pversus.pmulti{font-weight:600;font-size:13.5px;color:var(--mut)}
  </style>
  <div class="poster">
    ${d.coverUrl ? `<img src="${esc(d.coverUrl)}" alt="">` : `<div style="width:100%;height:100%;background:radial-gradient(130% 130% at 70% 8%,rgba(237,233,223,.12),transparent 55%),var(--ink)"></div>`}
    <div class="pcap">
      <span class="pkick">${esc(ADMISSION_LABEL[d.admission])}</span>
      <div class="ptitle">${esc(d.title)}</div>
      ${versusLine}
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
      ${d.location ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">${d.locationKind === 'online' ? 'Online event' : esc(d.location)}</div><div class="ws">${d.locationKind === 'online' ? (canWatch ? `<a href="${esc(d.location)}" target="_blank" rel="noopener">Join link ↗</a>` : `<span class="mut">🔒 Link revealed after you claim</span>`) : d.locationKind === 'hybrid' ? `In person + streamed${hasVenue ? ` · ${mapsBtn('maplink', 'Maps')}` : ''}` : mapsBtn('maplink')}</div></div></div>` : (d.locationKind === 'online' ? `<div class="ww"><div class="wi">${ICON.pin}</div><div><div class="wt">Online event</div></div></div>` : '')}

      ${watch ? `<div class="h3">Watch live</div><div class="rsvp">${watch}</div>` : ''}

      ${ctx.parent ? `<div class="lockrow" style="border-style:solid">Part of <a class="hl" href="/e/${ctx.parent.id}" style="color:var(--bone);border-bottom:1px solid var(--b)">${esc(ctx.parent.title)}</a> — one ticket covers the whole event.</div>` : ''}
      ${renderRoster({ eventId: d.id, archetype: d.archetype, parties: ctx.parties ?? [], guest: ctx.guest, canClaim: !!ctx.canClaim, isOrganizer: !!ctx.isHost })}
      ${ctx.myPromoToken ? `<div class="card" style="border-color:var(--bone);margin-top:10px"><strong>Your promo link.</strong> <span class="mut">Every claim through it is credited to you.</span>
        <div class="rsvp" style="margin-top:8px">${shareButton({ title: d.title, cls: 'rb p', label: 'Copy my promo link', url: `/e/${d.id}?p=${ctx.myPromoToken}` })}</div>
        <div class="mut" style="font-size:12.5px;margin-top:6px">You've driven <b style="color:var(--bone)">${ctx.myPromoDraw?.identities ?? 0}</b> identities · <b style="color:var(--bone)">${ctx.myPromoDraw?.ticketBuyers ?? 0}</b> ticket buyers.</div></div>` : ''}
      ${(ctx.subs && ctx.subs.length) ? `<div class="h3">On the card${ctx.isHost ? '' : ''} · ${ctx.subs.length}</div><div class="rsvp" style="flex-direction:column;align-items:stretch">${ctx.subs.map(s => `<a class="rb" style="text-align:left" href="/e/${s.id}">${esc(s.title)}${s.date ? ` <span class="mut">· ${esc(s.date)}</span>` : ''}</a>`).join('')}</div>` : ''}
      ${ctx.isHost && !ctx.parent ? `<div class="rsvp"><a class="rb" href="/host/${d.hostKind}/${d.hostId}/new?parent=${d.id}">＋ Add a bout / sub-event</a><span class="mut" style="font-size:12px;align-self:center">Same day as the main event</span></div>` : ''}
      ${ctx.coOrg ? `<div class="card" style="border-color:var(--bone);margin-top:12px"><strong>You're co-organising this.</strong> <span class="mut">You can promote it with your own link and see how the event is doing — only the main organiser edits the event or adds bouts.</span>
        <div class="rsvp" style="margin-top:8px">${ctx.coOrg.promoToken ? shareButton({ title: d.title, cls: 'rb p', label: 'Copy my promo link', url: `/e/${d.id}?p=${ctx.coOrg.promoToken}` }) : ''}</div>
        <div class="mut" style="font-size:12.5px;margin-top:8px">Event so far: <b style="color:var(--bone)">${ctx.coOrg.going}</b> going${ctx.coOrg.draw ? ` · your link drove <b style="color:var(--bone)">${ctx.coOrg.draw.identities}</b> people · <b style="color:var(--bone)">${ctx.coOrg.draw.ticketBuyers}</b> ticket buyers` : ''}.</div></div>` : ''}

      ${ticketSection}${resaleSection}

      ${d.description ? `<div class="h3">About this event</div><p class="desc">${esc(d.description)}</p>` : ''}

      ${hasVenue ? `<div class="h3">Location</div><p class="desc" style="margin-bottom:8px">${esc(d.location)}</p><div class="rsvp">${mapsBtn('rb')}</div>` : ''}

      <div class="h3">More</div>
      <div class="rsvp">${extras.join('')}</div>
      ${feature}
      <div class="prov">Public event · viewing is open; attending needs a free account. Calendar export &amp; watch links are open to members.</div>
    </main>
  </div>
  ${ctx.stickyCta ? `<div style="height:76px"></div>${ctx.stickyCta}` : ''}`;
  // og:image MUST be absolute — every crawler drops a relative one, and dropping
  // it is silent. Without `origin` we emit no image rather than a broken one.
  const og = ogMeta({
    title: d.title,
    description: `${shareLine(d)} · Hosted by ${d.hostName} on Horda.`,
    url: ctx.origin ? `${ctx.origin}/e/${d.id}` : undefined,
    image: ctx.origin ? `${ctx.origin}${cardUrl}` : null,
    type: 'article',
  });
  // schema.org/Event JSON-LD — the structured fact an AI answer engine reads when
  // someone asks "what's on this weekend?". Only for PUBLIC, LISTED, dated events,
  // and only when we know the absolute origin (a relative URL is useless to a
  // crawler). Unlisted events never emit it — private stays private.
  const jsonLd = (ctx.listable && ctx.origin && d.startsAt) ? eventJsonLd({
    id: d.id, title: d.title, description: d.description, startsAt: d.startsAt, timezone: d.timezone,
    location: d.location, locationKind: d.locationKind, admission: d.admission,
    priceCents: d.priceCents, currency: d.currency || 'EUR',
    coverUrl: d.coverUrl && /^https?:\/\//i.test(d.coverUrl) ? d.coverUrl : null,
    hostName: d.hostName, hostUrl: `${ctx.origin}${hostHref(d.hostKind, d.hostId)}`,
    eventUrl: `${ctx.origin}/e/${d.id}`, capacity: d.capacity, going: ctx.going,
  }) : '';
  // Pass the REAL viewer state to the chrome. Without a `nav`, layout() defaults
  // to `{ guest: true, fanId: null }` — so the desktop rail showed "Log in / Join
  // free" to a logged-in fan looking at their own event. The event page just
  // never told the shell who was looking.
  return layout(d.title, body, {
    back: hostHref(d.hostKind, d.hostId),
    head: og + jsonLd,
    nav: { active: 'explore', guest: ctx.guest, fanId: ctx.fanId },
  });
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
// `defaultSport` = the host's own sport, pre-selected (see the topsel comment).
export function renderCreateEvent(hostKind: string, hostId: string, hostName: string, parent?: { id: string; title: string }, defaultSport?: string | null, viewerFanId?: string | null): string {
  const fld = 'display:block;margin:12px 0;font-size:13px;color:var(--mut)';
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  const body = `
  <h1>${parent ? 'Add a sub-event' : 'Schedule an event'}</h1>
  <p class="mut">${parent ? `Under <b style="color:var(--bone)">${esc(parent.title)}</b> — a bout or race-within-the-race. It gets its own sides and promo links; attribution rolls up.` : `As ${esc(hostName)}. Choose the shape, who's on the card, and how fans get in.`}</p>
  <form method="post" action="/events" id="evform" onsubmit="return hzPrep(this)">
    <input type="hidden" name="host_kind" value="${esc(hostKind)}"><input type="hidden" name="host_id" value="${esc(hostId)}">
    ${parent ? `<input type="hidden" name="parent_id" value="${esc(parent.id)}">` : ''}

    ${/* The two framing choices, small but always visible at the top: who can
        find this, and what sport it is. Sport defaults to the organiser's — the
        right answer ~95% of the time — but stays one click from changing, and
        "Other" exists because a football club throwing a summer party is still
        an event. Without a sport, the discovery filter silently can't see it. */''}
    <div class="topsel">
      <label class="tsel">
        <select name="visibility" id="ev_vis">
          <option value="public">🌍 Public — anyone can find it</option>
          <option value="unlisted">🔒 Private — only people with the link</option>
        </select>
      </label>
      <label class="tsel">
        ${sportSelect('sport', defaultSport ?? null, 'appearance:none')}
      </label>
    </div>
    <p class="mut" id="ev_vis_hint" style="font-size:12px;margin:0 0 4px">Listed on Horda, in search and on your page.</p>

    <label style="${fld}">Event name<input style="${inp}" name="title" required placeholder="${parent ? 'Rico vs. Tariq' : 'Open sparring night'}"></label>

    ${/* Event image. Deliberately near the top, not buried in the details fold:
        the picture is what makes a card get clicked, and if you don't ask for it
        while the organiser is still excited about their event, you never get it.
        It renders on the event page AND on every feed card. Without one we
        generate a themed backdrop, so a card is never empty — but a real photo
        beats generated art every time, so the empty state says so. */''}
    <div style="${fld}">Event image <span class="mut">(optional)</span>
      <label class="cvdrop" id="ev_cover_drop">
        <input type="file" accept="image/*" data-target="cover" id="ev_cover_in" hidden>
        <img id="ev_cover_prev" alt="" hidden>
        <span class="cvhint" id="ev_cover_hint">
          <b>Add a photo</b>
          <i>Shows on the event page and on every card in the feed. Landscape works best. Skip it and we'll generate one.</i>
        </span>
      </label>
      <button type="button" class="cvclear" id="ev_cover_clear" hidden>Remove image</button>
    </div>
    <input type="hidden" name="cover">
    <label style="${fld}">Shape
      <select id="ev_arch" name="archetype" style="${inp}" onchange="var v=this.value;document.getElementById('ev_versus').style.display=v==='versus'?'block':'none';document.getElementById('ev_roster').style.display=v==='multi'?'block':'none'">
        <option value="single">Single — one host, open roster (a run club, a mass race)</option>
        <option value="versus"${parent ? ' selected' : ''}>Versus — two sides (a match, a bout); both promote to their fans</option>
        <option value="multi">Multi-participant — many attending clubs/athletes on the card</option>
      </select></label>
    ${/* Rival + roster typeahead.
        Why this is more than a nicety: naming a rival as free text always mints
        an UNCLAIMED placeholder. If that rival is already on Horda and you type
        their name a shade differently ("FC Rival" vs "1. FC Rival"), you create
        a duplicate ghost — and that side's attribution accrues to nobody, which
        is the one number the whole product sells. Suggesting real entities is
        what keeps the graph joined up. Free text still works (the whole point is
        listing rivals who AREN'T here yet) — we just look first. */''}
    <div id="ev_versus" style="display:${parent ? 'block' : 'none'}">
      <label style="${fld}">Side B (the rival)
        <input style="${inp}" name="side_b_name" id="ev_sideb" autocomplete="off" placeholder="Start typing — we'll find them on Horda">
      </label>
      <input type="hidden" name="side_b_kind" id="ev_sideb_kind">
      <input type="hidden" name="side_b_id" id="ev_sideb_id">
      <div class="acbox" id="ev_sideb_ac" hidden></div>
      <p class="mut" style="font-size:12px;margin:-6px 0 0">You're side A. List side B even if they're not on Horda yet — they join to claim their side, their fans and their ticket share.</p>
    </div>
    <div id="ev_roster" style="display:none">
      <label style="${fld}">On the card
        <input style="${inp}" id="ev_roster_in" autocomplete="off" placeholder="Start typing a name, then pick or press Enter">
      </label>
      <div class="acbox" id="ev_roster_ac" hidden></div>
      <div class="chips" id="ev_roster_chips"></div>
      <input type="hidden" name="roster" id="ev_roster_val">
      <input type="hidden" name="roster_ids" id="ev_roster_ids">
      <p class="mut" style="font-size:12px;margin:6px 0 0">Each becomes an attending slot with its own promo link; they claim it by joining.</p>
    </div>
    <style>
      .acbox{position:relative;margin-top:-4px;border:1px solid var(--b);border-radius:12px;background:var(--s);overflow:hidden}
      .acbox .ac{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--b);font-size:14px}
      .acbox .ac:last-child{border-bottom:0}
      .acbox .ac:hover,.acbox .ac.sel{background:rgba(237,233,223,.08)}
      .acbox .av{width:26px;height:26px;border-radius:8px;object-fit:cover;background:rgba(237,233,223,.12);flex:0 0 auto}
      .acbox .mt{color:var(--mut);font-size:12px}
      .acbox .kd{margin-left:auto;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:1px 7px}
      .acbox .new{color:var(--mut)}
      .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      .chips .chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--b);border-radius:999px;padding:5px 11px;font-size:13px;background:var(--s)}
      .chips .chip.known{border-color:var(--acc)}
      .chips .chip b{font-weight:600}
      .chips .chip .x{cursor:pointer;color:var(--mut);font-weight:700}
      .chips .chip .onh{font-size:10px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em}
    </style>
    <script>(function(){
      // Shared typeahead against /api/entities. Debounced, keyboard-navigable,
      // and always offers "use as typed" so an off-Horda rival is never blocked.
      function look(q, sport, cb){
        if(q.trim().length < 2){ cb([]); return; }
        fetch('/api/entities?q='+encodeURIComponent(q)+(sport?'&sport='+encodeURIComponent(sport):''))
          .then(function(r){ return r.ok ? r.json() : {results:[]} })
          .then(function(j){ cb(j.results||[]) }).catch(function(){ cb([]) });
      }
      function sportNow(){ var s=document.querySelector('[name=sport]'); return s ? s.value : ''; }
      function row(e){
        var av = e.avatar ? '<img class="av" src="'+e.avatar+'" alt="">' : '<span class="av"></span>';
        var meta = [e.sport, e.region].filter(Boolean).join(' · ');
        return av+'<span><b>'+e.name+'</b>'+(meta?'<br><span class="mt">'+meta+'</span>':'')+'</span>'+
               '<span class="kd">'+e.kind+(e.verified?' ✓':'')+'</span>';
      }
      function attach(input, box, onPick){
        var t, items=[], idx=-1;
        function close(){ box.hidden=true; box.innerHTML=''; idx=-1; }
        function paint(res){
          items=res;
          if(!res.length && input.value.trim().length<2){ close(); return; }
          var h = res.map(function(e,i){ return '<div class="ac" data-i="'+i+'">'+row(e)+'</div>' }).join('');
          h += '<div class="ac new" data-i="-1">Use "<b>'+input.value.replace(/[<>&]/g,'')+'</b>" — not on Horda yet</div>';
          box.innerHTML=h; box.hidden=false;
          Array.prototype.forEach.call(box.querySelectorAll('.ac'), function(el){
            el.onmousedown=function(ev){ ev.preventDefault(); var i=+el.getAttribute('data-i'); onPick(i>=0?items[i]:null, input.value); close(); };
          });
        }
        input.addEventListener('input', function(){
          clearTimeout(t); var v=input.value;
          t=setTimeout(function(){ look(v, sportNow(), paint) }, 180);
        });
        input.addEventListener('keydown', function(ev){
          if(box.hidden) { if(ev.key==='Enter' && input.id==='ev_roster_in'){ ev.preventDefault(); onPick(null, input.value); } return; }
          var els=box.querySelectorAll('.ac');
          if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){
            ev.preventDefault(); idx += (ev.key==='ArrowDown'?1:-1);
            if(idx<0) idx=els.length-1; if(idx>=els.length) idx=0;
            Array.prototype.forEach.call(els,function(e,i){ e.classList.toggle('sel', i===idx) });
          } else if(ev.key==='Enter'){
            ev.preventDefault(); var i = idx>=0 ? +els[idx].getAttribute('data-i') : -1;
            onPick(i>=0?items[i]:null, input.value); close();
          } else if(ev.key==='Escape'){ close(); }
        });
        input.addEventListener('blur', function(){ setTimeout(close, 120) });
      }
      // --- Side B (single) ---
      var sb=document.getElementById('ev_sideb');
      if(sb) attach(sb, document.getElementById('ev_sideb_ac'), function(e, raw){
        sb.value = e ? e.name : raw;
        document.getElementById('ev_sideb_kind').value = e ? e.kind : '';
        document.getElementById('ev_sideb_id').value   = e ? e.id   : '';
      });
      // --- Roster (multi → chips) ---
      var ri=document.getElementById('ev_roster_in'), chips=document.getElementById('ev_roster_chips');
      var picked=[];
      function sync(){
        document.getElementById('ev_roster_val').value = picked.map(function(p){return p.name}).join(', ');
        document.getElementById('ev_roster_ids').value = picked.map(function(p){return p.id?(p.kind+':'+p.id):''}).join(',');
        chips.innerHTML = picked.map(function(p,i){
          return '<span class="chip'+(p.id?' known':'')+'"><b>'+p.name.replace(/[<>&]/g,'')+'</b>'+
                 (p.id?'<span class="onh">on horda</span>':'')+'<span class="x" data-i="'+i+'">×</span></span>';
        }).join('');
        Array.prototype.forEach.call(chips.querySelectorAll('.x'), function(x){
          x.onclick=function(){ picked.splice(+x.getAttribute('data-i'),1); sync(); };
        });
      }
      if(ri) attach(ri, document.getElementById('ev_roster_ac'), function(e, raw){
        var nm = e ? e.name : (raw||'').trim();
        if(!nm) return;
        if(!picked.some(function(p){ return p.name.toLowerCase()===nm.toLowerCase() }))
          picked.push({ name:nm, kind:e?e.kind:null, id:e?e.id:null });
        ri.value=''; sync();
      });
    })();</script>
    ${/* The time the organiser types is WALL-CLOCK at the venue. The browser
        knows which zone they're in; the server cannot guess it. Without this
        hidden field the naive string was resolved in the SERVER's zone, and the
        calendar export sent fans to the venue an hour out. Captured on load, and
        shown back so it's never a silent assumption. */''}
    <label style="${fld}">Date &amp; time<input style="${inp}" type="datetime-local" name="starts_at" id="ev_when" required>
      <small class="mut" id="ev_tzhint" style="display:block;margin-top:5px;font-size:12px"></small></label>
    <input type="hidden" name="timezone" id="ev_tz">

    ${/* WHERE drives HOW THEY GET IN.
        The old form asked "How do people get in?" as a free-standing question
        with three jargon options (ticket / link / public) that only made sense
        if you already knew the data model — and it sat alongside a SECOND
        overlapping question ("Admission": open/register/apply/paid) and a THIRD
        (per-format prices). Three systems, one decision. That's why it read as
        unclear. Now: pick where it happens, and the get-in options are the ones
        that can possibly apply. access_mode is derived on submit, not asked. */''}
    <label style="${fld}">Where
      <select id="ev_loc_kind" name="location_kind" style="${inp}">
        <option value="in_person">In person — at a venue</option>
        <option value="online">Online — a stream or call</option>
        <option value="hybrid">Both — in person and streamed</option>
      </select></label>

    <div id="ev_addr_wrap">
      <label style="${fld}" id="ev_addr_lbl">Address
        <input style="${inp}" name="location" id="ev_loc" autocomplete="off" placeholder="Start typing a venue or address…">
      </label>
      <div class="acbox" id="ev_loc_ac" hidden></div>
    </div>

    ${/* WAYS TO GET IN — one block per door, not one radio for the event.
        An event can genuinely have TWO doors: 200 people in the hall AND anyone
        on the stream, each with its own price and its own capacity, and the FAN
        picks which one. v80 modelled this as a single radio, which quietly made
        hybrid events impossible to express — you could say "in person and
        streamed" under Where and then only offer one way to actually attend.
        Each block is a format (event_format); the fan's claim binds to one. */''}
    <div style="${fld}">How do people get in?
      <p class="mut" style="font-size:12px;margin:2px 0 8px">Offer one or both. Fans pick the one they want and claim a spot — you see who's coming to each.</p>

      <div class="way" id="way_ip">
        <label class="wayhead"><input type="checkbox" name="fmt_inperson" value="1" checked id="ip_on">
          <span><b>In person</b><i>They claim a spot and get a QR ticket you scan at the door.</i></span></label>
        <div class="waybody" id="ip_body">
          <div class="segs">
            <label class="seg"><input type="radio" name="ip_cost" value="free" checked><span>Free</span></label>
            <label class="seg"><input type="radio" name="ip_cost" value="paid"><span>Paid</span></label>
          </div>
          <label class="wf" id="ip_price_wrap" hidden>Ticket price €
            <input name="fmt_inperson_price" inputmode="decimal" placeholder="15"></label>
          <label class="wf">Spots <span class="mut">(blank = unlimited)</span>
            <input type="number" name="fmt_inperson_cap" min="1" placeholder="Unlimited"></label>
          <label class="wf">How many can one person claim?
            <select name="fmt_inperson_maxpp">
              <option value="1">Just themselves</option>
              <option value="2">Up to 2</option>
              <option value="4">Up to 4</option>
              <option value="6">Up to 6</option>
              <option value="10">Up to 10</option>
            </select>
            <small>Let fans bring people — they claim the spots in one go.</small></label>
        </div>
      </div>

      <div class="way" id="way_st">
        <label class="wayhead"><input type="checkbox" name="fmt_stream" value="1" id="st_on">
          <span><b>Watch online</b><i>They claim a spot to unlock the stream — so you know who watched.</i></span></label>
        <div class="waybody" id="st_body">
          <div class="segs">
            <label class="seg"><input type="radio" name="st_cost" value="free" checked><span>Free</span></label>
            <label class="seg"><input type="radio" name="st_cost" value="paid"><span>Paid</span></label>
            <label class="seg"><input type="radio" name="st_cost" value="open"><span>Open to all</span></label>
          </div>
          <p class="mut segnote" id="st_note" style="font-size:11.5px;margin:2px 0 0"></p>
          <label class="wf" id="st_price_wrap" hidden>Stream price €
            <input name="fmt_stream1_price" inputmode="decimal" placeholder="8"></label>
          <label class="wf">Watch link
            <input name="fmt_stream1_url" placeholder="https://youtube.com/… · twitch.tv/… · zoom"></label>
          <label class="wf">What to call it <span class="mut">(optional)</span>
            <input name="fmt_stream1_label" placeholder="YouTube Live"></label>
          ${/* Online events have caps too — a webinar licence, a Zoom room, a
              media deal with a viewer ceiling. Capacity is per DOOR, so a
              sold-out hall never closes the stream and a full stream never
              closes the hall. */''}
          <label class="wf" id="st_cap_wrap">Seats <span class="mut">(blank = unlimited)</span>
            <input type="number" name="fmt_stream1_cap" min="1" placeholder="Unlimited">
            <small>For a webinar or a room with a licence limit. Counted separately from the venue.</small></label>
        </div>
      </div>
    </div>

    ${/* Capacity: unlimited is the default and the common case. Asking for a
        number up front implies a limit exists and invents a decision. You opt
        IN to a limit, then set it, then choose whether overflow waits. */''}
    <div style="${fld}">
      ${/* The hidden 0 makes the field ALWAYS present. Without it an unchecked
           box submits nothing, and "the user unticked this" becomes
           indistinguishable from "this caller predates the field" — so the
           server could not tell whether to honour a posted capacity. */''}
      <input type="hidden" name="capacity_limited" value="0">
      <label class="tgl"><input type="checkbox" id="ev_cap_on" name="capacity_limited" value="1">
        <span><b>Limit how many people can come</b><i>Off = unlimited.</i></span></label>
      <div id="ev_cap_wrap" hidden style="padding-left:26px">
        <label style="${fld}">Maximum<input style="${inp}" type="number" name="capacity" min="1" placeholder="120"></label>
        <label class="tgl"><input type="checkbox" name="waitlist_enabled" value="1" checked>
          <span><b>Add a waitlist once it's full</b><i>Extra claims queue up instead of being turned away — and you see real demand.</i></span></label>
      </div>
      <label class="tgl"><input type="checkbox" name="approval_required" value="1">
        <span><b>Genehmigung erforderlich — you approve each request</b><i>People request a spot; nobody's in until you say yes.</i></span></label>
    </div>

    ${/* Everything below is optional. Collapsed so the first screen is the
        decision, not the paperwork — an event you can create in 20 seconds is an
        event that gets created. */''}
    <details class="more">
      <summary>Add details — description, cover, line-up, repeats</summary>
      ${/* The cover input lives up top now — two inputs writing the same hidden
           cover field would race, and the last one to fire would win. */''}
      <label style="${fld}">About this event<textarea style="${inp};min-height:90px" name="description" placeholder="What's happening, who's invited, what to expect…"></textarea></label>
      <label style="${fld}">Repeats
        <select name="recurrence" style="${inp}">
          <option value="none">One-off</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select></label>
      <label style="${fld}">How many times<input style="${inp}" type="number" name="recurrence_count" min="1" max="52" placeholder="10"></label>
      <label style="${fld}">Or paste a season — one per line: <span class="mut">Title | 2026-08-01 19:00 | Venue</span>
        <textarea style="${inp};min-height:80px" name="season_schedule" placeholder="Round 1 · SC Berlin vs FC Köln | 2026-08-01 19:00 | Olympiastadion"></textarea></label>
      <label style="${fld}">Second stream — link<input style="${inp}" name="fmt_stream2_url" placeholder="https://…"></label>
      <label style="${fld}">Second stream — label<input style="${inp}" name="fmt_stream2_label" placeholder="Media partner"></label>
    </details>

    <input type="hidden" name="fmt_inperson" value="1">
    <div class="row"><button type="submit">Publish event</button></div>
  </form>
  <style>
    .topsel{display:flex;gap:9px;flex-wrap:wrap;margin:4px 0 0}
    .topsel .tsel{flex:1;min-width:170px}
    .topsel select{width:100%;background:var(--s);border:1px solid var(--b);border-radius:var(--btnr);color:var(--bone);padding:9px 11px;font:inherit;font-size:13.5px}
    .way{border:1.5px solid var(--b);border-radius:14px;background:var(--s);margin-bottom:9px;overflow:hidden}
    .way:has(.wayhead input:checked){border-color:var(--acc)}
    .way[hidden]{display:none}
    .wayhead{display:flex;gap:10px;align-items:flex-start;padding:13px 14px;cursor:pointer;margin:0}
    .wayhead input{margin-top:3px;accent-color:var(--acc);flex:0 0 auto}
    .wayhead b{display:block;color:var(--bone);font-size:14.5px;font-weight:600}
    .wayhead i{display:block;color:var(--mut);font-size:12.5px;font-style:normal;line-height:1.5;margin-top:2px}
    .waybody{padding:0 14px 14px 40px;display:none}
    .way:has(.wayhead input:checked) .waybody{display:block}
    .segs{display:inline-flex;border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:4px}
    .seg{margin:0;cursor:pointer}
    .seg input{position:absolute;opacity:0;width:0;height:0}
    .seg span{display:block;padding:6px 14px;font-size:13px;color:var(--mut);border-right:1px solid var(--b)}
    .seg:last-child span{border-right:0}
    .seg:has(input:checked) span{background:var(--acc);color:var(--accink);font-weight:600}
    .wf{display:block;margin:10px 0 0;font-size:12.5px;color:var(--mut)}
    .wf input,.wf select{display:block;width:100%;margin-top:5px;background:var(--ink);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:9px 10px;font:inherit;font-size:14px}
    .wf small{display:block;color:var(--mut);font-size:11.5px;margin-top:4px}
    .wf[hidden]{display:none}
    .tgl{display:flex;gap:10px;align-items:flex-start;margin:10px 0;cursor:pointer}
    .tgl input{margin-top:3px;accent-color:var(--acc);flex:0 0 auto}
    .tgl b{display:block;color:var(--bone);font-size:14px;font-weight:600}
    .tgl i{display:block;color:var(--mut);font-size:12.5px;font-style:normal;line-height:1.5}
    .cvdrop{display:flex;align-items:center;justify-content:center;position:relative;margin-top:8px;min-height:132px;
      border:1.5px dashed var(--b);border-radius:16px;background:var(--s);cursor:pointer;overflow:hidden;text-align:center;padding:18px}
    .cvdrop:hover{border-color:var(--acc)}
    .cvdrop img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .cvhint b{display:block;color:var(--bone);font-size:14.5px;font-weight:600;margin-bottom:4px}
    .cvhint i{display:block;color:var(--mut);font-size:12.5px;font-style:normal;line-height:1.5;max-width:42ch}
    .cvclear{margin-top:8px;background:transparent;border:1px solid var(--b);border-radius:var(--btnr);color:var(--mut);padding:6px 12px;font:inherit;font-size:12.5px;cursor:pointer}
    .cvclear:hover{color:var(--bone);border-color:var(--bone)}
    .more{border-top:1px solid var(--b);margin-top:16px;padding-top:6px}
    .more summary{cursor:pointer;font-size:13.5px;font-weight:600;color:var(--bone);padding:8px 0;list-style:none}
    .more summary::-webkit-details-marker{display:none}
    .more summary::before{content:"＋ ";color:var(--mut)}
    .more[open] summary::before{content:"− "}
  </style>
  <script>(function(){
    var form=document.getElementById('evform'); if(!form) return;

    // --- 0. the organiser's timezone --------------------------------------
    // Everything downstream (the true instant, the ICS, "starts in 2h") depends
    // on knowing which zone "20:00" was typed in.
    (function(){
      var tzf = document.getElementById('ev_tz'), hint = document.getElementById('ev_tzhint');
      var tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e) {}
      tzf.value = tz;
      if (hint && tz) hint.textContent = 'Times are in ' + tz.replace(/_/g,' ') + ' — the venue\'s local time, which is what fans will see.';
    })();

    // --- 1. WHERE → which get-in options can apply -------------------------
    // The options aren't a fixed menu; they're the subset that makes sense for
    // the place. Selecting an option that's been hidden would submit nonsense,
    // so we always re-point the selection at the first visible one.
    var where=document.getElementById('ev_loc_kind');
    var addrLbl=document.getElementById('ev_addr_lbl');
    var wayIp=document.getElementById('way_ip'), wayS=document.getElementById('way_st');
    var ipOn=document.getElementById('ip_on'), stOn=document.getElementById('st_on');
    function applyWhere(){
      var w=where.value;
      // Where decides which doors can EXIST. Both may be open at once — that's
      // the whole point of hybrid, and what v80 got wrong.
      wayIp.hidden = (w==='online');
      wayS.hidden  = (w==='in_person');
      if(w==='online'){ ipOn.checked=false; stOn.checked=true; }
      else if(w==='in_person'){ stOn.checked=false; ipOn.checked=true; }
      else { ipOn.checked=true; }   // hybrid: in-person on, stream is theirs to add
      // The address field means different things in different places.
      var loc=document.getElementById('ev_loc');
      if(w==='online'){ addrLbl.firstChild.textContent='Stream or call link'; loc.placeholder='https://youtube.com/… · zoom.us/…'; loc.setAttribute('data-noac','1'); }
      else { addrLbl.firstChild.textContent = w==='hybrid' ? 'Venue address' : 'Address'; loc.placeholder='Start typing a venue or address…'; loc.removeAttribute('data-noac'); }
      applyCost();
    }
    // --- 2. price fields only where a price can exist ----------------------
    function applyCost(){
      var ip=(form.querySelector('input[name=ip_cost]:checked')||{}).value;
      document.getElementById('ip_price_wrap').hidden = ip!=='paid';
      var st=(form.querySelector('input[name=st_cost]:checked')||{}).value;
      document.getElementById('st_price_wrap').hidden = st!=='paid';
      // "Open to all" is the one option that costs you the thing Horda is for,
      // so say it plainly rather than letting them find out later.
      document.getElementById('st_note').textContent = st==='open'
        ? 'Anyone can watch without claiming — you will not know who watched.'
        : '';
      // "Open to all" means nobody claims, so there is nothing to count and a
      // seat limit cannot be enforced. Hiding it is more honest than offering a
      // number we would silently ignore.
      document.getElementById('st_cap_wrap').hidden = st==='open';
    }
    where.addEventListener('change', applyWhere);
    form.addEventListener('change', function(e){ if(e.target.name==='ip_cost'||e.target.name==='st_cost') applyCost(); });

    // At least one door must be open, or the event is unattendable. Rather than
    // block submit with an error, re-open the one they just closed: the only
    // other interpretation of "no ways in" is a mistake.
    function guardWays(){
      if(!ipOn.checked && !stOn.checked){
        if(where.value==='online') stOn.checked=true; else ipOn.checked=true;
      }
    }
    ipOn.addEventListener('change', guardWays);
    stOn.addEventListener('change', guardWays);

    // --- 3. capacity: unlimited → opt in to a limit → then a waitlist ------
    var capOn=document.getElementById('ev_cap_on'), capWrap=document.getElementById('ev_cap_wrap');
    capOn.addEventListener('change', function(){ capWrap.hidden=!capOn.checked; });

    // --- 4. visibility hint ------------------------------------------------
    var vis=document.getElementById('ev_vis'), hint=document.getElementById('ev_vis_hint');
    vis.addEventListener('change', function(){
      hint.textContent = vis.value==='public'
        ? 'Listed on Horda, in search and on your page.'
        : 'Hidden from search and your page. Only people you send the link to can find it.';
    });

    // --- 5. THE LANGUAGE BUG ----------------------------------------------
    // Switching language is a full page navigation (/set-lang → back here), so
    // every field was wiped and the date reset. Nothing about that is obvious to
    // the person — they just lose their work. We snapshot the form into
    // sessionStorage on every change and restore it on load. Also covers a stray
    // back-button or accidental reload. Cleared on successful submit so a second
    // event doesn't inherit the first one's answers.
    var KEY='hz_evform_'+location.pathname;
    function snapshot(){
      try{
        var d={};
        [].forEach.call(form.elements, function(el){
          if(!el.name || el.type==='file' || el.type==='submit') return;
          if(el.type==='checkbox'||el.type==='radio'){ if(el.checked) d[el.name]=el.value; }
          else if(el.value) d[el.name]=el.value;
        });
        sessionStorage.setItem(KEY, JSON.stringify(d));
      }catch(e){}
    }
    function restore(){
      try{
        var raw=sessionStorage.getItem(KEY); if(!raw) return;
        var d=JSON.parse(raw);
        Object.keys(d).forEach(function(n){
          var els=form.elements[n]; if(!els) return;
          if(els.length && els[0] && els[0].type==='radio'){
            [].forEach.call(els, function(r){ r.checked = (r.value===d[n]); });
          } else {
            var el = els.length && !els.tagName ? els[0] : els;
            if(!el || !el.type) return;
            if(el.type==='checkbox') el.checked = true;
            else if(el.type!=='file') el.value = d[n];
          }
        });
      }catch(e){}
    }
    restore();
    form.addEventListener('input', snapshot);
    form.addEventListener('change', snapshot);
    form.addEventListener('submit', function(){ try{ sessionStorage.removeItem(KEY); }catch(e){} });

    // Re-apply the conditional UI AFTER restoring, so a restored "paid" still
    // shows its price field.
    applyWhere();
    capWrap.hidden = !capOn.checked;
    vis.dispatchEvent(new Event('change'));

    // --- 5b. cover image preview ------------------------------------------
    // UPLOAD_SCRIPT reads the file into the hidden cover field as a data URL.
    // We mirror it into an <img> so the organiser sees the actual card art
    // before publishing — "upload a file and hope" is how you get sideways
    // photos on the home screen. The preview also survives a language switch,
    // because the data URL is part of the form snapshot.
    var cin=document.getElementById('ev_cover_in'), cimg=document.getElementById('ev_cover_prev'),
        chint=document.getElementById('ev_cover_hint'), cclear=document.getElementById('ev_cover_clear'),
        chid=form.elements['cover'];
    function paintCover(){
      var v=chid && chid.value;
      if(v){ cimg.src=v; cimg.hidden=false; chint.hidden=true; cclear.hidden=false; }
      else { cimg.hidden=true; chint.hidden=false; cclear.hidden=true; }
    }
    if(cin){
      // UPLOAD_SCRIPT writes the hidden field asynchronously (FileReader), so
      // poll briefly after a pick rather than guessing when it lands.
      cin.addEventListener('change', function(){
        var tries=0, iv=setInterval(function(){
          if((chid && chid.value) || ++tries>40){ clearInterval(iv); paintCover(); snapshot(); }
        }, 50);
      });
      cclear.addEventListener('click', function(){ if(chid) chid.value=''; cin.value=''; paintCover(); snapshot(); });
      paintCover();   // restore a snapshotted image after a language switch
    }

    // --- 6. address autofill ----------------------------------------------
    // Reuses the same /api/geo the discover filter uses, so "type a coffee shop
    // and pick it" works the same everywhere.
    var loc=document.getElementById('ev_loc'), lac=document.getElementById('ev_loc_ac'), lt;
    function closeAc(){ lac.hidden=true; lac.innerHTML=''; }
    loc.addEventListener('input', function(){
      if(loc.hasAttribute('data-noac')) return;         // online → it's a URL, not a place
      clearTimeout(lt); var q=loc.value.trim();
      if(q.length<3){ closeAc(); return; }
      lt=setTimeout(function(){
        fetch('/api/geo?q='+encodeURIComponent(q)).then(function(r){return r.ok?r.json():{results:[]}}).then(function(j){
          var rs=(j.results||[]).slice(0,6);
          if(!rs.length){ closeAc(); return; }
          lac.innerHTML = rs.map(function(p){ return '<div class="ac" data-v="'+String(p.label||'').replace(/"/g,'&quot;')+'">'+String(p.label||'').replace(/[<>&]/g,'')+'</div>' }).join('');
          lac.hidden=false;
          [].forEach.call(lac.querySelectorAll('.ac'), function(el){
            el.onmousedown=function(ev){ ev.preventDefault(); loc.value=el.getAttribute('data-v'); snapshot(); closeAc(); };
          });
        }).catch(closeAc);
      }, 220);
    });
    loc.addEventListener('blur', function(){ setTimeout(closeAc, 120); });
  })();</script>${UPLOAD_SCRIPT}`;
  // Authenticated page — a guest can't schedule an event. Tell the shell so it
  // shows the logged-in rail, not "Log in / Join free".
  return layout('Schedule an event', body, { back: hostHref(hostKind, hostId), nav: { active: 'create', guest: false, fanId: viewerFanId ?? null } });
}

// owner: manage — approvals + guest list + per-format attendance breakdown
export function renderManage(d: EventDetail, guests: { response: string; status: string; fanId: string; name: string; handle: string | null }[],
  formats: { id: string; kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; going: number; revenueCents: number }[] = [],
  attribution: { fanId: string; name: string; token: string; clicks: number; claims: number }[] = [],
  promo?: { rows: { partyId: string; name: string; role: string; side: string | null; token: string; kind: string; status: string; clicks: number; identities: number; ticketBuyers: number; subEvent?: string }[]; total: { identities: number; ticketBuyers: number; clicks: number } },
  payout?: { hostKind: string; hostId: string; connected: boolean }, viewerFanId?: string | null): string {
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
  return renderManageInner(d, guests, payoutBanner + sharePanel + formatBreakdown + attributionBlock, viewerFanId ?? null);
}
function renderManageInner(d: EventDetail, guests: { response: string; status: string; fanId: string; name: string; handle: string | null }[], formatBreakdown: string, viewerFanId: string | null = null): string {
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
  // Owner-only page — always logged in. Show the real rail, not the guest one.
  return layout('Manage · ' + d.title, body, { back: `/e/${d.id}`, nav: { active: 'create', guest: false, fanId: viewerFanId ?? null } });
}
