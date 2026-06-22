// pages.ts — the screens. Dumb renderers: all data is assembled by the routes.
import { layout, esc } from './layout.ts';
import { socialIcon, kindIcon } from './icons.ts';
import { editPanel, UPLOAD_SCRIPT } from './shell.ts';
import { ravenMark } from './brand.ts';
import type { AthleteProfile, FanHome } from '../engagement/types.ts';
import type { ClubPageModel } from '../read/types.ts';

export interface UpcomingView { eventId: string; opponentId: string | null; opponentName: string | null; date?: string; access: 'free' | 'paid_ticket'; ticketUrl: string | null; streamUrl: string | null }

// --- landing -------------------------------------------------------------
export function renderIndex(d: { fan: { id: string; name: string }; athletes: { id: string; name: string }[]; clubs: { id: string; name: string }[]; teams: { id: string; name: string }[]; association: { id: string; name: string } }): string {
  const row = (href: string, label: string, tag: string) => `<li><span class="hl"><a href="${href}">${esc(label)} →</a></span><span class="tag mutd">${tag}</span></li>`;
  return layout('Home', `
  <h1>This is the Horda.</h1>
  <p class="mut">Closeness to what you follow. Pick someone to back.</p>
  <h2>Your home</h2>
  <ul>${row(`/fan/${d.fan.id}`, `${d.fan.name}'s feed`, 'fan')}</ul>
  <h2>Athletes</h2>
  <ul>${d.athletes.map(a => row(`/athlete/${a.id}`, a.name, 'idol')).join('')}</ul>
  <h2>Clubs</h2>
  <ul>${d.clubs.map(c => row(`/club/${c.id}`, c.name, 'club')).join('')}</ul>
  <h2>Teams</h2>
  <ul>${d.teams.map(t => row(`/team/${t.id}`, t.name, 'team')).join('')}</ul>
  <h2>Associations</h2>
  <ul>${row(`/association/${d.association.id}`, d.association.name, 'verband')}</ul>`);
}

// initials avatar placeholder (until the athlete uploads their own)
function avatarSvg(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || 'H';
  return `<svg viewBox="0 0 104 104" xmlns="http://www.w3.org/2000/svg"><rect width="104" height="104" fill="#0B0B0C"/><text x="52" y="52" dy=".36em" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="40" font-weight="800" fill="#EDE9DF">${esc(initials)}</text></svg>`;
}
// --- the live start screen (public, Weverse-style: product, not marketing) --
export function renderDiscover(d: {
  guest: boolean; fanId: string | null; sport?: string; region?: string;
  data: { sports: { key: string; name: string }[]; regions?: string[];
    athletes: { id: string; name: string; region: string | null; sport: string | null }[];
    clubs: { id: string; name: string; region: string | null; sport: string | null }[];
    upcoming: { id: string; title: string; date?: string; host: string; admission: string }[];
    results: { headline: string; date?: string }[] };
  regions: string[];
}): string {
  const qp = (sp?: string, rg?: string) => { const u = new URLSearchParams(); if (sp) u.set('sport', sp); if (rg) u.set('region', rg); const s = u.toString(); return s ? `/?${s}` : '/'; };
  const chip = (label: string, active: boolean, href: string) => `<a class="chip${active ? ' on' : ''}" href="${href}">${esc(label)}</a>`;
  const sportChips = `<div class="chips">${chip('All sports', !d.sport, qp(undefined, d.region))}${d.data.sports.map(s => chip(s.name, d.sport === s.key, qp(s.key, d.region))).join('')}</div>`;
  const regionChips = `<div class="chips">${chip('Everywhere', !d.region, qp(d.sport, undefined))}${d.regions.map(r => chip(r, d.region === r, qp(d.sport, r))).join('')}</div>`;

  const card = (href: string, title: string, sub: string, badge: string) =>
    `<a class="dcard" href="${href}"><div class="dav">${avatarSvg(title)}</div><div class="dmeta"><div class="dt-title">${esc(title)}</div><div class="dt-sub">${esc(sub)}</div></div><span class="dbadge">${esc(badge)}</span></a>`;

  const upcoming = d.data.upcoming.length ? `<h2>Live &amp; upcoming</h2><div class="drow">${
    d.data.upcoming.map(e => `<a class="ecard" href="/e/${e.id}"><div class="ecover"></div><div class="etitle">${esc(e.title)}</div><div class="esub">${esc(e.host)} · ${esc(e.date ?? 'soon')} · ${e.admission === 'paid' ? 'ticketed' : e.admission === 'apply' ? 'apply' : 'free'}</div></a>`).join('')
  }</div>` : '';
  const athletes = d.data.athletes.length ? `<h2>Athletes${d.region || d.sport ? ' · filtered' : ''}</h2><div class="dlist">${
    d.data.athletes.map(a => card(`/athlete/${a.id}`, a.name, [a.sport, a.region].filter(Boolean).join(' · ') || 'athlete', 'idol')).join('')
  }</div>` : '';
  const clubs = d.data.clubs.length ? `<h2>Clubs</h2><div class="dlist">${
    d.data.clubs.map(c => card(`/club/${c.id}`, c.name, [c.sport, c.region].filter(Boolean).join(' · ') || 'club', 'club')).join('')
  }</div>` : '';
  const results = d.data.results.length ? `<h2>Latest results</h2><ul class="rlist">${
    d.data.results.map(r => `<li><span class="rmk">●</span><span class="rh">${esc(r.headline)}</span><span class="dt">${esc(r.date ?? '')}</span></li>`).join('')
  }</ul>` : '';
  const empty = (!d.data.athletes.length && !d.data.clubs.length) ? `<p class="mut" style="margin-top:14px">Nothing here for that filter yet — try another sport or region.</p>` : '';

  const yours = d.guest
    ? `<div class="joinb"><div><strong>Your Horda</strong><div class="bsub">Pick 3 you love and your feed already knows you. Free.</div></div><a class="btn dark" href="/signup">Get your feed</a></div>`
    : `<div class="joinb"><div><strong>Your Horda is ready</strong><div class="bsub">Your feed of everyone you follow.</div></div><a class="btn dark" href="/fan/${d.fanId}">Open feed →</a></div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>Horda</title>
<style>
  :root{color-scheme:dark;--ink:#0B0B0C;--bone:#EDE9DF;--s:rgba(237,233,223,.05);--b:rgba(237,233,223,.14);--mut:rgba(237,233,223,.58)}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:60px}
  a{color:inherit;text-decoration:none}
  .top{display:flex;justify-content:space-between;align-items:center;padding:11px 18px;border-bottom:1px solid var(--b);position:sticky;top:0;background:rgba(11,11,12,.82);backdrop-filter:blur(10px);z-index:20}
  .mark{display:flex;align-items:center}.mark svg{display:block}
  .nav{display:flex;gap:10px;align-items:center}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:800;border:1.5px solid var(--bone);border-radius:999px;padding:8px 15px;font-size:13px}
  .btn.ghost{background:transparent;color:var(--bone)}.btn.dark{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .wrap{max-width:760px;margin:0 auto;padding:0 16px}
  .lede{font-size:30px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;margin:22px 0 4px}
  .sub{color:var(--mut);font-size:14px;margin-bottom:6px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .chip{font-size:13px;font-weight:700;border:1.5px solid var(--b);color:var(--mut);border-radius:999px;padding:7px 13px;white-space:nowrap}
  .chip.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}
  h2{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;margin:26px 0 10px}
  .drow{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
  .ecard{flex:0 0 220px;background:var(--s);border:1px solid var(--b);border-radius:16px;overflow:hidden}
  .ecover{height:96px;background:radial-gradient(120% 120% at 70% 20%,rgba(237,233,223,.14),transparent 60%),var(--ink);border-bottom:1px solid var(--b)}
  .etitle{font-weight:800;font-size:14px;padding:10px 12px 2px}.esub{color:var(--mut);font-size:12px;padding:0 12px 12px}
  .dlist{display:grid;gap:8px}
  .dcard{display:flex;align-items:center;gap:12px;background:var(--s);border:1px solid var(--b);border-radius:14px;padding:10px 12px}
  .dav{width:44px;height:44px;border-radius:50%;overflow:hidden;border:1px solid var(--b);flex:0 0 auto}.dav svg{width:100%;height:100%;display:block}
  .dmeta{flex:1;min-width:0}.dt-title{font-weight:800;font-size:15px}.dt-sub{color:var(--mut);font-size:12px;text-transform:capitalize}
  .dbadge{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:6px;padding:2px 7px}
  .rlist{list-style:none}.rlist li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b);font-size:14px}.rmk{color:var(--mut)}.rh{flex:1}.dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .joinb{background:var(--bone);color:var(--ink);border-radius:18px;padding:15px 18px;margin:22px 0 6px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .joinb .bsub{font-size:12.5px;opacity:.72;margin-top:3px}
  .prov{max-width:760px;margin:18px auto;padding:0 16px;color:var(--mut);font-size:11px}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda">${ravenMark(30, 'bone')}</a>
    <div class="nav">${d.guest ? `<a class="btn ghost" href="/login">Log in</a><a class="btn" href="/signup">Join free</a>` : `<a class="btn" href="/fan/${d.fanId}">Your feed →</a>`}</div></header>
  <div class="wrap">
    <div class="lede">This is the Horda.</div>
    <div class="sub">The home for the sport you actually follow. Tune it to your taste:</div>
    ${sportChips}${regionChips}
    ${yours}
    ${upcoming}
    ${athletes}
    ${clubs}
    ${results}
    ${empty}
  </div>
  <div class="prov">Browsing is open. Follow, attend, predict or become a member with a free account. Coverage of real sport — never a fan-to-fan venue.</div>
</body></html>`;
}

// --- athlete profile (the idol surface — Weverse-style, sports-specific) --
// Public page. A guest can browse, but any action except Shop routes to sign-up.
export function renderAthletePage(d: {
  guest: boolean; fanId: string | null; profile: AthleteProfile;
  upcoming: UpcomingView | null;
  attendance: { mode: string } | null;
  affiliations: { kind: string; label: string; href: string | null }[];
  events?: { id: string; title: string; date?: string; featured?: boolean; hostName?: string }[];
  scheduleHref?: string;
  tier?: { name: string; priceCents: number; currency: string; perks: string[] } | null;
  membership?: { memberNo: number } | null;
  memberCount?: number;
  canEdit?: boolean;
}): string {
  const isMember = !!d.membership;
  const money = (c: number, cur = 'EUR') => `${cur === 'EUR' ? '€' : cur + ' '}${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const p = d.profile;
  const first = (p.name.split(' ')[0] || p.name).replace(/[^A-Za-z]/g, '') || p.name;
  const nickname = (p.name.match(/[‘'"]([^’'"]+)[’'"]/) ?? [])[1] ?? '';
  const gate = (real: string) => (d.guest ? '/signup' : real);
  const ext = (href: string) => (d.guest ? `href="/signup"` : `href="${esc(href)}" target="_blank" rel="noopener"`);

  const socials = Object.entries(p.links ?? {}).filter(([, v]) => v)
    .map(([k, v]) => `<a class="ic" aria-label="${esc(k)}" ${ext(v)}>${socialIcon(k)}</a>`).join('');

  const av = p.avatarUrl ? `<img src="${esc(p.avatarUrl)}">` : avatarSvg(p.name);
  const cover = `<div class="cover">${p.bannerUrl ? `<img src="${esc(p.bannerUrl)}" alt="">` : `<div class="ph"><span class="kick">${esc(nickname || p.name)}</span></div>`}</div>`;

  const profhead = `<section class="profhead">
      <div class="avatar">${av}</div>
      <div class="pid"><h1>${esc(p.name)}</h1><div class="hsub">${p.handle ? '@' + esc(p.handle) : ''}${nickname ? ` · “${esc(nickname)}”` : ''} · Welterweight</div></div>
      <a class="btn join" href="${gate('#join')}">Join Now</a>
    </section>
    ${socials ? `<div class="icons">${socials}</div>` : ''}
    ${p.tagline ? `<p class="tagline">${esc(p.tagline)}</p>` : ''}`;

  const tab = (label: string, on = false, shop = false) => shop
    ? `<a class="tab" href="${gate('#shop')}">${label} ↗</a>`
    : `<a class="tab${on ? ' on' : ''}" href="${on ? '#' : gate('#')}">${label}</a>`;
  const tabs = `<nav class="tabs">${tab('Highlight', true)}${tab('Posts')}${tab('Media')}${tab('Schedule')}${tab('Record')}${tab('Shop', false, true)}</nav>`;

  const membership = `<div class="joinb"><div><strong>Join the Horda</strong><div class="bsub">Get closer to ${esc(first)} — drops, fight alerts, members-only moments.</div></div><a class="btn dark" href="${gate('#join')}">Join Now</a></div>`;

  const stats = `<div class="stats">
      <div class="stat"><div class="num">${p.record.wins}</div><div class="slab">Won</div></div>
      <div class="stat"><div class="num">${p.record.losses}</div><div class="slab">Lost</div></div>
      <div class="stat"><div class="num">${p.record.draws}</div><div class="slab">Drawn</div></div>
    </div><div class="reccap">${p.record.wins}–${p.record.losses}–${p.record.draws} · Wins–Losses–Draws</div>`;

  const tierCard = isMember
    ? `<div class="membadge">✦ Founding member #${d.membership!.memberNo}${d.tier ? ` · ${esc(d.tier.name)}` : ''}${d.memberCount ? ` · ${d.memberCount} members` : ''}</div>`
    : d.tier
      ? `<section class="card tiercard"><div class="ch"><h2>${esc(d.tier.name)}</h2><span class="price">${money(d.tier.priceCents, d.tier.currency)}/mo</span></div>
          <ul class="perks">${d.tier.perks.map(pk => `<li>${esc(pk)}</li>`).join('')}</ul>
          ${d.guest ? `<a class="btn" href="/signup">Become a member</a>` : `<form method="post" action="/join"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="owner_kind" value="athlete"><input type="hidden" name="owner_id" value="${p.athleteId}"><button class="btn" type="submit">Become a member</button></form>`}
          ${d.memberCount ? `<div class="dt" style="margin-top:8px">${d.memberCount} members already in</div>` : ''}</section>`
      : '';

  const postCard = (po: { body: string; date?: string; visibility?: string }) => {
    const locked = po.visibility === 'members' && !isMember;
    const tagHtml = po.visibility === 'members' ? '<span class="memtag">★ Members</span>' : '<span class="verified">✔</span>';
    return `<article class="post"><div class="pa"><span class="pav">${av}</span><div class="pmeta"><strong>${esc(p.name)}</strong> ${tagHtml}<div class="dt">${esc(po.date ?? '')}</div></div></div>${locked
      ? `<div class="locked">🔒 Members-only drop — ${d.guest ? `<a href="/signup">join</a>` : `<a href="#join">become a member</a>`} to unlock.</div>`
      : `<p>${esc(po.body)}</p>`}</article>`;
  };
  const postsBlock = p.posts.length
    ? `<section class="card"><div class="ch"><h2>From ${esc(first)}</h2><a class="more inline" href="${gate('#posts')}">View more</a></div>${p.posts.map(postCard).join('')}</section>`
    : '';

  const mediaBlock = `<section class="card"><div class="ch"><h2>Media</h2><a class="more inline" href="${gate('#media')}">View more</a></div><div class="mediagrid">${Array.from({ length: 6 }, () => '<div class="mtile"></div>').join('')}</div></section>`;

  let attendBlock = '';
  if (d.upcoming) {
    const u = d.upcoming;
    let cta: string;
    if (d.attendance) {
      const m = d.attendance.mode;
      cta = `<div class="going">${m === 'stream' ? "You're streaming this fight" : m === 'ticket' ? "You're ticketed — see you ringside" : "You're going"} ✓</div>`;
    } else {
      const b: string[] = [];
      if (u.access === 'free') b.push(d.guest
        ? `<a class="btn" href="/signup">Join for free</a>`
        : `<form method="post" action="/attend"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="event_id" value="${u.eventId}"><input type="hidden" name="mode" value="going"><button class="btn">Join for free</button></form>`);
      if (u.ticketUrl) b.push(`<a class="btn ghost" ${ext(u.ticketUrl)}>Buy tickets</a>`);
      if (u.streamUrl) b.push(`<a class="btn ghost" ${ext(u.streamUrl)}>Stream live</a>`);
      cta = `<div class="notyet">You're not attending yet.</div><div class="opts">${b.join('')}</div>`;
    }
    attendBlock = `<section class="card"><h2>Next up</h2>
      <div class="evt"><strong>${esc(p.name)} vs ${esc(u.opponentName ?? 'TBA')}</strong><span class="dt">${esc(u.date ?? '')}</span></div>${cta}
      <div class="row"><a class="more" style="display:inline;padding:6px 12px" href="/share/fight/${u.eventId}">Share the matchup card ↗</a></div></section>`;
  }

  const eventsBlock = ((d.events && d.events.length) || (d.scheduleHref && d.canEdit))
    ? `<section class="card"><h2>Events</h2><ul style="list-style:none">${(d.events ?? []).map(e => `<li style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--b)"><span class="tag mutd">${e.featured ? 'FEATURED' : 'EVENT'}</span><a class="hl" style="flex:1" href="/e/${e.id}">${esc(e.title)}${e.featured ? ` · <span class="dt">via ${esc(e.hostName ?? '')}</span>` : ''}</a><span class="dt">${esc(e.date ?? '')}</span></li>`).join('') || '<li style="color:var(--mut);font-size:13px;list-style:none">No upcoming events.</li>'}</ul>${d.scheduleHref && d.canEdit ? `<div class="row"><a class="more" style="display:inline;padding:7px 12px" href="${d.scheduleHref}">＋ Schedule an event</a></div>` : ''}</section>`
    : '';

  const resultsBlock = p.recentResults.length
    ? `<section class="card"><h2>Record</h2><ul style="list-style:none">${p.recentResults.map(r => `<li style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--b)"><span class="tag mutd">●</span><span style="flex:1">${esc(r.headline)}</span>${r.eventId ? `<a class="tag mutd" href="/share/result/${r.eventId}">share</a>` : ''}<span class="dt">${esc(r.date ?? '')}</span></li>`).join('')}</ul></section>`
    : '';

  const merch = `<section class="card"><h2>Merch</h2><div class="shelf">${
    ['Raven tee — €34', 'Fight-night hoodie — €69', 'Signed hand wraps — €49'].map(m => `<a class="mItem" href="#shop"><div class="mImg"></div><div class="mName">${esc(m)}</div></a>`).join('')
  }</div><a class="more" href="#shop">View more</a></section>`;

  const affs = d.affiliations.length
    ? `<div class="affs">${d.affiliations.map(a => `<a class="aff" href="${a.href ? gate(a.href) : gate('#')}"><span class="ai">${kindIcon(a.kind)}</span><span class="al">${esc(a.label)}</span><span class="av">${esc(a.kind)}</span></a>`).join('')}</div>`
    : '';
  const connected = `<section class="card"><h2>Connected</h2>${affs || '<div class="dim2">No links yet.</div>'}</section>`;

  const gatebar = d.guest
    ? `<div class="gatebar"><span><strong>Only members can see the content in full.</strong> You're browsing as a guest.</span><a class="btn" href="/signup">Log in to continue ›</a></div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(p.name)} — Horda</title>
<style>
  :root{color-scheme:dark;--ink:#0B0B0C;--bone:#EDE9DF;--s:rgba(237,233,223,.05);--b:rgba(237,233,223,.14);--mut:rgba(237,233,223,.58)}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:96px}
  a{color:inherit;text-decoration:none}
  .top{display:flex;justify-content:space-between;align-items:center;padding:11px 18px;border-bottom:1px solid var(--b);position:sticky;top:0;background:rgba(11,11,12,.82);backdrop-filter:blur(10px);z-index:20}
  .mark{display:flex;align-items:center}.mark svg{display:block}
  .dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .cover{position:relative;height:240px;overflow:hidden}
  .cover img{width:100%;height:100%;object-fit:cover}
  .cover .ph{height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(130% 130% at 70% 8%,rgba(237,233,223,.10),transparent 55%),var(--ink)}
  .cover .kick{font-weight:800;letter-spacing:12px;text-transform:uppercase;font-size:54px;opacity:.10;white-space:nowrap}
  .cover::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--ink),transparent 72%)}
  .wrap{max-width:680px;margin:0 auto;padding:0 16px}
  .profhead{display:flex;align-items:flex-end;gap:14px;margin-top:-44px;position:relative;z-index:2}
  .avatar{width:94px;height:94px;border-radius:50%;overflow:hidden;border:3px solid var(--ink);background:var(--ink);flex:0 0 auto;box-shadow:0 8px 24px rgba(0,0,0,.45)}
  .avatar img,.avatar svg{width:100%;height:100%;object-fit:cover;display:block}
  .pid{flex:1;padding-bottom:4px;min-width:0}
  .pid h1{font-size:28px;line-height:1.05;letter-spacing:.4px;text-transform:uppercase}
  .hsub{color:var(--mut);font-size:13px;margin-top:5px;font-weight:600}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:800;letter-spacing:.3px;border:1.5px solid var(--bone);border-radius:999px;padding:9px 18px;font-size:14px;cursor:pointer}
  .btn.ghost{background:transparent;color:var(--bone)}.btn.dark{background:var(--ink);color:var(--bone);border-color:var(--ink)}button.btn{font:inherit}
  .icons{display:flex;gap:16px;margin:16px 2px 0}.ic{width:22px;height:22px;color:var(--bone);opacity:.85}.ic svg{width:22px;height:22px;display:block}.ic:hover{opacity:1}
  .tagline{font-size:15px;margin:14px 2px 0;max-width:48ch}
  .tabs{display:flex;gap:22px;margin:20px 0 4px;padding:0 2px;border-bottom:1px solid var(--b);overflow-x:auto;position:sticky;top:52px;background:var(--ink);z-index:10}
  .tab{color:var(--mut);font-weight:700;font-size:14px;white-space:nowrap;padding:11px 0}
  .tab.on{color:var(--bone);box-shadow:inset 0 -2px 0 var(--bone)}
  .card{background:var(--s);border:1px solid var(--b);border-radius:18px;padding:18px;margin:14px 0}
  .ch{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  h2{font-size:12px;letter-spacing:1.6px;text-transform:uppercase}
  .more{display:block;text-align:center;border:1px solid var(--b);border-radius:12px;padding:10px;margin-top:14px;font-weight:700;font-size:13px}
  .more.inline{display:inline-block;border:none;padding:0;margin:0;color:var(--mut);font-size:12px}
  .joinb{background:var(--bone);color:var(--ink);border-radius:18px;padding:15px 18px;margin:16px 0;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .joinb .bsub{font-size:12.5px;opacity:.72;margin-top:3px}
  .tiercard .price{font-size:14px;font-weight:800}
  .perks{list-style:none;margin:6px 0 14px}.perks li{padding:7px 0;border-bottom:1px solid var(--b);font-size:14px}.perks li::before{content:"✓ ";font-weight:800}.perks li:last-child{border:none}
  .membadge{background:var(--bone);color:var(--ink);border-radius:14px;padding:12px 16px;margin:14px 0;font-weight:800;font-size:14px;letter-spacing:.3px}
  .memtag{font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--ink);background:var(--bone);border-radius:999px;padding:2px 8px}
  .locked{border:1px dashed var(--b);border-radius:12px;padding:14px;color:var(--mut);font-size:14px;background:rgba(237,233,223,.03)}.locked a{color:var(--bone);border-bottom:1px solid var(--b)}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 4px}
  .stat{background:var(--s);border:1px solid var(--b);border-radius:14px;padding:14px 8px;text-align:center}
  .stat .num{font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
  .stat .slab{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);margin-top:6px}
  .reccap{text-align:center;color:var(--mut);font-size:12px;margin-bottom:4px}
  .post{padding:13px 0;border-bottom:1px solid var(--b)}.post:last-child{border:none;padding-bottom:0}
  .post .pa{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .pav{width:36px;height:36px;border-radius:50%;overflow:hidden;border:1px solid var(--b);flex:0 0 auto}.pav img,.pav svg{width:100%;height:100%;object-fit:cover;display:block}
  .pmeta strong{font-size:14px}.verified{color:var(--mut);font-size:11px;letter-spacing:.5px}.pmeta .dt{font-size:11px;margin-top:1px}
  .post p{font-size:15px}
  .mediagrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .mtile{aspect-ratio:1;border-radius:10px;background:linear-gradient(135deg,rgba(237,233,223,.15),rgba(237,233,223,.03));border:1px solid var(--b)}
  .evt{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:16px}
  .notyet{color:var(--mut);margin-bottom:10px}.opts{display:flex;gap:8px;flex-wrap:wrap}.opts form{display:inline}.going{font-weight:800}
  .shelf{display:flex;gap:12px;overflow-x:auto}.mItem{flex:0 0 150px}
  .mImg{height:150px;border-radius:12px;background:linear-gradient(135deg,rgba(237,233,223,.15),rgba(237,233,223,.03));border:1px solid var(--b)}
  .mName{font-size:12px;margin-top:8px;color:var(--mut)}
  .affs{}.aff{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px solid var(--b)}.aff:last-child{border-bottom:none}
  .ai{width:20px;height:20px;color:var(--bone);opacity:.8}.ai svg{width:20px;height:20px;display:block}
  .al{flex:1;font-weight:600;font-size:14px}.av{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:6px;padding:2px 7px}
  .tag{font-size:10px;font-weight:800;letter-spacing:.5px;border:1.5px solid var(--bone);border-radius:999px;padding:3px 9px}.tag.mutd{color:var(--mut);border-color:var(--b);font-weight:700}
  .hl{}.dim2{color:var(--mut);font-size:13px}.dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
  .gatebar{position:fixed;left:0;right:0;bottom:0;background:var(--bone);color:var(--ink);display:flex;justify-content:center;align-items:center;gap:16px;padding:14px 20px;font-size:14px;z-index:30;flex-wrap:wrap}
  .gatebar .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .prov{max-width:680px;margin:10px auto 30px;padding:0 16px;color:var(--mut);font-size:11px}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda — home">${ravenMark(30, 'bone')}</a><a class="dt" href="${d.guest ? '/signup' : `/fan/${d.fanId ?? ''}`}">${d.guest ? 'log in' : 'your feed →'}</a></header>
  ${cover}
  <div class="wrap">
    ${profhead}
    ${tabs}
    ${d.canEdit ? editPanel(`/athlete/${p.athleteId}/branding`) : ''}
    ${membership}
    ${tierCard}
    ${stats}
    ${attendBlock}
    ${postsBlock}
    ${mediaBlock}
    ${eventsBlock}
    ${resultsBlock}
    ${merch}
    ${connected}
  </div>
  ${gatebar}
  <div class="prov">Athlete-owned profile · persons self-create on Horda · coverage only, no fan-to-fan venue. Social &amp; affiliation links are athlete-chosen and point out.</div>
  ${d.canEdit ? UPLOAD_SCRIPT : ''}
</body></html>`;
}

// PUBLIC share page — the acquisition loop. Open to everyone (like Shop): a
// non-user lands here from a shared card and meets a join CTA. Facts only.
export function renderSharePage(a: { title: string; card: string; body: string; shareText: string }, joinHref = '/signup'): string {
  const enc = encodeURIComponent(a.shareText);
  return layout(a.title, `
    <style>.sc svg{width:100%;height:auto;display:block;border-radius:14px}</style>
    <p class="mut" style="margin-top:18px">Shared from the Horda</p>
    <div class="sc" style="max-width:360px;margin:10px 0">${a.card}</div>
    <p style="white-space:pre-wrap;font-size:15px;margin:12px 0">${esc(a.body)}</p>
    <div class="row">
      <a class="tag" href="https://twitter.com/intent/tweet?text=${enc}" target="_blank" rel="noopener">Share on X</a>
      <a class="tag" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="tag" href="data:image/svg+xml;utf8,${encodeURIComponent(a.card)}" download="horda-card.svg">Download card</a>
    </div>
    <div class="card" style="margin-top:20px"><strong>This is the Horda.</strong> The home for superfans of sports and competitive culture.
      <div class="row"><a href="${esc(joinHref)}"><button>Join free</button></a></div></div>`, { back: '/' });
}

// the "founding member" moment — celebratory + shareable (FOMO spread).
export function renderMemberWelcome(d: { name: string; tierName: string; memberNo: number; href: string }): string {
  const shareText = encodeURIComponent(`I just became a founding member of ${d.name} on Horda. Get closer: horda.app`);
  return layout(`Member of ${d.name}`, `
    <div class="card" style="text-align:center;padding:28px 18px">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);font-weight:800">${esc(d.tierName)}</div>
      <div style="font-size:40px;font-weight:800;margin:10px 0">You're in.</div>
      <div style="font-size:16px">Founding member <b>#${d.memberNo}</b> of ${esc(d.name)}.</div>
      <p class="mut" style="margin-top:10px">Members-only drops, early tickets, and the badge are now yours.</p>
    </div>
    <div class="row">
      <a class="tag ok" href="https://twitter.com/intent/tweet?text=${shareText}" target="_blank" rel="noopener">Share you're in · X</a>
      <a class="tag ok" href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="tag" href="${esc(d.href)}">Back to ${esc(d.name.split(' ')[0])}</a>
    </div>`, { back: d.href });
}

// sign-up — create a real account (browsing is open; acting needs this).
export function renderSignup(next: string): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  return layout('Join the Horda', `
    <h1>Join the Horda</h1>
    <p class="mut">Browsing is open. To follow, attend, predict, become a member, or claim your page, create a free account.</p>
    <form method="post" action="/signup">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      <label class="mut" style="display:block;margin:12px 0">Name<input style="${inp}" name="name" required></label>
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <label class="mut" style="display:block;margin:12px 0">Password<input style="${inp}" type="password" name="password" required minlength="6"></label>
      <div class="row"><button type="submit">Create account</button></div>
    </form>
    <p class="mut" style="margin-top:14px">Already have one? <a href="/login" style="border-bottom:1px solid var(--b)">Log in</a>.</p>`, { back: next || '/' });
}

