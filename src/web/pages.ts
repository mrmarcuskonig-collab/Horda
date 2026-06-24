// pages.ts — the screens. Dumb renderers: all data is assembled by the routes.
import { layout, esc } from './layout.ts';
import { socialIcon, kindIcon } from './icons.ts';
import { editPanel, UPLOAD_SCRIPT } from './shell.ts';
import { ravenMark, ravenMarkCurrent } from './brand.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav, verifiedBadge } from './theme.ts';
import { oauthProviders } from './oauth.ts';

// "Continue with Google / …" buttons — only render the providers configured via env
function oauthButtons(next: string): string {
  const ps = oauthProviders();
  if (!ps.length) return '';
  return `<div style="margin:6px 0 14px">${ps.map(p => `<a class="btn ghost" style="display:block;text-align:center;margin:8px 0" href="/auth/${p.id}?next=${encodeURIComponent(next || '/')}">Continue with ${esc(p.label)}</a>`).join('')}<div class="mut" style="text-align:center;font-size:12px;margin:10px 0">or</div></div>`;
}
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
    athletes: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; banner: string | null; verified?: boolean }[];
    clubs: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; verified?: boolean }[];
    upcoming: { id: string; title: string; date?: string; host: string; admission: string }[];
    results: { headline: string; date?: string }[] };
  regions: string[];
}): string {
  const qp = (sp?: string, rg?: string) => { const u = new URLSearchParams(); if (sp) u.set('sport', sp); if (rg) u.set('region', rg); const s = u.toString(); return s ? `/?${s}` : '/'; };
  const chip = (label: string, active: boolean, href: string) => `<a class="chip${active ? ' on' : ''}" href="${href}">${esc(label)}</a>`;

  // One scrolling sport row, ordered by global popularity. Football & boxing are
  // the two with live coverage; the rest read as universal (filter → empty state).
  // The row clips the last chip so the user senses there's more to swipe.
  const POPULAR: [string, string][] = [['football', 'Football'], ['basketball', 'Basketball'], ['boxing', 'Boxing'], ['tennis', 'Tennis'], ['running', 'Running'], ['mma', 'MMA'], ['cycling', 'Cycling'], ['volleyball', 'Volleyball'], ['handball', 'Handball'], ['ice_hockey', 'Ice hockey'], ['triathlon', 'Triathlon']];
  const sportChips = `<div class="chips scroll">${chip('All sports', !d.sport, qp(undefined, d.region))}${POPULAR.map(([k, n]) => chip(n, d.sport === k, qp(k, d.region))).join('')}</div>`;

  // Location: no hard-coded cities — a free field that works for a rural village
  // or Los Angeles. Submits on Enter (no button). Active location shows as a chip.
  const locRow = `<div class="chips locrow">${chip('Everywhere', !d.region, qp(d.sport, undefined))}<form class="locform" method="get" action="/">${d.sport ? `<input type="hidden" name="sport" value="${esc(d.sport)}">` : ''}<input name="region" value="${esc(d.region ?? '')}" placeholder="Enter your location" class="locin" autocomplete="off" aria-label="Enter your location"></form>${d.region ? `<a class="chip on" href="${qp(d.sport, undefined)}" title="Clear location">${esc(d.region)} ✕</a>` : ''}</div>`;

  const ringImg = (url: string | null, name: string) => url ? `<img src="${esc(url)}" alt="">` : avatarSvg(name);

  // story rail — Join + Creator map first (the two key learnings), then athlete faces
  const rail = `<div class="rail">
    <a class="story" href="/signup" aria-label="Join Horda"><span class="ring act"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" d="M12 5.75v12.5M5.75 12h12.5"/></svg></span><span class="sname">Join</span></a>
    <a class="story" href="/map" aria-label="Open the creator map"><span class="ring act"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round" d="M9 4.3 3.6 6.1v13.6L9 17.9l6 1.8 5.4-1.8V4.1L15 5.9 9 4.3Z"/><path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".8" d="M9 4.5v13.4M15 6v13.4"/></svg></span><span class="sname">Creator map</span></a>
    ${d.data.athletes.map(a => `<a class="story" href="/athlete/${a.id}"><span class="ring">${ringImg(a.avatar || a.banner, a.name)}</span><span class="sname">${esc(a.name.split(' ')[0])}</span></a>`).join('')}
  </div>`;

  // featured — big, photo-forward athlete cards, each with a consistent identity chip
  const featured = d.data.athletes.length ? `<div class="feat">${d.data.athletes.map(a => {
    const photo = a.banner || a.avatar;
    const big = photo ? `<img class="fimg" src="${esc(photo)}" alt="">` : `<div class="fph">${avatarSvg(a.name)}</div>`;
    const sub = [a.sport, a.region].filter(Boolean).join(' · ') || 'athlete';
    return `<a class="fcard" href="/athlete/${a.id}">${big}<div class="fscrim"></div>` +
      `<div class="fid"><span class="fav">${ringImg(a.avatar || a.banner, a.name)}</span><span class="fnm">${esc(a.name)}${a.verified ? verifiedBadge() : ''}</span></div>` +
      `<div class="fcap">${esc(sub)}</div></a>`;
  }).join('')}</div>` : '';

  const card = (href: string, title: string, sub: string, badge: string, verified = false) =>
    `<a class="dcard" href="${href}"><div class="dav">${avatarSvg(title)}</div><div class="dmeta"><div class="dt-title">${esc(title)}${verified ? verifiedBadge() : ''}</div><div class="dt-sub">${esc(sub)}</div></div><span class="dbadge">${esc(badge)}</span></a>`;

  const upcoming = d.data.upcoming.length ? `<h2>Public · live &amp; upcoming <span class="h2note">members-only events stay private</span></h2><div class="drow">${
    d.data.upcoming.map(e => `<a class="ecard" href="/e/${e.id}"><div class="ecover"></div><div class="etitle">${esc(e.title)}</div><div class="esub">${esc(e.host)} · ${esc(e.date ?? 'soon')} · ${e.admission === 'paid' ? 'ticketed' : e.admission === 'apply' ? 'apply' : 'free'}</div></a>`).join('')
  }</div>` : '';
  const clubs = d.data.clubs.length ? `<h2>Clubs &amp; federations</h2><div class="dlist">${
    d.data.clubs.map(c => card(`/club/${c.id}`, c.name, [c.sport, c.region].filter(Boolean).join(' · ') || 'club', 'club', c.verified)).join('')
  }</div>` : '';
  const results = d.data.results.length ? `<h2>Latest results</h2><ul class="rlist">${
    d.data.results.map(r => `<li><span class="rmk">●</span><span class="rh">${esc(r.headline)}</span><span class="dt">${esc(r.date ?? '')}</span></li>`).join('')
  }</ul>` : '';
  const empty = (!d.data.athletes.length && !d.data.clubs.length) ? `<p class="mut" style="margin-top:14px">Nothing here for that filter yet — try another sport or region.</p>` : '';

  const yours = d.guest
    ? `<div class="joinb"><div><strong>Your Horda</strong><div class="bsub">Pick a few you love and your feed already knows you. Free.</div></div><a class="btn dark" href="/signup">Get your feed</a></div>`
    : `<div class="joinb"><div><strong>Your Horda is ready</strong><div class="bsub">Your feed of everyone you follow.</div></div><a class="btn dark" href="/fan/${d.fanId}">Open feed →</a></div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>Horda</title>${THEME_BOOT}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:92px;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  a{color:inherit;text-decoration:none}
  ${THM_CSS}
  .top{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:20}
  .mark{display:flex;align-items:center;color:var(--bone)}.mark svg{display:block}
  .nav{display:flex;gap:9px;align-items:center}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:600;border:1px solid var(--bone);border-radius:999px;padding:7px 15px;font-size:13px;transition:opacity .15s}
  .btn:hover{opacity:.86}
  .btn.ghost{background:transparent;color:var(--bone);border-color:var(--b)}.btn.dark{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .wrap{max-width:900px;margin:0 auto;padding:0 20px}
  .kicker{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:var(--mut);font-weight:600;margin:26px 0 12px}
  .lede{font-size:30px;line-height:1.16;font-weight:600;letter-spacing:-.021em;margin:0 0 12px;max-width:19ch}
  .sub{color:var(--mut);font-size:15px;line-height:1.6;max-width:62ch;margin-bottom:4px;font-weight:400}
  .chips{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:14px 0 2px}
  .chips.scroll{flex-wrap:nowrap;overflow-x:auto;margin:18px 0 4px;padding-bottom:2px;-webkit-mask-image:linear-gradient(to right,#000 90%,transparent);mask-image:linear-gradient(to right,#000 90%,transparent)}
  .chips.scroll::-webkit-scrollbar{height:0}
  .locrow{margin:8px 0 6px}
  .chip{font-size:12.5px;font-weight:500;border:1px solid var(--b);color:var(--mut);border-radius:999px;padding:7px 14px;white-space:nowrap;transition:border-color .15s,color .15s;background:transparent;flex:0 0 auto}
  .chip:hover{border-color:var(--bone);color:var(--bone)}
  .chip.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}
  .locform{display:inline-flex}
  .locin{background:transparent;border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:7px 15px;font:inherit;font-size:12.5px;min-width:200px}
  .locin:focus{outline:none;border-color:var(--bone)}.locin::placeholder{color:var(--mut)}
  h2{font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;font-weight:600;color:var(--bone);margin:32px 0 13px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .h2note{font-size:11px;letter-spacing:.2px;text-transform:none;font-weight:400;color:var(--mut)}
  .rail{display:flex;gap:16px;overflow-x:auto;padding:10px 0 4px}
  .rail::-webkit-scrollbar,.feat::-webkit-scrollbar,.drow::-webkit-scrollbar{height:0}
  .story{flex:0 0 auto;width:66px;display:flex;flex-direction:column;align-items:center;gap:8px}
  .ring{width:64px;height:64px;border-radius:50%;padding:3px;display:block;box-sizing:border-box;transition:transform .16s}
  .story:hover .ring{transform:scale(1.05)}
  /* dark: soft white halo ring */
  .ring:not(.act){background:var(--bone);box-shadow:0 0 12px rgba(237,233,223,.32)}
  /* light: the familiar Instagram gradient ring */
  html[data-theme="light"] .ring:not(.act){background:conic-gradient(from 135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75);box-shadow:none}
  .ring:not(.act) img,.ring:not(.act) svg{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;border:2px solid var(--ink);box-sizing:border-box}
  .ring.act{display:flex;align-items:center;justify-content:center;border:1px solid var(--b);background:var(--s);color:var(--bone)}
  .sname{font-size:11.5px;font-weight:500;line-height:1.2;color:var(--mut);max-width:66px;text-align:center;white-space:normal}
  .story:hover .sname{color:var(--bone)}
  .feat{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;margin:20px 0 26px;scroll-snap-type:x mandatory}
  .fcard{position:relative;flex:0 0 224px;height:316px;border-radius:18px;overflow:hidden;border:1px solid var(--b);background:var(--s);scroll-snap-align:start;transition:transform .18s}
  .fcard:hover{transform:translateY(-3px)}
  .fimg{width:100%;height:100%;object-fit:cover;display:block}
  .fph{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.fph svg{width:52%;height:52%;opacity:.38}
  .fscrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(11,11,12,.86),rgba(11,11,12,.04) 50%,rgba(11,11,12,.22))}
  .fid{position:absolute;top:11px;left:11px;display:flex;align-items:center;gap:7px;background:rgba(11,11,12,.4);backdrop-filter:blur(8px);border-radius:999px;padding:3px 11px 3px 3px}
  .fav{width:24px;height:24px;border-radius:50%;overflow:hidden;flex:0 0 auto;border:1px solid rgba(237,233,223,.22)}.fav img,.fav svg{width:100%;height:100%;object-fit:cover;display:block}
  .fnm{font-weight:500;font-size:12.5px;color:#EDE9DF;letter-spacing:.1px}
  .fcap{position:absolute;left:14px;bottom:14px;color:#EDE9DF;font-size:12px;font-weight:500;letter-spacing:.2px;text-transform:capitalize;opacity:.9}
  #map{height:360px;border-radius:18px;overflow:hidden;border:1px solid var(--b);margin:2px 0;background:var(--s)}
  .hz-pin span{display:block;width:13px;height:13px;border-radius:50%;background:var(--bone);border:2px solid var(--ink);box-shadow:0 0 0 1px var(--b)}
  .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:var(--ink);color:var(--bone);border:1px solid var(--b)}
  .leaflet-popup-content{font-family:inherit;font-size:13px}.leaflet-popup-content a{font-weight:600;border-bottom:1px solid var(--b)}
  .drow{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
  .ecard{flex:0 0 218px;background:var(--s);border:1px solid var(--b);border-radius:16px;overflow:hidden;transition:border-color .15s}
  .ecard:hover{border-color:var(--bone)}
  .ecover{height:88px;background:radial-gradient(120% 120% at 70% 20%,var(--s),transparent 60%),var(--ink);border-bottom:1px solid var(--b)}
  .etitle{font-weight:500;font-size:14px;padding:11px 13px 2px}.esub{color:var(--mut);font-size:12px;padding:0 13px 13px}
  .dlist{display:grid;gap:9px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
  .dcard{display:flex;align-items:center;gap:12px;background:var(--s);border:1px solid var(--b);border-radius:14px;padding:10px 12px;transition:border-color .15s}
  .dcard:hover{border-color:var(--bone)}
  .dav{width:42px;height:42px;border-radius:50%;overflow:hidden;border:1px solid var(--b);flex:0 0 auto}.dav svg{width:100%;height:100%;display:block}
  .dmeta{flex:1;min-width:0}.dt-title{font-weight:500;font-size:14.5px}.dt-sub{color:var(--mut);font-size:12px;text-transform:capitalize}
  .dbadge{font-size:9.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:6px;padding:2px 7px}
  .rlist{list-style:none}.rlist li{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--b);font-size:14px}.rmk{color:var(--mut);font-size:8px}.rh{flex:1}.dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .joinb{background:var(--bone);color:var(--ink);border-radius:16px;padding:16px 18px;margin:28px 0 6px;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .joinb strong{font-weight:600;font-size:15px}
  .joinb .bsub{font-size:12.5px;opacity:.66;margin-top:3px}
  .prov{max-width:900px;margin:24px auto 0;padding:0 20px;color:var(--mut);font-size:11.5px;line-height:1.6}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda">${ravenMarkCurrent(30)}</a>
    <div class="nav">${themeToggle()}${d.guest ? `<a class="btn ghost" href="/login">Log in</a><a class="btn" href="/signup">Join free</a>` : `<a class="btn" href="/fan/${d.fanId}">Your feed →</a>`}</div></header>
  <div class="wrap">
    ${rail}
    ${sportChips}${locRow}
    ${featured}
    ${yours}
    ${upcoming}
    ${clubs}
    ${results}
    ${empty}
  </div>
  <div class="prov">The home for sports superfans. One place to follow the teams, athletes &amp; leagues you back. Across every sport — and the culture around it.<br><a href="/create" style="border-bottom:1px solid var(--b)">For athletes &amp; clubs — set up your page →</a></div>
  ${bottomNav({ active: 'home', guest: d.guest, fanId: d.fanId })}
</body></html>`;
}

