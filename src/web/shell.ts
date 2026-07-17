// shell.ts — the shared Weverse-style dark surface used by every entity profile
// (athlete, club, team, association). One look-and-feel, strictly Ink/Bone.
import { esc } from './layout.ts';
import { socialIcon, kindIcon } from './icons.ts';
import { ravenMark, ravenMarkCurrent } from './brand.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav, backButton, deskRail, shareButton, SHARE_SCRIPT } from './theme.ts';

export interface ListItem { kind: string; label: string; href: string | null; tag?: string }
export interface ProfileVM {
  kindLabel: string;                  // "Club" / "Team" / "Association"
  entityId?: string;                  // needed by the hero Follow POST (see followCta)
  guest: boolean; fanId: string | null;
  name: string; handle?: string | null; nickname?: string | null;
  tagline?: string | null; avatarUrl?: string | null; bannerUrl?: string | null;
  links: Record<string, string>;
  tabs: { label: string; shop?: boolean }[];
  statLine?: { label: string; value: string; sub?: string };  // record / position
  notice?: string;
  post?: { author: string; body: string; date?: string };
  upcoming?: { title: string; eventId: string; date?: string; access: 'free' | 'paid_ticket'; ticketUrl?: string | null; streamUrl?: string | null } | null;
  attendance?: { mode: string } | null;
  tableHtml?: string;                 // pre-rendered standings (club/team)
  members?: { title: string; items: ListItem[] };   // sidebar marquee list (teams / roster / member clubs)
  secondary?: { title: string; items: ListItem[] };  // optional 2nd sidebar list (competitions)
  editAction?: string;                // owner edit endpoint (shows the upload panel)
  canEdit?: boolean;                  // viewer owns this entity
  events?: { id: string; title: string; date?: string; featured?: boolean; hostName?: string; mine?: boolean }[];  // scheduled + featured (mine = viewer holds a spot)
  scheduleHref?: string;              // owner: create-event endpoint
  parent?: { label: string; href: string | null };   // e.g. team -> its club
  about?: string;
  merch?: boolean;
  backHref?: string;
  activation?: string;                // owner: "finish your setup" checklist (pre-rendered)
  ogTags?: string;                    // Open Graph / Twitter card meta (pre-rendered)
}

// Owner-only edit panel: pick a crest/avatar + banner; the client reads the files
// to data URLs and posts them (no upload infra needed; stored in the URL columns).
export function editPanel(action: string): string {
  const fld = 'display:block;font-size:13px;color:rgba(237,233,223,.65);margin:10px 0';
  return `<details class="card" style="margin-bottom:16px">
    <summary style="cursor:pointer;font-weight:800;font-size:13px;letter-spacing:1.5px;text-transform:uppercase">Edit profile (owner)</summary>
    <form method="post" action="${action}" onsubmit="return hzPrep(this)" style="margin-top:10px">
      <label style="${fld}">Crest / avatar<br><input type="file" accept="image/*" data-target="avatar" style="margin-top:6px;color:inherit"></label>
      <label style="${fld}">Banner<br><input type="file" accept="image/*" data-target="banner" style="margin-top:6px;color:inherit"></label>
      <input type="hidden" name="avatar"><input type="hidden" name="banner">
      <button class="btn" type="submit" style="margin-top:6px">Save</button>
    </form>
  </details>`;
}
export const UPLOAD_SCRIPT = `<script>
function hzPrep(f){var ins=[].slice.call(f.querySelectorAll('input[type=file]'));
Promise.all(ins.map(function(i){return new Promise(function(res){var t=i.dataset.target;if(!i.files[0])return res();var r=new FileReader();r.onload=function(){var h=f.querySelector('input[name="'+t+'"]');if(h)h.value=r.result;res();};r.readAsDataURL(i.files[0]);});})).then(function(){f.submit();});return false;}
</script>`;

export function avatarSvg(name: string, glyph?: 'crest'): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || 'H';
  return `<svg viewBox="0 0 104 104" xmlns="http://www.w3.org/2000/svg"><rect width="104" height="104" fill="#0B0B0C"/><text x="52" y="54" dy=".35em" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="38" font-weight="800" fill="#EDE9DF">${esc(initials)}</text></svg>`;
}