export function renderLogin(next: string): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  return layout('Log in', `
    <h1>Log in</h1>
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <label class="mut" style="display:block;margin:12px 0">Password<input style="${inp}" type="password" name="password" required></label>
      <div class="row"><button type="submit">Log in</button></div>
    </form>
    <p class="mut" style="margin-top:14px">New here? <a href="/signup" style="border-bottom:1px solid var(--b)">Create an account</a>.</p>`, { back: next || '/' });
}

// --- fan home (closeness to who you follow) ------------------------------
export function renderFanHome(d: { fanId: string; fanName: string; home: FanHome; follows: { type: string; id: string; name: string }[] }): string {
  const { home } = d;
  const unread = home.notifications.filter(n => !n.read).length;

  const following = home.feed.length || d.follows.length
    ? `<div class="row">${d.follows.map(f => `<a class="tag mutd" href="/${f.type === 'club' ? 'club' : f.type === 'athlete' ? 'athlete' : 'club'}/${f.id}">${esc(f.name)}</a>`).join(' ')}</div>` : '';

  const notifs = home.notifications.length
    ? `<h2>Notifications ${unread ? `<span class="tag ok">${unread} new</span>` : ''}</h2><ul>${home.notifications.map(n => `<li><span class="tag mutd">${esc(n.kind)}</span><span class="hl">${esc(n.headline)}</span></li>`).join('')}</ul>` : '';

  const preds = home.predictions.length
    ? `<h2>Your calls</h2><ul>${home.predictions.map(pr => `<li><span class="hl">${esc(pr.event)} — backed <strong>${esc(pr.pick)}</strong></span><span class="tag ${pr.status === 'correct' ? 'ok' : 'mutd'}">${esc(pr.status)}</span></li>`).join('')}</ul>` : '';

  const feed = home.feed.length
    ? `<h2>Your feed</h2><ul>${home.feed.map(it => `<li><span class="tag mutd">${esc(it.kind)}</span><span class="hl">${esc(it.headline)}</span><span class="dt">${esc(it.sub ?? it.date ?? '')}</span></li>`).join('')}</ul>`
    : `<h2>Your feed</h2><p class="mut">Follow an athlete or club to fill your feed.</p>`;

  const drop = `<div class="card"><strong>Your week in the Horda</strong><div class="mut" style="margin:4px 0 10px">A shareable drop of everything you follow this week.</div><div class="row"><a href="/share/week/${d.fanId}"><button>Get your drop ↗</button></a></div></div>`;

  return layout(`${d.fanName}'s Horda`, `
    <h1>Your Horda</h1>
    <p class="mut">${esc(d.fanName)} · following ${d.follows.length}</p>
    ${drop}${following}${notifs}${preds}${feed}
    <div class="prov">Your feed is coverage of what you follow — not a stream of other fans.</div>`, { back: '/' });
}