// --- creator map (its own destination, like fyndafit's Creator Map) ----------
export function renderMap(d: { guest: boolean; fanId: string | null; points: { name: string; region: string | null; href: string; kind: string }[] }): string {
  const pointsJson = JSON.stringify(d.points).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>Creator map — Horda</title>${THEME_BOOT}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  ${THEME_VARS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:72px;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  ${THM_CSS}
  .top{display:flex;justify-content:space-between;align-items:center;padding:13px 20px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(12px);z-index:20}
  .mark{display:flex;align-items:center;color:var(--bone)}.mark svg{display:block}
  .nav{display:flex;gap:9px;align-items:center}
  .btn{display:inline-block;background:var(--bone);color:var(--ink);font-weight:600;border:1px solid var(--bone);border-radius:999px;padding:7px 15px;font-size:13px}
  .btn.ghost{background:transparent;color:var(--bone);border-color:var(--b)}
  .mapwrap{padding:14px 16px 0;max-width:980px;margin:0 auto}
  .mtitle{font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;font-weight:600;color:var(--mut);margin:2px 2px 10px}
  #map{height:calc(100vh - 156px);min-height:380px;border-radius:18px;overflow:hidden;border:1px solid var(--b);background:var(--s)}
  .hz-pin span{display:block;width:13px;height:13px;border-radius:50%;background:var(--bone);border:2px solid var(--ink);box-shadow:0 0 0 1px var(--b)}
  .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:var(--ink);color:var(--bone);border:1px solid var(--b)}
  .leaflet-popup-content{font-family:inherit;font-size:13px}.leaflet-popup-content a{font-weight:600;border-bottom:1px solid var(--b)}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda">${ravenMarkCurrent(30)}</a>
    <div class="nav">${themeToggle()}${d.guest ? `<a class="btn ghost" href="/login">Log in</a><a class="btn" href="/signup">Join free</a>` : `<a class="btn" href="/fan/${d.fanId}">Your feed →</a>`}</div></header>
  <div class="mapwrap">
    <div class="mtitle">Creator map · athletes &amp; clubs near you</div>
    <div id="map" role="img" aria-label="Map of athletes and clubs"></div>
  </div>
  ${bottomNav({ active: 'explore', guest: d.guest, fanId: d.fanId })}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <script>
  (function(){
    if(!window.L){return}
    var C={Berlin:[52.52,13.405],Hamburg:[53.55,9.99],Cologne:[50.94,6.96],Bavaria:[48.14,11.58]};
    var pts=${pointsJson};
    if(!document.getElementById('map')){return}
    var map=L.map('map',{scrollWheelZoom:true}).setView([51.1,10.2],5);
    function url(){var dark=document.documentElement.getAttribute('data-theme')!=='light';return 'https://{s}.basemaps.cartocdn.com/'+(dark?'dark_all':'light_all')+'/{z}/{x}/{y}{r}.png'}
    var opt={subdomains:'abcd',maxZoom:19,attribution:'&copy; OpenStreetMap &copy; CARTO'};
    var layer=L.tileLayer(url(),opt).addTo(map);
    window.addEventListener('hz-theme',function(){map.removeLayer(layer);layer=L.tileLayer(url(),opt).addTo(map)});
    var icon=L.divIcon({className:'hz-pin',html:'<span></span>',iconSize:[16,16],iconAnchor:[8,8],popupAnchor:[0,-8]});
    pts.forEach(function(p){var c=C[p.region];if(!c){return}var j=function(){return (Math.random()-0.5)*0.09};L.marker([c[0]+j(),c[1]+j()],{icon:icon}).addTo(map).bindPopup('<b>'+p.name+'</b><br><a href="'+p.href+'">Open '+p.kind+'</a>')});
  })();
  </script>
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
  tiers?: { level: string; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }[];
  membership?: { memberNo: number; tierLevel: string } | null;
  superfan?: boolean;
  loyalty?: { score: number; threshold: number } | null;
  memberCount?: number;
  canEdit?: boolean;
}): string {
  const isMember = !!d.membership;
  const viewerTier = d.membership?.tierLevel ?? null;
  const tRank = (l?: string | null) => l === 'clubhouse' ? 2 : (l === 'supporter' || l === 'members') ? 1 : 0;
  const canSee = (vis?: string) => !!d.canEdit || tRank(viewerTier) >= tRank(vis);
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
      <div class="pid"><h1>${esc(p.name)}</h1><div class="hsub">${p.handle ? '@' + esc(p.handle) : ''}${nickname ? ` · “${esc(nickname)}”` : ''} · Welterweight${d.superfan ? ' · <span class="sfan">✦ Superfan</span>' : ''}</div></div>
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

  const joinFields = `<input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="owner_kind" value="athlete"><input type="hidden" name="owner_id" value="${p.athleteId}">`;
  const followCard = `<div class="tcard"><div class="th2">Follow <span class="tlvl">Free</span></div>
      <ul class="perks"><li>Public posts, results &amp; matchdays</li><li>Counts toward Superfan status</li></ul>
      ${d.guest ? `<a class="btn" href="/signup">Follow</a>` : `<form method="post" action="/follow"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="target_type" value="athlete"><input type="hidden" name="target_id" value="${p.athleteId}"><button class="btn">Follow</button></form>`}</div>`;
  const tcard = (t: { level: string; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }) => {
    const annual = t.priceAnnualCents ?? t.priceCents * 10;
    const here = isMember && viewerTier === t.level;
    const label = t.level === 'clubhouse' ? 'Clubhouse · Superfan' : 'Supporter';
    const cta = d.guest
      ? `<a class="btn" href="/signup">Join · from ${money(t.priceCents, t.currency)}/mo</a>`
      : here ? `<div class="dt" style="padding:8px 0">✓ You’re in</div>`
        : `<form method="post" action="/join">${joinFields}<input type="hidden" name="level" value="${t.level}"><div class="trow"><button class="btn" name="billing" value="monthly">${money(t.priceCents, t.currency)}/mo</button><button class="btn dark" name="billing" value="annual">${money(annual, t.currency)}/yr</button></div></form>`;
    return `<div class="tcard${t.level === 'clubhouse' ? ' prem' : ''}"><div class="th2">${esc(t.name)} <span class="tlvl">${label}</span></div>
      <ul class="perks">${t.perks.map(pk => `<li>${esc(pk)}</li>`).join('')}</ul>${cta}</div>`;
  };
  const badge = (isMember || d.superfan)
    ? `<div class="membadge">✦ ${d.superfan ? 'Superfan' : (viewerTier === 'clubhouse' ? 'Clubhouse' : 'Supporter')}${isMember ? ` · member #${d.membership!.memberNo}` : ' · earned through loyalty'}${d.memberCount ? ` · ${d.memberCount} members` : ''}</div>`
    : '';
  const loyaltyBar = (!d.guest && !d.superfan && d.loyalty)
    ? `<div class="loy"><div class="dt">${d.loyalty.score} / ${d.loyalty.threshold} to Superfan — attend, predict &amp; share to climb</div><div class="loybar"><span style="width:${Math.min(100, Math.round((d.loyalty.score / d.loyalty.threshold) * 100))}%"></span></div></div>`
    : '';
  const tierCard = `<section id="join" class="card"><div class="ch"><h2>Membership</h2></div>${badge}
      <div class="tierrow">${followCard}${(d.tiers ?? []).map(tcard).join('')}</div>${loyaltyBar}</section>`;

  const postCard = (po: { body: string; date?: string; visibility?: string }) => {
    const vis = po.visibility || 'public';
    const allowed = canSee(vis);
    const req = vis === 'clubhouse' ? 'Clubhouse' : 'Supporter';
    const tagHtml = vis === 'public' ? '<span class="verified">✔</span>' : `<span class="memtag">★ ${req}</span>`;
    const teaser = (po.body || '').slice(0, 140).trim();
    return `<article class="post"><div class="pa"><span class="pav">${av}</span><div class="pmeta"><strong>${esc(p.name)}</strong> ${tagHtml}<div class="dt">${esc(po.date ?? '')}</div></div></div>${allowed
      ? `<p>${esc(po.body)}</p>`
      : `<div class="teaser"><p>${esc(teaser)}…</p><div class="locked">🔒 ${req}-only — ${d.guest ? `<a href="/signup">join</a>` : `<a href="#join">unlock with ${req}</a>`} to read.</div></div>`}</article>`;
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

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(p.name)} — Horda</title>${THEME_BOOT}
<style>
  ${THEME_VARS}
  ${THM_CSS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:96px}
  a{color:inherit;text-decoration:none}
  .top{display:flex;justify-content:space-between;align-items:center;padding:11px 18px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(10px);z-index:20}
  .top .rgt{display:flex;align-items:center;gap:10px}
  .mark{display:flex;align-items:center;color:var(--bone)}.mark svg{display:block}
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
  .sfan{color:var(--bone);font-weight:800}
  #join{display:none}#join:target{display:block}
  .tierrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:6px}
  .tcard{border:1px solid var(--b);border-radius:14px;padding:14px}.tcard.prem{border-color:var(--bone)}
  .th2{font-weight:800;font-size:15px;margin-bottom:8px}.tlvl{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:2px 8px;margin-left:4px}
  .trow{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.trow .btn{flex:1;text-align:center}
  .teaser p{color:var(--mut)}
  .loy{margin-top:14px}.loybar{height:7px;border-radius:999px;background:var(--s);border:1px solid var(--b);overflow:hidden;margin-top:6px}.loybar span{display:block;height:100%;background:var(--bone)}
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
  .gatebar{max-width:648px;margin:18px auto 8px;background:var(--bone);color:var(--ink);display:flex;justify-content:center;align-items:center;gap:16px;padding:14px 18px;font-size:14px;border-radius:14px;flex-wrap:wrap;text-align:center}
  .gatebar .btn{background:var(--ink);color:var(--bone);border-color:var(--ink)}
  .prov{max-width:680px;margin:10px auto 30px;padding:0 16px;color:var(--mut);font-size:11px}
</style></head><body>
  <header class="top"><a class="mark" href="/" aria-label="Horda — home">${ravenMarkCurrent(30)}</a><div class="rgt">${themeToggle()}<a class="dt" href="${d.guest ? '/signup' : `/fan/${d.fanId ?? ''}`}">${d.guest ? 'log in' : 'your feed →'}</a></div></header>
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
  ${bottomNav({ guest: d.guest, fanId: d.fanId })}
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
  const shareText = encodeURIComponent(`I just became a founding member of ${d.name} on Horda. Get closer: joinhorda.com`);
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
  const isCreator = next.includes('/onboarding/athlete') || next.includes('/onboarding/claim');
  return layout('Join the Horda', `
    <h1>Join the Horda</h1>
    <p class="mut">${isCreator ? 'Create your free account — then we’ll set up your page.' : 'Follow the athletes, clubs &amp; leagues you back. Never miss a matchday. Free.'}</p>
    ${oauthButtons(next)}
    <form method="post" action="/signup">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      <label class="mut" style="display:block;margin:12px 0">Name<input style="${inp}" name="name" required></label>
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <label class="mut" style="display:block;margin:12px 0">Password<input style="${inp}" type="password" name="password" required minlength="6"></label>
      <div class="row"><button type="submit">Create account</button></div>
    </form>
    <p class="mut" style="margin-top:14px">Already have one? <a href="/login" style="border-bottom:1px solid var(--b)">Log in</a>.</p>
    ${isCreator ? '' : `<p class="mut" style="margin-top:10px;font-size:12.5px">An athlete, club or federation? <a href="/create" style="border-bottom:1px solid var(--b)">Set up your page →</a></p>`}`, { back: next || '/' });
}