export function renderEntityProfile(vm: ProfileVM): string {
  const gate = (real: string) => (vm.guest ? '/signup' : real);
  const ext = (href: string) => (vm.guest ? `href="/signup"` : `href="${esc(href)}" target="_blank" rel="noopener"`);
  const first = (vm.name.split(' ')[0] || vm.name).replace(/[^A-Za-z0-9]/g, '') || vm.name;

  const socials = Object.entries(vm.links ?? {}).filter(([, v]) => v)
    .map(([k, v]) => `<a class="ic" aria-label="${esc(k)}" ${ext(v)}>${socialIcon(k)}</a>`).join('');

  // THE PRIMARY CTA ON EVERY CLUB, TEAM AND ASSOCIATION PAGE DID NOTHING.
  //
  // It was `href="${gate('#join')}"` — for a guest, gate() sends them to /signup,
  // which works. For a LOGGED-IN fan it returned "#join"… and no element with
  // id="join" has ever existed on this shell. (The athlete page has one — the
  // membership block — and this shell was copied from it before that block was
  // removed by the pivot.) So the single biggest button on the page scrolled
  // nowhere for exactly the people most likely to press it.
  //
  // Now it does the thing it says: follow the crowd. Same verb as everywhere else
  // in the app, and a real POST.
  const followCta = vm.guest
    ? `<a class="btn" href="/signup">Join the Horda</a>`
    : `<form method="post" action="/follow" style="display:inline"><input type="hidden" name="fan_id" value="${esc(vm.fanId ?? '')}"><input type="hidden" name="target_type" value="${esc(vm.kindLabel.toLowerCase())}"><input type="hidden" name="target_id" value="${esc(vm.entityId ?? '')}"><button class="btn" type="submit">Join the Horda</button></form>`;
  const hero = `<div class="hero">
    ${vm.bannerUrl ? `<img class="bg" src="${esc(vm.bannerUrl)}" alt="">` : `<div class="bg ph"><span class="kick">${esc(vm.nickname || vm.name)}</span></div>`}
    <div class="heroin"><span class="kindtag">${esc(vm.kindLabel)}</span><h1>${esc(vm.name)}</h1><div style="display:flex;gap:8px;flex-wrap:wrap">${followCta}${shareButton({ title: vm.name, cls: 'btn ghost' })}</div></div>
  </div>`;

  // TABS — the entity's sections, as anchors into ONE page.
  //
  // Every tab here used to link to "#" or "#shop": a row of things that looked
  // clickable, weren't, and implied pages (Squad, Fixtures, Shop) that don't
  // exist. Now they're real anchors to the sections actually rendered below, in
  // the order the entity chose, and a section with nothing to show gets no tab.
  const secs = [
    vm.upcoming ? { key: 'nextup', label: 'Next up' } : null,
    (vm.events && vm.events.length) || (vm.scheduleHref && vm.canEdit) ? { key: 'events', label: 'Events' } : null,
    (vm.members && vm.members.items.length) || (vm.secondary && vm.secondary.items.length) ? { key: 'connected', label: 'Connected' } : null,
  ].filter(Boolean) as { key: string; label: string }[];
  const tabs = secs.length > 1
    ? `<nav class="tabs">${secs.map((s, i) => `<a class="tab${i === 0 ? ' on' : ''}" href="#sec-${s.key}">${esc(s.label)}</a>`).join('')}</nav>`
    : '';

  const notice = vm.notice ? `<div class="card notice"><span class="meg">▸</span><span>${esc(vm.notice)}</span></div>` : '';

  const post = vm.post ? `<section class="card"><h2>From ${esc(first)}</h2>
    <p class="feednote">Open updates for everyone · members unlock the inside ones.</p>
    <div class="post"><div class="pa"><span class="dot"></span><strong>${esc(vm.post.author)}</strong> <span class="vchip open">Open</span></div>
    <p>${esc(vm.post.body)}</p><div class="dt">${esc(vm.post.date ?? '')}</div></div>
    ${/* "View more" pointed at #posts — an id that doesn't exist here either.
         There is no posts page on an entity shell (the pivot removed content),
         so the honest thing is no button at all. */''}
    </section>` : '';

  let attend = '';
  if (vm.upcoming) {
    const u = vm.upcoming;
    let cta: string;
    if (vm.attendance) {
      const m = vm.attendance.mode;
      cta = `<div class="going">${m === 'stream' ? "You're streaming this" : m === 'ticket' ? "You're ticketed — see you there" : "You're going"} ✓</div>`;
    } else {
      const b: string[] = [];
      if (u.access === 'free') b.push(vm.guest
        ? `<a class="btn" href="/signup">Join for free</a>`
        : `<form method="post" action="/attend"><input type="hidden" name="fan_id" value="${vm.fanId}"><input type="hidden" name="event_id" value="${u.eventId}"><input type="hidden" name="mode" value="going"><button class="btn">Join for free</button></form>`);
      if (u.ticketUrl) b.push(`<a class="btn ghost" ${ext(u.ticketUrl)}>Buy tickets</a>`);
      if (u.streamUrl) b.push(`<a class="btn ghost" ${ext(u.streamUrl)}>Stream live</a>`);
      cta = `<div class="notyet">You're not attending yet.</div><div class="opts">${b.join('')}</div>`;
    }
    // The card is the event's own /e/:id/card.png — one card, generated from the
    // live event, rather than a second "share" page to keep in sync with it.
    attend = `<section id="sec-nextup" class="secanchor card"><h2>Next up</h2><div class="evt"><strong>${esc(u.title)}</strong><span class="dt">${esc(u.date ?? '')}</span></div>${cta}
      <div class="row">${shareButton({ title: u.title, cls: 'more', label: 'Share the matchday card', url: `/e/${u.eventId}`, img: `/e/${u.eventId}/card.png` })}</div></section>`;
  }

  // SHOP — GONE. It was a hardcoded shelf of three imaginary products ("Home
  // shirt — €55") linking to "#shop", an anchor that goes nowhere. A club page
  // was advertising merch that does not exist and cannot be bought.
  //
  // Same doctrine as the athlete page: an entity page is next up + events +
  // connected. Squad, fixtures and shop are the old Superfan build.
  const merch = '';

  const list = (l?: { title: string; items: ListItem[] }, id?: string) => l && l.items.length ? `<div ${id ? `id="${id}" class="secanchor card listc"` : 'class="card listc"'}><h2>${esc(l.title)}</h2><div class="affs">${
    l.items.map(it => `<a class="aff" href="${it.href ? gate(it.href) : gate('#')}"><span class="ai">${kindIcon(it.kind)}</span><span class="al">${esc(it.label)}</span>${it.tag ? `<span class="av">${esc(it.tag)}</span>` : ''}</a>`).join('')
  }</div></div>` : '';

  // Claimed events are marked here too — same reason as the athlete page: the
  // first question a fan has scanning a club's fixtures is which ones they're
  // already going to.
  const eventsCard = ((vm.events && vm.events.length) || (vm.scheduleHref && vm.canEdit))
    ? `<section id="sec-events" class="secanchor card"><h2>Events</h2><div class="affs">${(vm.events ?? []).map(e => `<a class="aff" href="/e/${e.id}"><span class="ai">${kindIcon('event')}</span><span class="al">${esc(e.title)}${e.featured ? ` <span style="color:var(--mut)">· via ${esc(e.hostName ?? '')}</span>` : ''}</span>${e.mine ? '<span class="av" style="border-color:var(--bone);color:var(--bone)">✓ You\'re in</span>' : ''}<span class="av">${e.featured ? 'Featured' : esc(e.date ?? '')}</span></a>`).join('') || '<div style="color:var(--mut);font-size:13px;padding:6px 0">No upcoming events.</div>'}</div>${vm.scheduleHref && vm.canEdit ? `<div class="row"><a class="more" style="display:inline;padding:7px 12px" href="${vm.scheduleHref}">＋ Schedule an event</a></div>` : ''}</section>`
    : '';

  const aside = `<aside class="side">
    <div class="card sidec">
      <div class="sh"><div><div class="sn">${esc(vm.name)}</div><div class="handle">${vm.handle ? '@' + esc(vm.handle) : esc(vm.kindLabel)}${vm.nickname ? ` · “${esc(vm.nickname)}”` : ''}</div>
        ${vm.parent ? `<a class="parent" href="${gate(vm.parent.href ?? '#')}">▸ ${esc(vm.parent.label)}</a>` : ''}</div>
        <div class="sav">${vm.avatarUrl ? `<img src="${esc(vm.avatarUrl)}">` : avatarSvg(vm.name)}</div></div>
      ${socials ? `<div class="icons">${socials}</div>` : ''}
      ${(vm.about || vm.tagline) ? `<p class="about">${esc(vm.about || vm.tagline!)}</p>` : ''}
      ${vm.statLine ? `<div class="recline"><span class="rk">${esc(vm.statLine.label)}</span><span class="rv">${esc(vm.statLine.value)}</span>${vm.statLine.sub ? `<span class="rl">${esc(vm.statLine.sub)}</span>` : ''}</div>` : ''}
    </div>
    ${list(vm.members, 'sec-connected')}${list(vm.secondary)}
  </aside>`;

  const gatebar = vm.guest
    ? `<div class="gatebar"><span><strong>Only members can see the content in full.</strong> You're browsing as a guest.</span><a class="btn" href="/signup">Log in to continue ›</a></div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(vm.name)} — Horda</title>${vm.ogTags ?? ''}
<link rel="icon" href="/favicon.svg">${THEME_BOOT}<style>${DARK_CSS}</style></head><body class="deskrail">
  ${deskRail({ guest: vm.guest, fanId: vm.fanId, active: 'explore' })}
  ${backButton(vm.backHref)}
  ${hero}${tabs}
  <div class="grid"><main>${vm.activation ?? ''}${(vm.editAction && vm.canEdit) ? `<div class="row" style="margin:0 0 10px"><a class="btn ghost" href="${esc(vm.editAction.replace('/entity/', '/onboarding/brand/').replace('/branding', ''))}">✦ AI page setup</a></div>` + editPanel(vm.editAction) : ''}${notice}${post}${attend}${eventsCard}${merch}</main>${aside}</div>
  ${gatebar}
  <div class="prov">${esc(vm.kindLabel)} profile · owner-controlled identity · system of record, no fan-to-fan venue. Social &amp; affiliation links are owner-chosen and point out.</div>
  ${bottomNav({ guest: vm.guest, fanId: vm.fanId })}
  ${SHARE_SCRIPT}
  ${(vm.editAction && vm.canEdit) ? UPLOAD_SCRIPT : ''}
</body></html>`;
}