// --- club page -----------------------------------------------------------
export function renderClubBody(fanId: string, m: ClubPageModel): string {
  const rec = `${m.record.wins}W ${m.record.draws}D ${m.record.losses}L`;
  const table = `<h2>League table</h2><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>${
    m.table.map(r => `<tr class="${r.teamId === m.clubId ? 'me' : ''}"><td>${r.rank}</td><td class="t">${esc(r.team)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalDiff > 0 ? '+' : ''}${r.goalDiff}</td><td class="pts">${r.points}</td></tr>`).join('')
  }</tbody></table>`;
  const form = m.form.length ? `<h2>Recent form</h2><ul>${m.form.map(f => `<li><span class="tag ${f.outcome === 'win' ? 'win' : 'mutd'}">${f.outcome[0].toUpperCase()}</span><span class="hl">${esc(f.headline)}</span><span class="dt">${esc(f.date ?? '')}</span></li>`).join('')}</ul>` : '';
  const upcoming = m.upcoming.length ? `<h2>Upcoming</h2><ul>${m.upcoming.map(u => `<li><span class="tag mutd">${u.venue === 'home' ? 'H' : 'A'}</span><span class="hl">${esc(u.opponent)}</span><span class="dt">${esc([u.date, u.time].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : '';
  return layout(m.clubName, `
    <h1>${esc(m.clubName)}</h1>
    <div class="row"><span class="mut rec">${esc(rec)}</span></div>
    ${table}${form}${upcoming}
    <div class="prov">Auto-built from uploaded results & fixtures · system of record.</div>`, { back: `/fan/${fanId}` });
}