// the separate creator entrance (athletes self-create; clubs/federations claim)
export function renderCreatorEntry(d: { guest: boolean }): string {
  const athleteHref = d.guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const claimHref = d.guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  return layout('Set up your page', `
    <style>.cgrid{display:grid;gap:12px;margin-top:16px}.ccard{border:1px solid var(--b);border-radius:14px;padding:16px 18px}.ccard h2{margin:0 0 4px;font-size:17px;border:none;padding:0;text-transform:none;letter-spacing:0}.ccard p{color:var(--mut);font-size:13.5px;margin:0 0 12px}</style>
    <h1>For athletes, clubs &amp; federations</h1>
    <p class="mut">Run your own page on Horda — posts, members, tiers and events, all in one place.</p>
    <div class="cgrid">
      <div class="ccard"><h2>I’m an athlete</h2><p>Describe yourself in a sentence and we build your page — headline, cover, the lot. You own it instantly.</p><a class="btn" href="${athleteHref}">Create my page →</a> <a href="/athletes" style="margin-left:8px;font-size:13px;border-bottom:1px solid var(--b)">what you get →</a></div>
      <div class="ccard"><h2>We’re a club or federation</h2><p>Find your page and verify you represent it (official email, a code on your site, or a quick review).</p><a class="btn" href="${claimHref}">Claim our page →</a> <a href="/clubs" style="margin-left:8px;font-size:13px;border-bottom:1px solid var(--b)">what you get →</a></div>
    </div>
    <p class="mut" style="margin-top:16px;font-size:12.5px">Just here to follow? <a href="/signup" style="border-bottom:1px solid var(--b)">Create a fan account →</a></p>`, { back: '/' });
}