// dark standings table block (club/team)
export function tableDark(title: string, rows: { rank: number; team: string; played: number; wins: number; draws: number; losses: number; goalDiff: number; points: number; me?: boolean }[]): string {
  return `<section class="card"><h2>${esc(title)}</h2><table class="tbl"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${
    rows.map(r => `<tr class="${r.me ? 'me' : ''}"><td>${r.rank}</td><td class="t">${esc(r.team)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}</td><td class="pts">${r.points}</td></tr>`).join('')
  }</tbody></table></section>`;
}

export const DARK_CSS = `
  ${THEME_VARS}
  ${THM_CSS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.45;padding-bottom:96px}
  a{color:inherit;text-decoration:none}
  html{scroll-behavior:smooth}
  .top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:12px 20px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(10px);z-index:9}
  .top .tl{justify-self:start;display:flex;align-items:center}.top .tr{justify-self:end;display:flex;align-items:center;gap:10px}
  .mark{display:flex;align-items:center;justify-content:center;justify-self:center;color:var(--bone)}.mark svg{display:block}
  .heroin,.heroin h1{color:#EDE9DF}
  .heroin .kindtag{color:rgba(237,233,223,.72);border-color:rgba(237,233,223,.28)}
  .dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .backx{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--b);color:var(--bone);font-size:22px;line-height:1;text-decoration:none;padding-bottom:2px}.backx:hover{border-color:var(--bone)}
  .hero{position:relative;height:330px;overflow:hidden}
  .hero .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .hero .ph{display:flex;align-items:center;justify-content:center;background:radial-gradient(120% 120% at 72% 18%,rgba(237,233,223,.10),transparent 60%),var(--ink)}
  .hero .kick{font-weight:800;letter-spacing:12px;text-transform:uppercase;font-size:60px;opacity:.12;white-space:nowrap}
  .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(11,11,12,.96),transparent 55%)}
  .heroin{position:absolute;left:20px;bottom:22px;z-index:2;max-width:720px}
  .kindtag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:6px;padding:2px 8px;margin-bottom:10px}
  .heroin h1{font-size:44px;line-height:1;letter-spacing:.5px;text-transform:uppercase;margin-bottom:14px}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:800;letter-spacing:.4px;border:1.5px solid var(--bone);border-radius:999px;padding:10px 20px;font-size:14px;cursor:pointer}
  .btn.ghost{background:transparent;color:var(--bone)}button.btn{font:inherit}
  .secanchor{scroll-margin-top:96px}
  .tabs{display:flex;gap:18px;padding:12px 20px;border-bottom:1px solid var(--b);overflow-x:auto}
  .tab{color:var(--mut);font-weight:700;font-size:14px;white-space:nowrap;padding:4px 0}.tab.on{color:var(--bone);border-bottom:2px solid var(--bone)}
  .grid{display:block;max-width:680px;margin:16px auto;padding:0 16px}
  .grid main{margin-bottom:0}
  .card{background:var(--s);border:1px solid var(--b);border-radius:14px;padding:16px 18px;margin-bottom:16px}
  h2{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}
  .notice{display:flex;gap:10px;align-items:flex-start;font-size:14px}.meg{font-weight:800}
  .post .pa{display:flex;align-items:center;gap:8px;margin-bottom:6px}.post .dot{width:26px;height:26px;border-radius:50%;background:var(--b);display:inline-block}
  .verified{color:var(--mut)}.post p{font-size:15px;margin-bottom:6px}
  .feednote{color:var(--mut);font-size:12px;margin:-4px 0 10px}
  .vchip{font-size:10px;font-weight:700;letter-spacing:.4px;border-radius:999px;padding:2px 8px;border:1px solid var(--b);color:var(--mut);white-space:nowrap}
  .more{display:block;text-align:center;border:1px solid var(--b);border-radius:10px;padding:9px;margin-top:12px;font-weight:700;font-size:13px}
  .evt{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:16px}
  .notyet{color:var(--mut);margin-bottom:10px}.opts{display:flex;gap:8px;flex-wrap:wrap}.opts form{display:inline}.going{font-weight:800}
  .shelf{display:flex;gap:12px;overflow-x:auto}.mItem{flex:0 0 142px}
  .mImg{height:142px;border-radius:10px;background:linear-gradient(135deg,rgba(237,233,223,.12),rgba(237,233,223,.03));border:1px solid var(--b)}
  .mName{font-size:12px;margin-top:8px;color:var(--mut)}
  .tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}
  .tbl th,.tbl td{text-align:right;padding:7px 4px;border-bottom:1px solid var(--b)}.tbl th:nth-child(2),.tbl td.t{text-align:left}
  .tbl th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}.tbl td.pts{font-weight:800}
  .tbl tr.me{background:var(--bone);color:var(--ink)}.tbl tr.me td{border-color:rgba(11,11,12,.15)}
  .sidec{}
  .sh{display:flex;justify-content:space-between;gap:10px}.sn{font-size:20px;font-weight:800}
  .sav{width:54px;height:54px;border-radius:50%;overflow:hidden;border:2px solid var(--bone);flex:0 0 auto}.sav img,.sav svg{width:100%;height:100%;object-fit:cover}
  .icons{display:flex;gap:15px;margin:14px 0}.ic{width:22px;height:22px;color:var(--bone);opacity:.85}.ic svg{width:22px;height:22px;display:block}.ic:hover{opacity:1}
  .about{font-size:14px;color:var(--mut);margin:4px 0 14px}
  .recline{display:flex;align-items:baseline;gap:8px;border-top:1px solid var(--b);border-bottom:1px solid var(--b);padding:12px 0}
  .rk{font-size:11px;letter-spacing:1.5px;color:var(--mut)}.rv{font-size:24px;font-weight:800}.rl{font-size:11px;color:var(--mut)}
  .parent{display:inline-block;margin-top:6px;font-size:13px;color:var(--bone);border-bottom:1px solid var(--b)}
  .listc h2{margin-bottom:4px}
  .affs{margin-top:6px}.aff{display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid var(--b)}.aff:last-child{border-bottom:none}
  .ai{width:20px;height:20px;color:var(--bone);opacity:.8}.ai svg{width:20px;height:20px;display:block}
  .al{flex:1;font-weight:600;font-size:14px}.av{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:6px;padding:2px 7px}
  .gatebar{max-width:680px;margin:18px auto 8px;background:var(--bone);color:var(--ink);display:flex;justify-content:center;align-items:center;gap:16px;padding:14px 18px;font-size:14px;border-radius:14px;flex-wrap:wrap;text-align:center}
  .gatebar .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .prov{max-width:680px;margin:8px auto 30px;padding:0 16px;color:var(--mut);font-size:11px}
`;