// --- onboarding: fan first-run (pick a sport, follow a few faces) ----------
export function renderOnboardFan(d: { fanId: string; sport?: string; sports: { key: string; name: string }[]; athletes: { id: string; name: string; sport: string | null; region: string | null; verified?: boolean }[]; clubs: { id: string; name: string; sport: string | null; region: string | null; verified?: boolean }[]; followedCount: number }): string {
  const chip = (label: string, key?: string) => `<a class="chip${(key ?? '') === (d.sport ?? '') ? ' on' : ''}" href="/onboarding/fan${key ? `?sport=${key}` : ''}">${esc(label)}</a>`;
  const follow = (type: string, id: string, name: string, sub: string, verified?: boolean) =>
    `<div class="ocard"><div class="ometa"><div class="on">${esc(name)}${verified ? ' <span class="sf">✦</span>' : ''}</div><div class="osub">${esc(sub)}</div></div><form method="post" action="/follow"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="target_type" value="${type}"><input type="hidden" name="target_id" value="${id}"><button class="btn sm">Follow</button></form></div>`;
  const list = [
    ...d.athletes.map(a => follow('athlete', a.id, a.name, [a.sport, a.region].filter(Boolean).join(' · ') || 'athlete', a.verified)),
    ...d.clubs.map(c => follow('club', c.id, c.name, [c.sport, c.region].filter(Boolean).join(' · ') || 'club', c.verified)),
  ].join('') || `<p class="mut">No coverage for that sport yet — try another, or follow later.</p>`;
  return layout('Set up your Horda', `
    <style>.ocard{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--b);border-radius:12px;padding:11px 13px;margin:8px 0}.on{font-weight:800;font-size:15px}.osub{color:var(--mut);font-size:12px;text-transform:capitalize}.btn.sm{padding:7px 14px;font-size:13px}.sf{color:var(--bone)}.chip{display:inline-block;border:1px solid var(--b);color:var(--mut);border-radius:999px;padding:6px 12px;font-size:12.5px;margin:0 6px 6px 0}.chip.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}</style>
    <h1>Find your people</h1>
    <p class="mut">Follow a few to fill your feed. You can change this anytime.${d.followedCount ? ` <b>${d.followedCount} followed.</b>` : ''}</p>
    <div style="margin:12px 0">${chip('All sports')}${d.sports.map(s => chip(s.name, s.key)).join('')}</div>
    ${list}
    <div class="row" style="margin-top:18px"><a class="btn" href="/onboarding/done">${d.followedCount ? 'Go to your feed →' : 'Skip for now →'}</a></div>`, { back: '/' });
}

// --- onboarding: AI-first. Describe yourself → we generate a polished page. ---
export function renderAiPrompt(d: { title: string; lead: string; placeholder: string; generateAction: string; hidden?: string; back: string; altLink?: string }): string {
  const ta = 'display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:13px;font:inherit;min-height:150px;line-height:1.55';
  return layout(d.title, `
    <h1>${esc(d.title)}</h1>
    <p class="mut">${esc(d.lead)}</p>
    <form method="post" action="${esc(d.generateAction)}">${d.hidden ?? ''}
      <textarea name="description" required placeholder="${esc(d.placeholder)}" style="${ta}"></textarea>
      <div class="row" style="margin-top:12px"><button type="submit">✦ Generate my page</button></div>
    </form>
    <p class="mut" style="margin-top:12px;font-size:12.5px">We turn your words into a bold, on-brand page — a cooler headline, a striking cover, the works. You can tweak everything before it goes live.</p>
    ${d.altLink ?? ''}`, { back: d.back });
}

export function renderProfilePreview(d: { kind: string; gen: { displayName: string; handle: string; headline: string; tagline: string; bio: string; cover: string; links?: Record<string, string> }; description: string; createAction: string; generateAction: string; hidden?: string; showHandle?: boolean }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const g = d.gen;
  return layout('Your page — preview', `
    <style>.pvcover{width:100%;border-radius:16px;border:1px solid var(--b);display:block;aspect-ratio:1200/420;object-fit:cover}.pvh{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:700;margin:18px 0 6px}</style>
    <h1>Here’s your page ✦</h1>
    <p class="mut">Generated from what you told us. Edit anything, regenerate, or publish.</p>
    <img class="pvcover" src="${esc(g.cover)}" alt="generated cover">
    <div class="pvh">Headline</div><div style="font-size:20px;font-weight:800">${esc(g.headline || g.displayName)}</div>
    <form method="post" action="${esc(d.createAction)}">${d.hidden ?? ''}
      <input type="hidden" name="cover" value="${esc(g.cover)}">
      <input type="hidden" name="links" value="${esc(JSON.stringify(g.links ?? {}))}">
      ${g.links && Object.keys(g.links).length ? `<div class="pvh">Links found</div><div class="mut" style="font-size:12.5px">${Object.keys(g.links).map(k => esc(k)).join(' · ')}</div>` : ''}
      <div class="pvh">Profile picture</div>
      <input type="file" accept="image/*" data-target="avatar" style="color:inherit;font:inherit"><input type="hidden" name="avatar">
      <div class="pvh">Background photo <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">— optional; replaces the generated cover</span></div>
      <input type="file" accept="image/*" data-target="banner" style="color:inherit;font:inherit"><input type="hidden" name="banner">
      <label class="mut" style="display:block;margin:14px 0 0">Name<input style="${inp}" name="name" value="${esc(g.displayName)}" required></label>
      ${d.showHandle !== false ? `<label class="mut" style="display:block;margin:12px 0 0">Handle<input style="${inp}" name="handle" value="${esc(g.handle)}" required></label>` : ''}
      <label class="mut" style="display:block;margin:12px 0 0">Tagline<input style="${inp}" name="tagline" value="${esc(g.tagline)}"></label>
      <label class="mut" style="display:block;margin:12px 0 0">Bio / intro<textarea style="${inp};min-height:90px" name="bio">${esc(g.bio)}</textarea></label>
      <div class="row" style="margin-top:14px"><button type="submit">Publish my page →</button></div>
    </form>
    <form method="post" action="${esc(d.generateAction)}" style="margin-top:8px">${d.hidden ?? ''}<input type="hidden" name="description" value="${esc(d.description)}"><div class="row"><button class="ghost" type="submit">↻ Regenerate</button></div></form>
    ${UPLOAD_SCRIPT}`, { back: '/' });
}

// --- onboarding: club / federation finds + claims its page -----------------
export function renderOnboardClaim(d: { q: string; results: { kind: string; id: string; name: string; region: string | null }[] }): string {
  const inp = 'flex:1;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const rows = d.results.length
    ? d.results.map(r => `<div class="ocard"><div class="ometa"><div class="on">${esc(r.name)}</div><div class="osub">${esc(r.kind)}${r.region ? ' · ' + esc(r.region) : ''}</div></div><a class="btn sm" href="/claim/${r.kind}/${r.id}">Claim →</a></div>`).join('')
    : (d.q ? `<p class="mut">No match for “${esc(d.q)}”. It may not be on Horda yet — <a href="/onboarding/athlete" style="border-bottom:1px solid var(--b)">create a page</a> or contact us to add your league.</p>` : '');
  return layout('Claim your page', `
    <style>.ocard{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--b);border-radius:12px;padding:11px 13px;margin:8px 0}.on{font-weight:800;font-size:15px}.osub{color:var(--mut);font-size:12px;text-transform:capitalize}.btn.sm{padding:7px 14px;font-size:13px}</style>
    <h1>Claim your club or federation</h1>
    <p class="mut">Find your page, then verify you represent it — by an official email, a code on your site, or a quick review.</p>
    <form method="get" action="/onboarding/claim"><div class="row" style="margin:12px 0"><input style="${inp}" name="q" value="${esc(d.q)}" placeholder="Search your club or federation"><button type="submit">Search</button></div></form>
    ${rows}`, { back: '/' });
}

export function renderLogin(next: string): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  return layout('Log in', `
    <h1>Log in</h1>
    ${oauthButtons(next)}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <label class="mut" style="display:block;margin:12px 0">Password<input style="${inp}" type="password" name="password" required></label>
      <div class="row"><button type="submit">Log in</button></div>
    </form>
    <p class="mut" style="margin-top:14px">New here? <a href="/signup" style="border-bottom:1px solid var(--b)">Create an account</a>. · <a href="/forgot" style="border-bottom:1px solid var(--b)">Forgot password?</a></p>`, { back: next || '/' });
}

// --- password reset ---------------------------------------------------------
// Request form. After submit we always show the same confirmation (no email
// enumeration), whether or not the address exists.
export function renderForgot(sent: boolean, devLink?: string | null): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  if (sent) return layout('Check your email', `
    <h1>Check your email</h1>
    <p class="mut">If an account exists for that address, we've sent a link to reset your password. It expires in 1 hour.</p>
    ${devLink ? `<div class="card" style="margin-top:14px"><div class="mut" style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800">Dev mode — email not configured</div><p class="mut" style="font-size:13px;margin-top:6px">Use this link to continue:</p><a href="${esc(devLink)}" style="border-bottom:1px solid var(--b);word-break:break-all">${esc(devLink)}</a></div>` : ''}
    <p class="mut" style="margin-top:14px"><a href="/login" style="border-bottom:1px solid var(--b)">Back to log in</a></p>`, { back: '/login' });
  return layout('Reset password', `
    <h1>Reset password</h1>
    <p class="mut">Enter your email and we'll send you a link to set a new password.</p>
    <form method="post" action="/forgot">
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <div class="row"><button type="submit">Send reset link</button></div>
    </form>
    <p class="mut" style="margin-top:14px"><a href="/login" style="border-bottom:1px solid var(--b)">Back to log in</a></p>`, { back: '/login' });
}

// Set-new-password form (reached from the email link). `error` is shown when the
// token is invalid/expired; `done` after a successful reset.
export function renderReset(token: string, opts: { error?: boolean; done?: boolean } = {}): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  if (opts.done) return layout('Password updated', `
    <h1>Password updated</h1>
    <p class="mut">Your password has been changed and you've been signed out everywhere. You can log in with your new password now.</p>
    <p style="margin-top:14px"><a href="/login"><button type="button">Log in</button></a></p>`, { back: '/login' });
  if (opts.error) return layout('Link expired', `
    <h1>This link is invalid or expired</h1>
    <p class="mut">Reset links work once and expire after an hour. Request a fresh one.</p>
    <p style="margin-top:14px"><a href="/forgot"><button type="button">Send a new link</button></a></p>`, { back: '/login' });
  return layout('Choose a new password', `
    <h1>Choose a new password</h1>
    <form method="post" action="/reset">
      <input type="hidden" name="token" value="${esc(token)}">
      <label class="mut" style="display:block;margin:12px 0">New password<input style="${inp}" type="password" name="password" minlength="8" required></label>
      <div class="row"><button type="submit">Update password</button></div>
    </form>`, { back: '/login' });
}

// --- claim verification --------------------------------------------------
// Shown after someone requests a page they don't yet control. They're not the
// owner until verified — here's how to prove it.
export function renderClaimPending(d: { kind: string; id: string; name: string; code: string; site: string | null; backHref: string }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const siteLine = d.site
    ? `Add this code anywhere on <b>${esc(d.site)}</b> (a page, the footer, a meta tag), then re-check below. We confirm you control the official channel — instantly, no waiting.`
    : `This page has no official website on file yet, so we'll verify your claim by review. Our team (or the governing association) will confirm it shortly.`;
  return layout(`Claim ${d.name}`, `
    <h1>Claim received</h1>
    <p class="mut">You've requested to manage <b>${esc(d.name)}</b>. You're <b>not the owner yet</b> — we verify claims so only the real club/athlete/federation can run a page.</p>

    <div class="card" style="margin-top:14px">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:800">Your verification code</div>
      <div style="font-size:22px;font-weight:800;font-family:ui-monospace,Menlo,monospace;margin:8px 0;user-select:all">${esc(d.code)}</div>
      <p class="mut" style="font-size:13.5px">${siteLine}</p>
      ${d.site ? `<form method="post" action="/claim/${d.kind}/${d.id}/verify"><div class="row"><button type="submit">I've added it — re-check now</button></div></form>` : ''}
    </div>

    <div class="card" style="margin-top:12px">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:800">Other ways to verify</div>
      <ul style="margin-top:8px">
        <li><span class="hl">Official email</span> — sign up with an address at the entity's domain and the claim is approved automatically.</li>
        <li><span class="hl">Review</span> — the platform admin, or the governing association, can approve your claim from their queue.</li>
      </ul>
    </div>
    <div class="row" style="margin-top:14px"><a class="tag" href="${esc(d.backHref)}">Back</a></div>`, { back: d.backHref });
}

export function renderClaimQueue(d: { claims: { id: string; accountEmail: string; targetKind: string; targetId: string; targetName: string; method: string; channelCode: string | null; createdAt: string }[]; isAdmin: boolean }): string {
  const rows = d.claims.length ? d.claims.map(c => `
    <div class="card" style="margin-bottom:10px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div class="hl">${esc(c.targetName)} <span class="tag mutd">${esc(c.targetKind)}</span></div>
          <div class="mut" style="font-size:13px">requested by <b>${esc(c.accountEmail)}</b> · ${esc(c.createdAt)} · via ${esc(c.method)}</div>
          ${c.channelCode ? `<div class="mut" style="font-size:12px;font-family:ui-monospace,Menlo,monospace;margin-top:4px">code: ${esc(c.channelCode)}</div>` : ''}
        </div>
        <div class="row">
          <form method="post" action="/claims/${c.id}/decide"><input type="hidden" name="decision" value="approve"><button type="submit">Approve</button></form>
          <form method="post" action="/claims/${c.id}/decide"><input type="hidden" name="decision" value="reject"><button class="tag" type="submit">Reject</button></form>
        </div>
      </div>
    </div>`).join('') : `<p class="mut">No claims waiting on you. 🐦‍⬛</p>`;
  return layout('Claims to review', `
    <h1>Claims to review</h1>
    <p class="mut">${d.isAdmin ? 'Platform admin queue — every pending claim.' : 'Claims for clubs and teams your association governs.'} Approve only when you can confirm the person represents the real entity.</p>
    ${rows}`, { back: '/' });
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
    <div class="row"><a class="tag mutd" href="/create">＋ Run your own page</a></div>
    ${drop}${following}${notifs}${preds}${feed}
    <div class="prov">Your feed is coverage of what you follow — not a stream of other fans.</div>`, { back: '/', nav: { active: 'you', guest: false, fanId: d.fanId } });
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
