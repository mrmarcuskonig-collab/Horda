// pages.ts — the screens. Dumb renderers: all data is assembled by the routes.
import { layout, esc, linkify } from './layout.ts';
import { socialIcon, kindIcon } from './icons.ts';
import { editPanel, UPLOAD_SCRIPT } from './shell.ts';
import { ravenMark, ravenMarkCurrent } from './brand.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav, verifiedBadge, actionBar, langToggle, backButton, deskRail, shareButton, followControl, SHARE_SCRIPT } from './theme.ts';
import { t, type Lang } from './i18n.ts';
import { sportLabelL } from './localize.ts';
import { bannerSvg, defaultThemeForSport, svgDataUri } from './theme_engine.ts';
import { oauthProviders } from './oauth.ts';
import { SECTIONS } from './sections.ts';
import { discordFootLink, discordUrl, hasDiscord, discordMark, DISCORD_PATH } from './community.ts';

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
// Curated location suggestions (merged with regions actually present in the
// data). Beachhead-first: German cities + Länder, then a few countries.
const LOC_CURATED = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig',
  'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Bochum', 'Wuppertal',
  'Bayern', 'Baden-Württemberg', 'Nordrhein-Westfalen', 'Hessen', 'Sachsen', 'Niedersachsen',
  'Brandenburg', 'Rheinland-Pfalz', 'Schleswig-Holstein', 'Thüringen',
  'Germany', 'Austria', 'Switzerland',
];
// Geolocation: only on explicit click, and we resolve to a COARSE nearest city
// (never put raw coordinates in the URL). Auto-submits the filter on pick.
const LOC_SCRIPT = `<script>(function(){
var f=document.getElementById('locform'),i=document.getElementById('locin'),b=document.getElementById('locbtn');
if(!f||!i){return}
i.addEventListener('input',function(){var os=document.querySelectorAll('#loclist option');for(var n=0;n<os.length;n++){if(os[n].value===i.value){f.submit();return}}});
if(b){b.addEventListener('click',function(){
 if(!navigator.geolocation){return}
 b.classList.add('busy');
 navigator.geolocation.getCurrentPosition(function(p){
  var C={Berlin:[52.52,13.40],Hamburg:[53.55,9.99],"München":[48.14,11.58],"Köln":[50.94,6.96],Frankfurt:[50.11,8.68],Stuttgart:[48.78,9.18],"Düsseldorf":[51.23,6.78],Leipzig:[51.34,12.37],Dortmund:[51.51,7.47],Bremen:[53.08,8.80],Hannover:[52.37,9.73],"Nürnberg":[49.45,11.08],Dresden:[51.05,13.74]};
  var la=p.coords.latitude,lo=p.coords.longitude,best=null,bd=1e9;
  for(var k in C){var a=la-C[k][0],o=lo-C[k][1],dd=a*a+o*o;if(dd<bd){bd=dd;best=k}}
  if(best){i.value=best;f.submit()}else{b.classList.remove('busy')}
 },function(){b.classList.remove('busy')},{timeout:8000,maximumAge:600000});
})}
})();
</script>`;

export function renderDiscover(d: {
  guest: boolean; fanId: string | null; sport?: string; region?: string; createHref?: string; lang?: Lang; unread?: number;
  organized?: { eventId: string; title: string; date: string | null; hostName: string; role: 'organizer' | 'co-organizer' }[];
  data: { sports: { key: string; name: string }[]; regions?: string[];
    athletes: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; banner: string | null; verified?: boolean }[];
    clubs: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; verified?: boolean }[];
    upcoming: { id: string; title: string; date?: string; host: string; admission: string; going?: number; shares?: number; followers?: number; live?: boolean; coverUrl?: string | null; claimed?: boolean }[];
    results: { headline: string; date?: string }[] };
  regions: string[];
}): string {
  const lang: Lang = d.lang ?? 'en';
  const tr = (k: string) => t(lang, k);
  const qp = (sp?: string, rg?: string) => { const u = new URLSearchParams(); if (sp) u.set('sport', sp); if (rg) u.set('region', rg); const s = u.toString(); return s ? `/?${s}` : '/'; };
  const chip = (label: string, active: boolean, href: string) => `<a class="chip${active ? ' on' : ''}" href="${href}">${esc(label)}</a>`;

  // One scrolling sport row, ordered by global popularity. Football & boxing are
  // the two with live coverage; the rest read as universal (filter → empty state).
  // The row clips the last chip so the user senses there's more to swipe.
  // Chip labels render in the viewer's language (Fußball, Radsport, …) — a German
  // fan couldn't recognise their sport when every chip was English. The English
  // label is the fallback; sportLabelL swaps in the German one when lang=de.
  const POPULAR_KEYS: [string, string][] = [['football', 'Football'], ['basketball', 'Basketball'], ['boxing', 'Boxing'], ['tennis', 'Tennis'], ['running', 'Running'], ['mma', 'MMA'], ['esports', 'Esports'], ['digital_sports', 'Digital sports'], ['cycling', 'Cycling'], ['volleyball', 'Volleyball'], ['handball', 'Handball'], ['ice_hockey', 'Ice hockey'], ['triathlon', 'Triathlon']];
  const sportChips = `<div class="chips scroll">${chip(tr('all_sports'), !d.sport, qp(undefined, d.region))}${POPULAR_KEYS.map(([k, n]) => chip(sportLabelL(k, n, lang), d.sport === k, qp(k, d.region))).join('')}</div>`;

  // Location: a free field (works for a rural village or Los Angeles) with
  // type-ahead suggestions, plus a "use my location" pin. Suggestions = regions
  // present in the data + a curated city/country list. Submits on pick/Enter.
  const locOpts = Array.from(new Set([...(d.data.regions ?? []), ...LOC_CURATED].filter(Boolean)));
  const pinSvg = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  const locRow = `<div class="chips locrow">${chip('Everywhere', !d.region, qp(d.sport, undefined))}<form class="locform" method="get" action="/" id="locform">${d.sport ? `<input type="hidden" name="sport" value="${esc(d.sport)}">` : ''}<span class="locwrap"><input name="region" value="${esc(d.region ?? '')}" list="loclist" placeholder="City or country" class="locin" autocomplete="off" aria-label="City or country" id="locin"><button type="button" class="locbtn" id="locbtn" title="Use my location" aria-label="Use my location">${pinSvg}</button></span><datalist id="loclist">${locOpts.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist></form>${d.region ? `<a class="chip on" href="${qp(d.sport, undefined)}" title="Clear location">${esc(d.region)} ✕</a>` : ''}</div>${LOC_SCRIPT}`;

  // Event map — kept, but as a designed section (no IG-style round photo tiles).
  const mapPin = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
  const mapSection = `<section class="mapcard">
    <div class="mapgrid" aria-hidden="true"></div>
    <div class="mapcon">
      <span class="mappin">${mapPin}</span>
      <div class="maptx"><div class="mapt">Event map</div><div class="maps">See the matches, fight nights and meet-ups happening near you — plotted on a live map.</div></div>
      <a class="btn" href="/map">Open the map →</a>
    </div>
  </section>`;

  // Compact numbers (1.2K) for the engagement chips — the TikTok idiom.
  const num = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n);
  const ICN = {
    going: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14c2.2.4 3.7 2 3.7 4.4"/></svg>`,
    share: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.9 7.1-3.8M8.2 13.1l7.1 3.8"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20S3 14.6 3 8.9C3 6 5.1 4 7.7 4c1.8 0 3.3 1 4.3 2.4C13 5 14.5 4 16.3 4 18.9 4 21 6 21 8.9 21 14.6 12 20 12 20Z"/></svg>`,
  };
  const estats = (e: { going?: number; shares?: number; followers?: number }) => `<div class="estats">` +
    `<span class="est" title="${esc(tr('going'))}">${ICN.going}${num(e.going ?? 0)}</span>` +
    `<span class="est" title="${esc(tr('followers'))}">${ICN.heart}${num(e.followers ?? 0)}</span>` +
    `<span class="est" title="${esc(tr('shares'))}">${ICN.share}${num(e.shares ?? 0)}</span></div>`;

  // featured — the lead content: big, photo-forward PUBLIC EVENT cards (Horda is
  // an identity-capture + events + ticketing product; events lead everywhere).
  const admLabel = (a: string) => a === 'paid' ? 'Ticketed' : a === 'apply' ? 'Apply' : 'Free';
  const featured = d.data.upcoming.length ? `<h2>${esc(tr('events_head'))}</h2><div class="feat">${d.data.upcoming.map(e => {
    const big = e.coverUrl ? `<img class="fimg" src="${esc(e.coverUrl)}" alt="">` : `<img class="fimg" src="${esc(svgDataUri(bannerSvg({ name: e.title, sport: null }, defaultThemeForSport(null), { backdrop: true })))}" alt="">`;
    // An event YOU hold a pass/ticket for is marked in orange (the accent) — top
    // chip + accent border — so your own tickets stand out in the public list.
    const chip = e.claimed ? `<span class="claimedpill" style="top:11px;left:11px">✓ You're in</span>`
      : e.live ? `<span class="livepill" style="top:11px;left:11px"><span class="live-dot"></span>${esc(tr('live_now'))}</span>`
      : `<div class="fid"><span class="fnm">${esc(admLabel(e.admission))}</span></div>`;
    const meta = `${esc(e.host)} · ${e.live ? '<b style="color:var(--acc)">happening now</b>' : esc(e.date ?? 'soon')}`;
    return `<a class="fcard${e.live ? ' islive' : ''}${e.claimed ? ' claimed' : ''}" href="/e/${e.id}">${big}<div class="fscrim"></div>${chip}` +
      `<div class="fcap"><div class="ftitle">${esc(e.title)}</div><div class="fmeta">${meta}</div><div class="fstats">${estats(e)}</div></div></a>`;
  }).join('')}</div>` : '';

  const card = (href: string, title: string, sub: string, badge: string, verified = false) =>
    `<a class="dcard" href="${href}"><div class="dav">${avatarSvg(title)}</div><div class="dmeta"><div class="dt-title">${esc(title)}${verified ? verifiedBadge() : ''}</div><div class="dt-sub">${esc(sub)}</div></div><span class="dbadge">${esc(badge)}</span></a>`;

  const clubs = d.data.clubs.length ? `<h2>${esc(tr('clubs_head'))}</h2><div class="dlist">${
    d.data.clubs.map(c => card(`/club/${c.id}`, c.name, [c.sport, c.region].filter(Boolean).join(' · ') || 'club', 'club', c.verified)).join('')
  }</div>` : '';
  // Results intentionally omitted: Horda is a superfan platform (drops, exclusive
  // access, tiers, events) — not a scores/standings product. We lead with events.
  // An empty filter is the single best moment to ask someone to create an event:
  // they've just told us the exact sport and city they care about, and we've just
  // told them nobody is serving it. "Nothing here" is a dead end; "nothing here
  // YET — be the first" is an invitation, and it converts the person with the
  // strongest possible reason to host. Works for guests too (→ signup → create).
  const isFiltered = !!(d.sport || d.region);
  const noEvents = !d.data.upcoming.length;
  const where = d.region ? ` in ${esc(d.region)}` : ' near you';
  const whatSport = d.sport ? `${esc(sportLabel(d.sport))} ` : '';
  const empty = (isFiltered && noEvents)
    ? `<div class="nores">
        <div class="nrt">No ${whatSport}events${where} yet.</div>
        <p>Be the first. It takes a minute and it's free — and everyone following ${d.sport ? esc(sportLabel(d.sport)) : 'this sport'}${d.region ? ` around ${esc(d.region)}` : ''} will see it.</p>
        <a class="btn" href="${esc(d.createHref || '/create')}">Create the first one →</a>
       </div>`
    : ((!d.data.athletes.length && !d.data.clubs.length)
        ? `<p class="mut" style="margin-top:14px">Nothing here for that filter yet — try another sport or region.</p>` : '');

  // Logged-in home leads with the events YOU ORGANISE — as the main organiser or a
  // co-organiser — soonest first, left → right. A horizontal rail: if they don't
  // all fit, the next card peeks so it's obvious you can slide for more. Empty → a
  // nudge to create your first event. (Events you've CLAIMED live under Events ·
  // live & upcoming below, marked in orange — not here.)
  const organized = d.organized ?? [];
  const orgCard = (ev: NonNullable<typeof d.organized>[number]) =>
    `<a class="ocard" href="/e/${ev.eventId}"><div class="orole">${ev.role === 'co-organizer' ? 'Co-organiser' : 'You organise'}</div><div class="otitle">${esc(ev.title)}</div><div class="osub">${esc(ev.hostName || '')}${ev.date ? ' · ' + esc(ev.date) : ''}</div></a>`;
  const yourEvents = d.guest ? '' : (organized.length
    ? `<h2>Your events <span class="h2note">that you organize</span></h2><div class="orow">${organized.map(orgCard).join('')}</div>`
    : `<div class="joinb"><div><strong>You're not organising anything yet</strong><div class="bsub">Create an event — a match, a fight night, a run club — and it shows up here.</div></div><a class="btn" href="${esc(d.createHref || '/create')}">Create an event →</a></div>`);

  // The shared desktop rail (identical to every other page).
  const deskRailHtml = deskRail({ guest: d.guest, fanId: d.fanId, lang, unread: d.unread ?? 0, active: 'explore', region: d.region, sport: d.sport });

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>Horda</title>${THEME_BOOT}
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
  .locwrap{position:relative;display:inline-flex;align-items:center}
  .locin{background:transparent;border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:7px 38px 7px 15px;font:inherit;font-size:12.5px;min-width:200px}
  .locin:focus{outline:none;border-color:var(--bone)}.locin::placeholder{color:var(--mut)}
  .locbtn{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:27px;height:27px;border:0;background:transparent;color:var(--mut);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
  .locbtn:hover{color:var(--bone);background:var(--s)}
  .locbtn.busy{opacity:.5;pointer-events:none}
  h2{font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;font-weight:600;color:var(--bone);margin:32px 0 13px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .h2note{font-size:11px;letter-spacing:.2px;text-transform:none;font-weight:400;color:var(--mut)}
  .rail{display:flex;gap:16px;overflow-x:auto;padding:10px 0 4px}
  .rail::-webkit-scrollbar,.feat::-webkit-scrollbar,.drow::-webkit-scrollbar{height:0}
  .story{flex:0 0 auto;width:66px;display:flex;flex-direction:column;align-items:center;gap:8px}
  .ring{width:64px;height:64px;border-radius:50%;padding:3px;display:block;box-sizing:border-box;transition:transform .16s}
  .story:hover .ring{transform:scale(1.05)}
  /* soft white halo ring (dark-only) */
  .ring:not(.act){background:var(--bone);box-shadow:0 0 12px rgba(237,233,223,.32)}
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
  .fcap{position:absolute;left:14px;right:14px;bottom:14px;color:#EDE9DF;font-size:12px;font-weight:500;letter-spacing:.2px;text-transform:capitalize;opacity:.9}
  .fcap .ftitle{font-weight:700;font-size:14.5px;line-height:1.15;text-transform:none;letter-spacing:-.01em}
  .fcap .fmeta{margin-top:3px;font-size:12px;font-weight:500;text-transform:none;opacity:.92}
  .fcap .fstats{margin-top:7px}
  .fcap .fstats .est{color:rgba(237,233,223,.92)}
  .fcard.islive{border-color:var(--acc)}
  /* Event map section (replaces the round photo rail) */
  .mapcard{position:relative;margin:22px 0 8px;border:1px solid var(--b);border-radius:18px;overflow:hidden;background:radial-gradient(120% 140% at 88% -20%,rgba(225,90,64,.18),transparent 55%),var(--s)}
  .mapgrid{position:absolute;inset:0;opacity:.5;background-image:linear-gradient(var(--b) 1px,transparent 1px),linear-gradient(90deg,var(--b) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(120% 120% at 85% 10%,#000,transparent 70%);mask-image:radial-gradient(120% 120% at 85% 10%,#000,transparent 70%)}
  .mapcon{position:relative;display:flex;align-items:center;gap:15px;padding:18px 18px}
  .mappin{flex:0 0 auto;width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--acc);background:rgba(225,90,64,.12);border:1px solid rgba(225,90,64,.3)}
  .maptx{flex:1;min-width:0}.mapt{font-weight:700;font-size:15.5px;letter-spacing:-.01em}.maps{color:var(--mut);font-size:13px;margin-top:2px;line-height:1.45}
  @media(max-width:560px){.mapcon{flex-wrap:wrap}.mapcon .btn{flex:1 0 100%;text-align:center}}
  #map{height:360px;border-radius:18px;overflow:hidden;border:1px solid var(--b);margin:2px 0;background:var(--s)}
  .hz-pin span{display:block;width:13px;height:13px;border-radius:50%;background:var(--bone);border:2px solid var(--ink);box-shadow:0 0 0 1px var(--b)}
  .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:var(--ink);color:var(--bone);border:1px solid var(--b)}
  .leaflet-popup-content{font-family:inherit;font-size:13px}.leaflet-popup-content a{font-weight:600;border-bottom:1px solid var(--b)}
  .drow{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px}
  .ecard{flex:0 0 218px;background:var(--s);border:1px solid var(--b);border-radius:16px;overflow:hidden;transition:border-color .15s}
  .ecard:hover{border-color:var(--bone)}
  .ecover{position:relative;height:88px;background:radial-gradient(120% 120% at 70% 20%,var(--s),transparent 60%),var(--ink);border-bottom:1px solid var(--b)}
  .ecard.islive{border-color:var(--acc)}
  .livepill{position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;gap:5px;background:var(--acc);color:#fff;font-size:10px;font-weight:800;letter-spacing:1px;border-radius:999px;padding:3px 8px}
  /* An event you hold a ticket for: accent chip + accent border on its card. */
  .claimedpill{position:absolute;display:inline-flex;align-items:center;gap:4px;background:var(--acc);color:#fff;font-size:10px;font-weight:800;letter-spacing:.5px;border-radius:999px;padding:3px 9px;z-index:2}
  .fcard.claimed{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
  /* "Your events that you organise" — a horizontal rail; the next card peeks so
     it's obvious you can slide for more. Cards are ~78% wide on mobile → ~1.3
     visible with a peek; the row grows to fit more on wider screens. */
  .orow{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;margin:16px 0 26px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
  .orow::-webkit-scrollbar{height:0}
  .ocard{flex:0 0 78%;max-width:300px;scroll-snap-align:start;background:var(--s);border:1px solid var(--b);border-radius:14px;padding:13px 15px;display:block;transition:border-color .15s}
  @media(min-width:560px){.ocard{flex-basis:300px}}
  .ocard:hover{border-color:var(--bone)}
  .ocard .orole{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--acc);margin-bottom:5px}
  .ocard .otitle{font-weight:800;font-size:15.5px;line-height:1.25;letter-spacing:-.01em}
  .ocard .osub{color:var(--mut);font-size:12.5px;margin-top:3px}
  .livepill .live-dot{background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.3);width:6px;height:6px}
  .etitle{font-weight:500;font-size:14px;padding:11px 13px 2px}.esub{color:var(--mut);font-size:12px;padding:0 13px 8px}
  /* TikTok-style engagement chips on event cards */
  .estats{display:flex;gap:13px;padding:0 13px 12px;color:var(--mut)}
  .est{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;letter-spacing:.2px}
  .est svg{opacity:.9}
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
  .provl{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap}
  .provl a{color:var(--mut);border-bottom:1px solid var(--b)}
  .nores{border:1px dashed var(--b);border-radius:18px;padding:26px 22px;margin-top:14px;text-align:center}
  .nores .nrt{font-size:19px;font-weight:800;letter-spacing:-.01em;margin-bottom:7px}
  .nores p{color:var(--mut);font-size:14px;line-height:1.6;margin:0 auto 16px;max-width:46ch}
</style></head><body class="deskrail">
  ${deskRailHtml}
  <div class="wrap">
    ${sportChips}${locRow}
    ${yourEvents}
    ${featured}
    ${mapSection}
    ${clubs}
    ${empty}
  </div>
  <div class="prov">The events home for sports and competitive culture.<br><a href="/about" style="border-bottom:1px solid var(--b)">For athletes &amp; clubs — see what you get →</a>
    <span class="provl"><a href="/changelog">Changelog</a>${discordFootLink()}<a href="/agb">Terms</a><a href="/impressum">Legal notice</a><a href="/datenschutz">Privacy</a></span></div>
  ${bottomNav({ active: 'home', guest: d.guest, fanId: d.fanId, createHref: d.createHref })}
${SHARE_SCRIPT}
</body></html>`;
}

// --- event map (its own destination) — public events plotted near you --------
export function renderMap(d: { guest: boolean; fanId: string | null; createHref?: string; lang?: Lang; points: { name: string; region: string | null; href: string; kind: string; avatar?: string | null; live?: boolean }[] }): string {
  // The map opened in English no matter your language: <html lang="en"> was
  // hardcoded and no lang reached the nav, so the whole rail reverted to English
  // the moment you clicked "Open the map". Carry the chosen language through.
  const lang: Lang = d.lang ?? 'en';
  const pointsJson = JSON.stringify(d.points).replace(/</g, '\\u003c');
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(t(lang, 'event_map'))} — Horda</title>${THEME_BOOT}
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
  #map{height:calc(100vh - 118px);min-height:380px;border-radius:18px;overflow:hidden;border:1px solid var(--b);background:var(--s)}
  /* Instagram-style ring avatar markers — white halo (dark) / gradient (light), matching the landing */
  .hz-av{background:transparent !important;border:0 !important}
  .hz-av .mav{display:block;width:46px;height:46px;border-radius:50%;padding:2px;box-sizing:border-box;cursor:pointer;transition:transform .15s;background:var(--bone);box-shadow:0 0 10px rgba(237,233,223,.4)}
  .hz-av .mav:hover{transform:scale(1.1)}
  .hz-av .mav img,.hz-av .mav .ini{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;border:2px solid var(--ink);box-sizing:border-box;background:var(--s)}
  .hz-av .mav .ini{display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:var(--bone)}
  /* Events happening now or within 3 hours get an ORANGE ring + a soft pulse, so
     "where can I still go tonight" reads at a glance. */
  .hz-av .mav.live{background:var(--acc);box-shadow:0 0 0 3px rgba(225,90,64,.35),0 0 14px rgba(225,90,64,.55);animation:mlive 1.6s ease-in-out infinite}
  @keyframes mlive{0%,100%{box-shadow:0 0 0 3px rgba(225,90,64,.35),0 0 14px rgba(225,90,64,.5)}50%{box-shadow:0 0 0 5px rgba(225,90,64,.2),0 0 20px rgba(225,90,64,.75)}}
</style></head><body class="deskrail">
  ${deskRail({ guest: d.guest, fanId: d.fanId, active: 'explore', lang })}
  ${backButton('/')}
  <div class="mapwrap">
    <div class="mtitle">${esc(t(lang, 'map_sub'))}</div>
    <div id="map" role="img" aria-label="${esc(t(lang, 'event_map'))}"></div>
  </div>
  ${bottomNav({ active: 'explore', guest: d.guest, fanId: d.fanId, createHref: d.createHref, lang })}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <script>
  (function(){
    if(!window.L){return}
    // City → coordinates, keyed in BOTH languages so an event tagged "München"
    // or "Köln" plots exactly like "Munich"/"Cologne". Keys are lower-cased on
    // lookup, so casing/​locale of the stored region doesn't matter.
    var C={
      berlin:[52.52,13.405], hamburg:[53.55,9.99],
      cologne:[50.94,6.96], 'köln':[50.94,6.96], koeln:[50.94,6.96],
      munich:[48.14,11.58], 'münchen':[48.14,11.58], muenchen:[48.14,11.58], bavaria:[48.14,11.58], bayern:[48.14,11.58],
      frankfurt:[50.11,8.68], stuttgart:[48.78,9.18], dusseldorf:[51.23,6.78], 'düsseldorf':[51.23,6.78],
      leipzig:[51.34,12.37], dresden:[51.05,13.74], bremen:[53.08,8.80], hanover:[52.37,9.74], hannover:[52.37,9.74],
      nuremberg:[49.45,11.08], 'nürnberg':[49.45,11.08], nuernberg:[49.45,11.08],
      vienna:[48.21,16.37], wien:[48.21,16.37], zurich:[47.37,8.54], 'zürich':[47.37,8.54], zuerich:[47.37,8.54]
    };
    var pts=${pointsJson};
    if(!document.getElementById('map')){return}
    var map=L.map('map',{scrollWheelZoom:true}).setView([51.1,10.2],5);
    function url(){var dark=document.documentElement.getAttribute('data-theme')!=='light';return 'https://{s}.basemaps.cartocdn.com/'+(dark?'dark_all':'light_all')+'/{z}/{x}/{y}{r}.png'}
    var opt={subdomains:'abcd',maxZoom:19,attribution:'&copy; OpenStreetMap &copy; CARTO'};
    var layer=L.tileLayer(url(),opt).addTo(map);
    window.addEventListener('hz-theme',function(){map.removeLayer(layer);layer=L.tileLayer(url(),opt).addTo(map)});
    function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function avatarIcon(p){
      var inner=p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':'<span class="ini">'+esc((p.name||'?').trim().charAt(0).toUpperCase())+'</span>';
      return L.divIcon({className:'hz-av',html:'<span class="mav'+(p.live?' live':'')+'">'+inner+'</span>',iconSize:[50,50],iconAnchor:[25,25]});
    }
    // Live events on top of the pile, so an orange ring is never hidden behind a
    // regular pin at the same venue.
    pts.sort(function(a,b){return (a.live?1:0)-(b.live?1:0)});
    pts.forEach(function(p){
      var c=C[String(p.region||'').trim().toLowerCase()];if(!c){return}
      var j=function(){return (Math.random()-0.5)*0.06};
      var mk=L.marker([c[0]+j(),c[1]+j()],{icon:avatarIcon(p),title:p.name,riseOnHover:true,keyboard:true}).addTo(map);
      mk.on('click',function(){window.location.href=p.href});
    });
  })();
  </script>
${SHARE_SCRIPT}
</body></html>`;
}

// --- athlete profile (the idol surface — Weverse-style, sports-specific) --
// Public page. A guest can browse, but any action except Shop routes to sign-up.
export function renderAthletePage(d: {
  guest: boolean; fanId: string | null; profile: AthleteProfile;
  upcoming: UpcomingView | null;
  attendance: { mode: string } | null;
  affiliations: { kind: string; label: string; href: string | null }[];
  events?: { id: string; title: string; date?: string; featured?: boolean; hostName?: string; live?: boolean; past?: boolean; startsAt?: string | null; mine?: boolean }[];
  connections?: { kind: string; id: string; name: string; logoUrl: string | null; role?: string }[];
  scheduleHref?: string;
  tiers?: { level: string; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }[];
  membership?: { memberNo: number; tierLevel: string } | null;
  superfan?: boolean;
  loyalty?: { score: number; threshold: number } | null;
  memberCount?: number;
  canEdit?: boolean;
  activation?: string;
  sections?: { key: string; on: boolean }[];
  ogTags?: string;
  previewAsFan?: boolean;
  media?: { id: string; kind: string; url: string; caption: string | null }[];
  sponsors?: { id: string; name: string; url: string | null; logoUrl: string | null }[];
  banner?: { pos: { x: number; y: number; zoom: number } | null; videoUrl: string | null };
  goalsHtml?: string;
  sportsLabel?: string;
  createHref?: string;
  shop?: { id: string; kind: string; title: string; subtitle: string | null; url: string | null; priceCents: number | null }[];
  themedBanner?: string;
  isFollowing?: boolean;   // viewer already follows → show Following/Unfollow, not Follow
}): string {
  const isMember = !!d.membership;
  const viewerTier = d.membership?.tierLevel ?? null;
  const tRank = (l?: string | null) => l === 'clubhouse' ? 2 : (l === 'supporter' || l === 'members') ? 1 : 0;
  // Fan tiers retired — every post is open (no members-only locking).
  const canSee = (_vis?: string) => true;
  const money = (c: number, cur = 'EUR') => `${cur === 'EUR' ? '€' : cur + ' '}${(c / 100).toFixed(2).replace(/\.00$/, '')}`;
  const p = d.profile;
  const first = (p.name.split(' ')[0] || p.name).replace(/[^A-Za-z]/g, '') || p.name;
  const nickname = (p.name.match(/[‘'"]([^’'"]+)[’'"]/) ?? [])[1] ?? '';
  const gate = (real: string) => (d.guest ? '/signup' : real);
  const ext = (href: string) => (d.guest ? `href="/signup"` : `href="${esc(href)}" target="_blank" rel="noopener"`);

  const socials = Object.entries(p.links ?? {}).filter(([, v]) => v)
    .map(([k, v]) => `<a class="ic" aria-label="${esc(k)}" ${ext(v)}>${socialIcon(k)}</a>`).join('');

  const av = p.avatarUrl ? `<img src="${esc(p.avatarUrl)}">` : avatarSvg(p.name);
  const bpos = d.banner?.pos;
  const bstyle = bpos ? ` style="object-position:${bpos.x}% ${bpos.y}%;transform:scale(${bpos.zoom})"` : '';
  // No empty banners ever: an uploaded photo/video wins; otherwise the themed,
  // auto-generated banner (§4a) carries the wow — individual per athlete.
  const coverInner = d.banner?.videoUrl
    ? `<video class="bgvid" autoplay muted loop playsinline ${p.bannerUrl ? `poster="${esc(p.bannerUrl)}"` : ''}${bstyle}><source src="${esc(d.banner.videoUrl)}"></video>`
    : p.bannerUrl ? `<img src="${esc(p.bannerUrl)}" alt=""${bstyle}>` : (d.themedBanner ? `<img src="${esc(d.themedBanner)}" alt="">` : `<div class="ph"><span class="kick">${esc(nickname || p.name)}</span></div>`);
  const cover = `<div class="cover">${coverInner}</div>`;

  const profhead = `<section class="profhead">
      <div class="avatar">${av}</div>
      <div class="pid"><h1>${esc(p.name)}</h1><div class="hsub">${p.handle ? '@' + esc(p.handle) : ''}${nickname ? ` · “${esc(nickname)}”` : ''}${d.sportsLabel ? ` · ${esc(d.sportsLabel)}` : ''}${d.superfan ? ' · <span class="sfan">✦ Superfan</span>' : ''}</div></div>
      <div class="phactions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${d.canEdit ? '' : followControl({ guest: d.guest, following: !!d.isFollowing, targetType: 'athlete', targetId: p.athleteId, fanId: d.fanId, cls: 'btn join' })}${shareButton({ title: p.name, cls: 'btn ghost join' })}</div>
    </section>
    ${socials ? `<div class="icons">${socials}</div>` : ''}
    ${p.tagline ? `<p class="tagline">${esc(p.tagline)}</p>` : ''}`;

  // ONE PAGE, IN THE ENTITY'S OWN ORDER. Tabs are anchors into the same scroll —
  // not separate pages.
  //
  // The default used to list drops/media/merch. SECTIONS has carried exactly
  // three keys — nextup, events, connected — since the pivot, so those extras
  // were filtered out one line later and the list was pure decoration: it looked
  // like the product still had a media tab and a shop. It doesn't.
  const order = d.sections ?? [{ key: 'nextup', on: true }, { key: 'events', on: true }, { key: 'connected', on: true }];
  // SECTIONS is the single gate. Anything not in it — squad, fixtures, shop,
  // media, sponsors, drops, Win/Loss/Draw, recent results — is legacy Superfan
  // and does not render. Add a section by adding it THERE, not by widening this.
  const enabled = order.filter(s => s.on && SECTIONS[s.key]);
  const tabs = `<nav class="tabs">${enabled.map((s, i) => `<a class="tab${i === 0 ? ' on' : ''}" href="#sec-${s.key}">${esc(SECTIONS[s.key].short)}</a>`).join('')}</nav>`;

  // Follow lives next to the profile only (no duplicate "Join crowd" banner).
  const membership = '';

  const stats = `<div class="stats">
      <div class="stat"><div class="num">${p.record.wins}</div><div class="slab">Won</div></div>
      <div class="stat"><div class="num">${p.record.losses}</div><div class="slab">Lost</div></div>
      <div class="stat"><div class="num">${p.record.draws}</div><div class="slab">Drawn</div></div>
    </div><div class="reccap">${p.record.wins}–${p.record.losses}–${p.record.draws} · Wins–Losses–Draws</div>`;

  const joinFields = `<input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="owner_kind" value="athlete"><input type="hidden" name="owner_id" value="${p.athleteId}">`;
  const followCard = `<div class="tcard"><div class="th2">Follow <span class="tlvl">Free</span></div>
      <ul class="perks"><li>Public posts, results &amp; matchdays</li><li>Counts toward Superfan status</li></ul>
      ${followControl({ guest: d.guest, following: !!d.isFollowing, targetType: 'athlete', targetId: p.athleteId, fanId: d.fanId, cls: 'btn' })}</div>`;
  const tcard = (t: { level: string; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }) => {
    const annual = t.priceAnnualCents ?? t.priceCents * 10;
    const here = isMember && viewerTier === t.level;
    const label = t.level === 'clubhouse' ? 'Clubhouse · Superfan' : 'Supporter';
    const saved = Math.max(0, Math.round((t.priceCents * 12 - annual) / Math.max(1, t.priceCents)));
    const cta = d.guest
      ? `<a class="btn" href="/signup">Join · from ${money(t.priceCents, t.currency)}/mo</a>`
      : here ? `<div class="dt" style="padding:8px 0">✓ You’re in</div>`
        : `<form method="post" action="/join">${joinFields}<input type="hidden" name="level" value="${t.level}"><div class="tcol"><button class="btn" name="billing" value="annual">${money(annual, t.currency)}/yr</button>${saved > 0 ? `<div class="annnote">Best value · ${saved} month${saved === 1 ? '' : 's'} free</div>` : ''}<button class="btn ghost" name="billing" value="monthly">or ${money(t.priceCents, t.currency)}/mo</button></div></form>`;
    return `<div class="tcard${t.level === 'clubhouse' ? ' prem' : ''}"><div class="th2">${esc(t.name)} <span class="tlvl">${label}</span></div>
      <ul class="perks">${t.perks.map(pk => `<li>${esc(pk)}</li>`).join('')}</ul>${cta}</div>`;
  };
  const badge = (isMember || d.superfan)
    ? `<div class="membadge">✦ ${d.superfan ? 'Superfan' : (viewerTier === 'clubhouse' ? 'Clubhouse' : 'Supporter')}${isMember ? ` · member #${d.membership!.memberNo}` : ' · earned through loyalty'}${d.memberCount ? ` · ${d.memberCount} members` : ''}</div>`
    : '';
  const loyaltyBar = (!d.guest && !d.superfan && d.loyalty)
    ? `<div class="loy"><div class="dt">${d.loyalty.score} / ${d.loyalty.threshold} to Superfan — attend, predict &amp; share to climb</div><div class="loybar"><span style="width:${Math.min(100, Math.round((d.loyalty.score / d.loyalty.threshold) * 100))}%"></span></div></div>`
    : '';
  const upgradeNudge = (isMember && viewerTier === 'supporter')
    ? `<div class="upsell"><span>You’re a Supporter. <strong>Go Clubhouse</strong> for the full inside access — and instant Superfan status.</span><a class="btn sm" href="#join">Upgrade</a></div>`
    : '';
  const tierCard = `<section id="join" class="card"><div class="ch"><h2>Membership</h2></div>${badge}${upgradeNudge}
      <div class="tierrow">${followCard}${(d.tiers ?? []).map(tcard).join('')}</div>${loyaltyBar}</section>`;

  // Every post wears its access level so the feed never reads as a free commodity:
  // Open (everyone) · ★ Supporters · ✦ Clubhouse. Exclusive posts a viewer can't
  // see are shown as a blurred preview behind a lock — obvious, but understated.
  const visMeta = (vis: string) => vis === 'clubhouse'
    ? { mark: '✦', label: 'Clubhouse', req: 'Clubhouse' }
    : (vis === 'supporter' || vis === 'members') ? { mark: '★', label: 'Supporters', req: 'Supporter' }
      : { mark: '', label: 'Open', req: 'Supporter' };
  const postCard = (po: { body: string; date?: string; visibility?: string }) => {
    const body = `<p style="white-space:pre-wrap">${linkify(po.body)}</p>`;
    return `<article class="post"><div class="pa"><span class="pav">${av}</span><div class="pmeta"><strong>${esc(p.name)}</strong><div class="dt">${esc(po.date ?? '')}</div></div></div>${body}</article>`;
  };
  const postsBlock = p.posts.length
    ? `<section class="card"><div class="ch"><h2>From ${esc(first)}</h2></div>${p.posts.map(postCard).join('')}</section>`
    : '';

  // Media — native-first grid (photos + video), with optional social embeds.
  const mTile = (mi: { kind: string; url: string; caption: string | null }) => {
    const cap = mi.caption ? `<span class="mcap">${esc(mi.caption)}</span>` : '';
    if (mi.kind === 'video') return `<div class="mtile filled"><video muted loop playsinline preload="metadata"><source src="${esc(mi.url)}"></video>${cap}</div>`;
    if (mi.kind === 'embed') return `<a class="mtile filled embed" ${ext(mi.url)}><span class="memb">↗ ${esc((mi.caption || mi.url).replace(/^https?:\/\//, '').slice(0, 28))}</span></a>`;
    return `<div class="mtile filled"><img src="${esc(mi.url)}" alt="${esc(mi.caption || '')}">${cap}</div>`;
  };
  const media = d.media ?? [];
  const mediaBlock = media.length
    ? `<section class="card"><div class="ch"><h2>Media</h2></div><div class="mediagrid">${media.map(mTile).join('')}</div></section>`
    : (d.canEdit
      ? `<section class="card"><div class="ch"><h2>Media</h2></div><div class="mediagrid">${Array.from({ length: 6 }, () => '<div class="mtile"></div>').join('')}</div><p class="mut" style="font-size:12.5px;margin-top:10px">Add photos, video or social embeds from <a href="/athlete/${p.athleteId}/customize" style="border-bottom:1px solid var(--b)">Edit page</a>.</p></section>`
      : '');

  // Sponsors — creator-chosen partners (off by default; opt in).
  const sponsors = d.sponsors ?? [];
  const sponsorsBlock = sponsors.length
    ? `<section class="card"><div class="ch"><h2>Sponsors</h2></div><div class="sponsorrow">${sponsors.map(s => {
        const inner = s.logoUrl ? `<img src="${esc(s.logoUrl)}" alt="${esc(s.name)}">` : `<span>${esc(s.name)}</span>`;
        return s.url ? `<a class="sponsor" ${ext(s.url)} title="${esc(s.name)}">${inner}</a>` : `<span class="sponsor" title="${esc(s.name)}">${inner}</span>`;
      }).join('')}</div><p class="mut" style="font-size:11px;margin-top:8px">Backed by partners ${esc(first)} chose to credit.</p></section>`
    : '';

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
        ? `<a class="btn ghost" href="/signup">Join for free</a>`
        : `<form method="post" action="/attend"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="event_id" value="${u.eventId}"><input type="hidden" name="mode" value="going"><button class="btn ghost">Join for free</button></form>`);
      if (u.ticketUrl) b.push(`<a class="btn ghost" ${ext(u.ticketUrl)}>Buy tickets</a>`);
      if (u.streamUrl) b.push(`<a class="btn ghost" ${ext(u.streamUrl)}>Stream live</a>`);
      cta = `<div class="notyet">You're not attending yet.</div><div class="opts">${b.join('')}</div>`;
    }
    attendBlock = `<section class="card"><h2>Next up</h2>
      <div class="evt"><strong>${esc(p.name)} vs ${esc(u.opponentName ?? 'TBA')}</strong><span class="dt">${esc(u.date ?? '')}</span></div>${cta}
      <div class="row"><a class="more" style="display:inline;padding:6px 12px" href="/share/fight/${u.eventId}">Share the matchup card ↗</a></div></section>`;
  }

  // Events split into Live (top) / Upcoming / Past. Associated (participated-in)
  // events are labelled — the athlete isn't the organizer, just competing.
  // "You're in" is the most useful thing this list can tell YOU. Scanning an
  // athlete's events, the first question is "which of these am I already going
  // to?" — without the mark you have to open each one to find out.
  const evRow = (e: { id: string; title: string; date?: string; featured?: boolean; hostName?: string; live?: boolean; mine?: boolean }) =>
    `<li style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--b)"><span class="tag ${e.live ? 'win' : 'mutd'}">${e.live ? 'LIVE' : e.featured ? 'PLAYING' : 'EVENT'}</span><a class="hl" style="flex:1" href="/e/${e.id}">${esc(e.title)}${e.featured ? ` · <span class="dt">${esc(e.hostName ?? '')}</span>` : ''}</a>${e.mine ? '<span class="tag ok" title="You have a spot at this event">✓ You\'re in</span>' : ''}<span class="dt">${esc(e.date ?? '')}</span></li>`;
  const evAll = d.events ?? [];
  const evLive = evAll.filter(e => e.live);
  const evUpcoming = evAll.filter(e => !e.live && !e.past);
  const evPast = evAll.filter(e => e.past);
  const evGroup = (label: string, list: typeof evAll, cls = '') => list.length ? `<div class="evgrp ${cls}"><div class="evgh">${label}</div><ul style="list-style:none">${list.map(evRow).join('')}</ul></div>` : '';
  const eventsBlock = (evAll.length || (d.scheduleHref && d.canEdit))
    ? `<section class="card"><h2>Events</h2>
        <style>.evgh{font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:800;margin:6px 0 2px}.evgrp.live .evgh{color:#e5484d}</style>
        ${evGroup('● Live now', evLive, 'live')}
        ${evGroup('Upcoming', evUpcoming)}
        ${evGroup('Past', evPast)}
        ${!evAll.length ? '<p class="mut" style="font-size:13px">No events yet.</p>' : ''}
        ${d.scheduleHref && d.canEdit ? `<div class="row"><a class="more" style="display:inline;padding:7px 12px" href="${d.scheduleHref}">＋ Schedule an event</a></div>` : ''}</section>`
    : '';

  const resultsBlock = p.recentResults.length
    ? `<section class="card"><h2>Recent results</h2><ul style="list-style:none">${p.recentResults.map(r => `<li style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--b)"><span class="tag mutd">●</span><span style="flex:1">${esc(r.headline)}</span>${r.eventId ? `<a class="tag mutd" href="/share/result/${r.eventId}">share</a>` : ''}<span class="dt">${esc(r.date ?? '')}</span></li>`).join('')}</ul></section>`
    : '';
  const recordBlock = `<section class="card"><h2>Win / Loss / Draw</h2>${stats}</section>`;

  // Shop — multiple item types: merch, gift-a-membership, discount-code access, link.
  const SHOP_KIND_LABEL: Record<string, string> = { merch: 'Merch', gift_membership: 'Gift a membership', discount: 'Discount', link: 'Link' };
  const SHOP_CTA: Record<string, string> = { merch: 'Shop', gift_membership: 'Gift', discount: 'Get code', link: 'Open' };
  const shopItems = d.shop ?? [];
  const shopCard = (s: { kind: string; title: string; subtitle: string | null; url: string | null; priceCents: number | null }) =>
    `<div class="mItem"><div class="mImg"></div><div class="mName"><span class="tag mutd" style="font-size:9px">${esc(SHOP_KIND_LABEL[s.kind] ?? 'Item')}</span><div style="margin-top:4px;font-weight:700">${esc(s.title)}</div>${s.subtitle ? `<div class="mut" style="font-size:12px">${esc(s.subtitle)}</div>` : ''}${s.priceCents != null ? `<div class="mut" style="font-size:12px">${money(s.priceCents)}</div>` : ''}${s.url ? `<a class="btn ghost sm" style="margin-top:6px" ${ext(s.url)}>${esc(SHOP_CTA[s.kind] ?? 'View')}</a>` : ''}</div></div>`;
  const merch = shopItems.length
    ? `<section class="card"><h2>Shop</h2><div class="shelf">${shopItems.map(shopCard).join('')}</div></section>`
    : (d.canEdit ? `<section class="card"><h2>Shop</h2><p class="mut" style="font-size:13px">Add merch, gift-a-membership, discount codes or links from <a href="/athlete/${p.athleteId}/customize" style="border-bottom:1px solid var(--b)">Edit page</a>.</p></section>` : '');

  // Clubs & Leagues the athlete is part of — cool logo cards. These come from the
  // entity connection graph (active links only). Owner can manage connections.
  const connCard = (c: { kind: string; id: string; name: string; logoUrl: string | null; role?: string }) => {
    const href = c.kind === 'club' ? `/club/${c.id}` : c.kind === 'association' ? `/association/${c.id}` : null;
    const inner = `<span class="connlogo">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : avatarSvg(c.name)}</span><span class="connmeta"><span class="connname">${esc(c.name)}</span><span class="connrole">${esc(c.role || c.kind)}</span></span>`;
    return href ? `<a class="conncard" href="${href}">${inner}</a>` : `<div class="conncard">${inner}</div>`;
  };
  const conns = d.connections ?? [];
  const connectionsBlock = conns.length
    ? `<section class="card"><h2>Clubs &amp; Leagues</h2><style>.conngrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-top:8px}.conncard{display:flex;align-items:center;gap:11px;border:1px solid var(--b);border-radius:14px;padding:11px 12px;background:var(--s);transition:border-color .15s}.conncard:hover{border-color:var(--bone)}.connlogo{width:40px;height:40px;border-radius:10px;overflow:hidden;flex:0 0 auto;border:1px solid var(--b)}.connlogo img,.connlogo svg{width:100%;height:100%;object-fit:cover;display:block}.connname{font-weight:700;font-size:14px;display:block}.connrole{font-size:11px;color:var(--mut);text-transform:capitalize}</style><div class="conngrid">${conns.map(connCard).join('')}</div>${d.canEdit ? `<div class="row"><a class="more" style="display:inline;padding:7px 12px" href="/athlete/${p.athleteId}/connections">Manage connections</a></div>` : ''}</section>`
    : (d.canEdit ? `<section class="card"><h2>Clubs &amp; Leagues</h2><p class="mut" style="font-size:13px">Request to join the clubs, leagues and series you compete in — they admit you and it shows here. <a href="/athlete/${p.athleteId}/connections" style="border-bottom:1px solid var(--b)">Manage connections →</a></p></section>` : '');

  // The whole page, in three keys. Squad, fixtures, shop, media, sponsors, drops
  // and the W/L/D record are all Superfan-era furniture — an entity page here is
  // its next event, its events, and who it's connected to. Nothing else.
  //
  // Those blocks are still BUILT above (recordBlock, postsBlock, mediaBlock,
  // resultsBlock, merch, sponsorsBlock) and simply never mapped. Left standing on
  // purpose rather than ripped out in the same pass: they're dead HTML, not dead
  // data, and deleting them is a separate change with its own diff to read.
  const sectionMap: Record<string, string> = { nextup: attendBlock, events: eventsBlock, connected: connectionsBlock };
  const sectionsHtml = enabled.map(s => `<div id="sec-${s.key}" class="secanchor">${sectionMap[s.key] ?? ''}</div>`).join('\n');
  // Create lives in the nav (the "+"); the page keeps only page-management actions.
  const customizeBtn = d.canEdit ? `<div class="row" style="margin:6px 0 0"><a class="btn ghost sm" href="/athlete/${p.athleteId}/customize">Edit page</a><a class="btn ghost sm" href="/athlete/${p.athleteId}?as=fan">View as fan</a><a class="btn ghost sm" href="/athlete/${p.athleteId}/insights">Insights</a></div>` : '';
  // Build Order #3: collective-goal progress bars — visible to ALL fans (the recruitment driver).
  const goalsBlock = d.goalsHtml ? `<section class="card"><style>.gbar{height:12px;border-radius:999px;background:var(--s);border:1px solid var(--b);overflow:hidden;margin:8px 0}.gbar span{display:block;height:100%;background:var(--bone)}.gbar.hit span{background:#3fb950}.goalcard{border:1px solid var(--b);border-radius:14px;padding:14px;margin:10px 0;background:var(--s)}.h2h{display:flex;align-items:center;gap:10px;margin:6px 0}.h2h .side{flex:1;text-align:center}.h2h .n{font-size:24px;font-weight:800}</style><div class="ch"><h2>Goals</h2></div>${d.goalsHtml}</section>` : '';

  const gatebar = d.guest
    ? `<div class="gatebar"><span><strong>Only members can see the content in full.</strong> You're browsing as a guest.</span><a class="btn" href="/signup">Log in to continue ›</a></div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(p.name)} — Horda</title>${d.ogTags ?? ''}${THEME_BOOT}
<style>
  ${THEME_VARS}
  ${THM_CSS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.5;padding-bottom:96px}
  a{color:inherit;text-decoration:none}
  html{scroll-behavior:smooth}
  .top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:11px 18px;border-bottom:1px solid var(--b);position:sticky;top:0;background:var(--scrim);backdrop-filter:blur(10px);z-index:20}
  .top .tl{justify-self:start;display:flex;align-items:center}.top .tr{justify-self:end;display:flex;align-items:center;gap:10px}
  .mark{display:flex;align-items:center;justify-content:center;justify-self:center;color:var(--bone)}.mark svg{display:block}
  .secanchor{scroll-margin-top:108px}
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
  /* exclusivity signals — subtle but unmistakable */
  .feednote{color:var(--mut);font-size:12px;margin:-2px 0 12px}.feednote .hl{color:var(--bone);font-weight:600}
  .vchip{font-size:10px;font-weight:700;letter-spacing:.4px;border-radius:999px;padding:2px 8px;border:1px solid var(--b);color:var(--mut);white-space:nowrap;vertical-align:middle}
  .vchip.excl{color:var(--bone);border-color:rgba(237,233,223,.42)}
  .vchip.got{background:var(--bone);color:var(--ink);border-color:var(--bone)}
  .lockwrap{position:relative;border:1px solid var(--b);border-radius:12px;overflow:hidden;min-height:78px;background:rgba(237,233,223,.03);margin-top:2px}
  .blur{filter:blur(6px);opacity:.5;margin:0;padding:14px;color:var(--mut);font-size:14px;user-select:none;-webkit-mask-image:linear-gradient(180deg,#000,transparent);mask-image:linear-gradient(180deg,#000,transparent)}
  .lockover{position:absolute;inset:0;display:flex;flex-direction:column;gap:9px;align-items:center;justify-content:center;text-align:center}
  .lockpill{display:inline-flex;align-items:center;gap:5px;background:var(--bone);color:var(--ink);font-weight:800;font-size:11px;letter-spacing:.4px;border-radius:999px;padding:4px 12px}
  .btn.sm{padding:6px 14px;font-size:12.5px}
  #join{display:none}#join:target{display:block}
  .tierrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:6px}
  .tcard{border:1px solid var(--b);border-radius:14px;padding:14px}.tcard.prem{border-color:var(--bone)}
  .th2{font-weight:800;font-size:15px;margin-bottom:8px}.tlvl{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);border:1px solid var(--b);border-radius:999px;padding:2px 8px;margin-left:4px}
  .trow{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.trow .btn{flex:1;text-align:center}
  .tcol{display:flex;flex-direction:column;gap:6px;margin-top:4px}.tcol .btn{text-align:center}
  .annnote{font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--bone);text-align:center;opacity:.85}
  .upsell{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid var(--b);border-radius:12px;padding:10px 13px;margin:10px 0 4px;font-size:13px;color:var(--mut)}.upsell strong{color:var(--bone)}
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
  .mtile{aspect-ratio:1;border-radius:10px;background:linear-gradient(135deg,rgba(237,233,223,.15),rgba(237,233,223,.03));border:1px solid var(--b);position:relative;overflow:hidden}
  .mtile.filled img,.mtile.filled video{width:100%;height:100%;object-fit:cover;display:block}
  .mtile .mcap{position:absolute;left:0;right:0;bottom:0;font-size:10px;padding:10px 6px 4px;background:linear-gradient(to top,rgba(11,11,12,.8),transparent);color:#fff}
  .mtile.embed{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--mut);font-size:11px;padding:6px}
  .bgvid{width:100%;height:100%;object-fit:cover;display:block}
  .sponsorrow{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
  .sponsor{display:inline-flex;align-items:center;justify-content:center;min-width:84px;height:48px;padding:6px 14px;border:1px solid var(--b);border-radius:10px;background:var(--s);color:var(--bone);font-weight:700;font-size:13px}
  .sponsor img{max-height:30px;max-width:120px;object-fit:contain;display:block;filter:grayscale(1);opacity:.9}
  .nlform{display:flex;gap:8px;flex-wrap:wrap}.nlin{flex:1;min-width:180px;background:var(--s);border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:10px 14px;font:inherit}
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
</style></head><body class="deskrail">
  ${deskRail({ guest: d.guest, fanId: d.fanId, active: 'explore' })}
  ${backButton()}
  ${d.previewAsFan ? `<div style="background:var(--bone);color:var(--ink);text-align:center;font-size:13px;font-weight:700;padding:8px 14px">👁 Previewing as a fan — <a href="/athlete/${p.athleteId}" style="text-decoration:underline">exit preview</a></div>` : ''}
  ${cover}
  <div class="wrap">
    ${profhead}
    ${tabs}
    ${d.activation ?? ''}
    ${customizeBtn}
    ${membership}
    ${sectionsHtml}
  </div>
  ${gatebar}
  <div class="prov">Athlete-owned profile · persons self-create on Horda · coverage only, no fan-to-fan venue. Social &amp; affiliation links are athlete-chosen and point out.</div>
  ${d.canEdit ? '<div style="height:76px"></div>' + actionBar({ title: 'Your Crowd', sub: 'Create an event or booking', cta: `<a class="btn" href="/athlete/${p.athleteId}/compose">＋ Create</a>` }) : ''}
  ${bottomNav({ guest: d.guest, fanId: d.fanId, createHref: d.canEdit ? `/athlete/${p.athleteId}/compose` : d.createHref })}
  ${d.canEdit ? UPLOAD_SCRIPT : ''}
${SHARE_SCRIPT}
</body></html>`;
}

// Sport picker — used at creation (preview) and in edit. Stored value is a key.
const SPORTS: [string, string][] = [
  ['football', 'Football'], ['futsal', 'Futsal'], ['basketball', 'Basketball'], ['volleyball', 'Volleyball'], ['beach_volleyball', 'Beach volleyball'], ['handball', 'Handball'], ['rugby', 'Rugby'], ['american_football', 'American football'], ['baseball', 'Baseball'], ['cricket', 'Cricket'], ['field_hockey', 'Field hockey'], ['ice_hockey', 'Ice hockey'], ['water_polo', 'Water polo'], ['lacrosse', 'Lacrosse'],
  ['boxing', 'Boxing'], ['mma', 'MMA'], ['kickboxing', 'Kickboxing'], ['muay_thai', 'Muay Thai'], ['wrestling', 'Wrestling'], ['judo', 'Judo'], ['bjj', 'Brazilian Jiu-Jitsu'], ['karate', 'Karate'], ['taekwondo', 'Taekwondo'], ['fencing', 'Fencing'],
  ['tennis', 'Tennis'], ['table_tennis', 'Table tennis'], ['badminton', 'Badminton'], ['squash', 'Squash'], ['padel', 'Padel'], ['golf', 'Golf'],
  ['running', 'Running'], ['trail_running', 'Trail running'], ['marathon', 'Marathon'], ['triathlon', 'Triathlon'], ['athletics', 'Athletics'], ['cross_country', 'Cross country'],
  ['cycling', 'Cycling'], ['road_cycling', 'Road cycling'], ['mountain_biking', 'Mountain biking'], ['bmx', 'BMX'], ['track_cycling', 'Track cycling'],
  ['swimming', 'Swimming'], ['open_water', 'Open-water swimming'], ['rowing', 'Rowing'], ['sailing', 'Sailing'], ['canoeing', 'Canoe / kayak'], ['surfing', 'Surfing'], ['diving', 'Diving'],
  ['weightlifting', 'Weightlifting'], ['powerlifting', 'Powerlifting'], ['weight_training', 'Weight training'], ['crossfit', 'CrossFit'], ['bodybuilding', 'Bodybuilding'], ['strongman', 'Strongman'], ['calisthenics', 'Calisthenics'],
  ['gymnastics', 'Gymnastics'], ['climbing', 'Climbing'], ['bouldering', 'Bouldering'], ['skateboarding', 'Skateboarding'], ['parkour', 'Parkour'],
  ['skiing', 'Skiing'], ['snowboarding', 'Snowboarding'], ['cross_country_skiing', 'Cross-country skiing'], ['figure_skating', 'Figure skating'], ['speed_skating', 'Speed skating'], ['biathlon', 'Biathlon'],
  ['motorsport', 'Motorsport'], ['karting', 'Karting'], ['motocross', 'Motocross'], ['rally', 'Rally'],
  ['equestrian', 'Equestrian'], ['archery', 'Archery'], ['shooting', 'Shooting'], ['darts', 'Darts'], ['bowling', 'Bowling'], ['pool', 'Pool / billiards'],
  // Competitive gaming + digitally‑mediated sport (sim racing, virtual cycling
  // like Zwift, virtual rowing). A real and growing category on Horda.
  ['esports', 'Esports'], ['digital_sports', 'Digital sports'], ['sim_racing', 'Sim racing'], ['chess', 'Chess'], ['cheerleading', 'Cheerleading'], ['dance', 'Dance'],
  // Hybrid racing — its own category, not a flavour of running or CrossFit.
  // This is where the mass-participation events actually are right now.
  ['hyrox', 'HYROX'], ['hybrid', 'Hybrid sports'], ['obstacle_racing', 'Obstacle racing (OCR)'], ['spartan', 'Spartan Race'], ['deka', 'DEKA'],
  // The escape hatch: a football club throwing a summer party is still an event
  // worth hosting. Without this the sport picker blocks the create flow.
  ['other', 'Other / not a sport'],
];
export function sportSelect(name: string, current?: string | null, style = ''): string {
  const cur = (current || '').toLowerCase();
  const known = SPORTS.some(([k]) => k === cur);
  const opts = ['<option value="">Choose a sport…</option>',
    ...SPORTS.map(([k, n]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(n)}</option>`),
    (cur && !known) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ''];
  return `<select name="${name}"${style ? ` style="${style}"` : ''}>${opts.join('')}</select>`;
}

// Exported so the search layer (localize.ts / server) can resolve a typed English
// sport name back to its key without re-declaring the canonical list here.
export const SPORT_EN_LABELS: Record<string, string> = Object.fromEntries(SPORTS);
const SPORT_LABELS = SPORT_EN_LABELS;
export function sportLabel(key: string): string { return SPORT_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
export function sportsLabel(keys: string[]): string { return keys.map(sportLabel).join(' · '); }

// Multi-sport picker — search box on top, selected sports pinned + removable,
// the full list below. Selected pinning is pure CSS (flex order on :checked);
// the search just filters the visible options client-side.
export function renderSportPicker(selected: string[]): string {
  const sel = new Set(selected.map(s => s.toLowerCase()));
  const opt = ([k, n]: [string, string]) => `<label class="sopt" data-name="${esc(n.toLowerCase())}"><input type="checkbox" name="sports" value="${k}"${sel.has(k) ? ' checked' : ''}><span>${esc(n)}</span></label>`;
  return `
    <style>
      .sportpick{margin-top:8px}
      .sportsearch{display:block;width:100%;background:var(--s);border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:11px 16px;font:inherit;margin-bottom:10px}
      .sopts{display:flex;flex-wrap:wrap;gap:8px}
      .sopt{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--b);border-radius:999px;padding:7px 13px;font-size:13px;cursor:pointer;user-select:none;background:var(--s);order:1}
      .sopt input{position:absolute;opacity:0;width:0;height:0}
      .sopt span::before{content:"＋";color:var(--mut);margin-right:2px;font-weight:700}
      .sopt:has(input:checked){order:0;border-color:var(--bone);background:var(--bone);color:var(--ink)}
      .sopt:has(input:checked) span::before{content:"✓";color:var(--ink)}
      .sopt.hide{display:none}
      .sportpick .pinrow{order:0;flex-basis:100%;height:0}
    </style>
    <div class="sportpick">
      <input class="sportsearch" type="search" placeholder="Search your sport…" aria-label="Search sports" oninput="(function(q){var t=q.value.toLowerCase();q.closest('.sportpick').querySelectorAll('.sopt').forEach(function(o){o.classList.toggle('hide', t && o.getAttribute('data-name').indexOf(t)<0 && !o.querySelector('input').checked)})})(this)">
      <div class="sopts">${SPORTS.map(opt).join('')}</div>
      <p class="mut" style="font-size:12px;margin-top:8px">Pick one or more. Selected sports pin to the top — tap again to remove. The first one sets your default page layout.</p>
    </div>`;
}

// --- customize page: reorder + show/hide sections (per sport) + suggest a feature
export function renderCustomize(d: { athleteId: string; fanId: string | null; sport: string | null; sports?: string[]; sections: { key: string; on: boolean }[]; links?: Record<string, string>; tiers?: { level: string; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }[]; saved?: boolean; bannerUrl?: string | null; banner?: { pos: { x: number; y: number; zoom: number } | null; videoUrl: string | null }; media?: { id: string; kind: string; url: string; caption: string | null }[]; sponsors?: { id: string; name: string; url: string | null; logoUrl: string | null }[]; shop?: { id: string; kind: string; title: string; subtitle: string | null; url: string | null; priceCents: number | null }[]; themeStudioHtml?: string }): string {
  const ta = 'display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:12px;font:inherit;min-height:90px';
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  const L = d.links ?? {};
  const linkField = (key: string, label: string, ph: string) => `<label class="mut" style="display:block;margin:10px 0 0;font-size:13px">${esc(label)}<input style="${inp}" name="${key}" value="${esc(L[key] ?? '')}" placeholder="${ph}"></label>`;
  // membership tier editor — set what fans pay for (wired to Stripe)
  const eur = (c: number | null | undefined) => (c == null ? '' : (c / 100).toString());
  const tierForm = (level: 'supporter' | 'clubhouse', dName: string, dMo: string, dYr: string, dPerks: string) => {
    const t = (d.tiers ?? []).find(x => x.level === level);
    return `<form method="post" action="/athlete/${esc(d.athleteId)}/tiers" style="border:1px solid var(--b);border-radius:14px;padding:14px;margin:10px 0;background:var(--s)">
      <input type="hidden" name="level" value="${level}">
      <div style="font-weight:800;font-size:15px;text-transform:capitalize">${level}${level === 'clubhouse' ? ' · grants Superfan' : ''}</div>
      <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Name<input style="${inp}" name="name" value="${esc(t?.name ?? dName)}"></label>
      <div style="display:flex;gap:10px"><label class="mut" style="flex:1;font-size:13px">Monthly €<input style="${inp}" name="price" type="text" inputmode="decimal" placeholder="4.99" value="${esc(t ? eur(t.priceCents) : dMo)}"></label><label class="mut" style="flex:1;font-size:13px">Annual €<input style="${inp}" name="annual" type="text" inputmode="decimal" placeholder="49" value="${esc(t ? eur(t.priceAnnualCents) : dYr)}"></label></div>
      <p class="mut" style="font-size:11.5px;margin:6px 0 0">Annual is a yearly price — keep it below 12× the monthly so it's a real discount.</p>
      <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Perks (one per line)<textarea style="${ta};min-height:64px" name="perks">${esc(t ? t.perks.join('\n') : dPerks)}</textarea></label>
      <div class="row" style="margin-top:10px"><button type="submit">Save ${level} tier</button></div>
    </form>`;
  };
  const rows = d.sections.map(s => {
    const m = SECTIONS[s.key]; if (!m) return '';
    return `<div class="secrow" data-key="${esc(s.key)}" draggable="true">
      <span class="grab" aria-hidden="true">⋮⋮</span>
      <div class="secmeta"><div class="secname">${esc(m.label)}</div><div class="secdesc">${esc(m.desc)}</div></div>
      <div class="secact">
        <button type="button" data-move="up" aria-label="Move up" title="Move up">▲</button>
        <button type="button" data-move="down" aria-label="Move down" title="Move down">▼</button>
        <label class="tgl"><input type="checkbox" ${s.on ? 'checked' : ''}><span>Show</span></label>
      </div>
    </div>`;
  }).join('');
  return layout('Customize your page', `
    <style>
      #seclist{margin:14px 0}
      .secrow{display:flex;align-items:center;gap:12px;border:1px solid var(--b);border-radius:14px;padding:12px 14px;margin:8px 0;background:var(--s)}
      .grab{cursor:grab;color:var(--mut);font-size:16px;letter-spacing:-2px;user-select:none}
      .secmeta{flex:1;min-width:0}.secname{font-weight:700;font-size:15px}.secdesc{color:var(--mut);font-size:12.5px}
      .secact{display:flex;align-items:center;gap:6px}
      .secact button{width:30px;height:30px;padding:0;border-radius:8px;border:1px solid var(--b);background:transparent;color:var(--bone);font-size:11px;cursor:pointer}
      .tgl{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--mut);margin-left:4px;cursor:pointer}.tgl input{accent-color:var(--bone)}
      .secrow.drag{opacity:.45}
    </style>
    ${profileTabs({ fanId: d.fanId ?? d.athleteId, active: 'profile', profileHref: `/athlete/${esc(d.athleteId)}/customize` })}
    <h1>Profile</h1>
    <p class="mut" style="margin:-4px 0 6px">Your public page — photo, background, sections and links. This is what fans see.</p>

    <div class="card" style="margin-top:6px">
      <h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Profile details</h2>
      <form method="post" action="/athlete/${esc(d.athleteId)}/branding" onsubmit="return hzPrep(this)" style="margin-bottom:14px;border-bottom:1px solid var(--b);padding-bottom:12px">
        <label class="mut" style="display:block;font-size:13px">Profile photo<input type="file" accept="image/*" data-target="avatar" style="margin-top:6px;color:inherit"></label>
        <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Banner photo<input type="file" accept="image/*" data-target="banner" style="margin-top:6px;color:inherit"></label>
        <input type="hidden" name="avatar"><input type="hidden" name="banner">
        <div class="row" style="margin-top:10px"><button type="submit">Save photos</button></div>
      </form>
      <form method="post" action="/athlete/${esc(d.athleteId)}/profile">
        <div class="mut" style="font-size:13px;margin:4px 0 0">Sports</div>
        ${renderSportPicker(d.sports && d.sports.length ? d.sports : (d.sport ? [d.sport] : []))}
        <div style="margin-top:8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700">Connect socials</div>
        ${linkField('instagram', 'Instagram', 'https://instagram.com/…')}
        ${linkField('x', 'X / Twitter', 'https://x.com/…')}
        ${linkField('tiktok', 'TikTok', 'https://tiktok.com/@…')}
        ${linkField('youtube', 'YouTube', 'https://youtube.com/@…')}
        ${linkField('website', 'Website', 'https://…')}
        <div class="row" style="margin-top:12px"><button type="submit">Save details</button></div>
      </form>
    </div>

    <h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin:26px 0 4px">Sections</h2>
    <p class="mut">Choose what fans see and the order. Drag the ⋮⋮ handle or use ▲▼, and toggle <b>Show</b> to hide a section.</p>
    <form id="secform" method="post" action="/athlete/${esc(d.athleteId)}/layout">
      <input type="hidden" name="order" id="orderfield">
      <div id="seclist">${rows}</div>
      <div class="row"><button type="submit">Save layout</button><a class="btn ghost" href="/athlete/${esc(d.athleteId)}">Cancel</a></div>
    </form>
    ${d.themeStudioHtml ? `<div class="card" style="margin-top:16px">
      <h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Banner &amp; theme — your corner of Horda</h2>
      <p class="mut" style="font-size:12.5px">Your page starts with an auto-generated banner. Pick a look, set your accent, or pull colors from a photo — it also skins your OG share cards.</p>
      ${d.themeStudioHtml}
    </div>` : ''}

    <div class="card" style="margin-top:16px">
      <h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Banner — upload photo/video, reposition &amp; zoom</h2>
      <p class="mut" style="font-size:12.5px">Drag the focus, zoom in, or add a looping video banner. Changes preview live.</p>
      <div style="position:relative;height:150px;border-radius:14px;overflow:hidden;border:1px solid var(--b);margin:10px 0;background:var(--s)">
        ${d.bannerUrl ? `<img id="bnprev" src="${esc(d.bannerUrl)}" style="width:100%;height:100%;object-fit:cover;object-position:${d.banner?.pos?.x ?? 50}% ${d.banner?.pos?.y ?? 50}%;transform:scale(${d.banner?.pos?.zoom ?? 1})">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mut);font-size:12px">Upload a banner photo first (on your page).</div>`}
      </div>
      <form method="post" action="/athlete/${esc(d.athleteId)}/banner">
        <label class="mut" style="display:block;font-size:13px">Horizontal <input id="bnx" type="range" name="x" min="0" max="100" value="${d.banner?.pos?.x ?? 50}" style="width:100%"></label>
        <label class="mut" style="display:block;font-size:13px">Vertical <input id="bny" type="range" name="y" min="0" max="100" value="${d.banner?.pos?.y ?? 50}" style="width:100%"></label>
        <label class="mut" style="display:block;font-size:13px">Zoom <input id="bnz" type="range" name="zoom" min="1" max="3" step="0.05" value="${d.banner?.pos?.zoom ?? 1}" style="width:100%"></label>
        <label class="mut" style="display:block;margin:8px 0 0;font-size:13px">Video banner URL (mp4/webm — optional)<input style="${inp}" name="video_url" value="${esc(d.banner?.videoUrl ?? '')}" placeholder="https://…/clip.mp4"></label>
        <div class="row" style="margin-top:10px"><button type="submit">Save banner</button></div>
      </form>
    </div>

    ${/* Missing something? → Discord.
        Lovable shut down feedback.lovable.dev in Oct 2025 and pushed everything
        into Discord for a reason: a suggestion box is a black hole (you post,
        nothing visibly happens, you never post again), while a room is a
        conversation you can watch. So the Discord CTA leads; the form stays
        underneath as a fallback for people who won't join a chat server, and
        as the only path if Discord is ever unconfigured. */''}
    <div class="card" style="margin-top:26px">
      <h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Missing something?</h2>
      ${hasDiscord() ? `
      <p class="mut" style="font-size:13px;line-height:1.6">Tell us in our Discord — that's where we decide what to build next. Ask for it, and if we ship it your name goes on the <a href="/changelog" style="color:var(--bone);border-bottom:1px solid var(--b)">changelog</a>.</p>
      <div class="row" style="margin-top:12px;gap:9px;flex-wrap:wrap">
        <a class="btn" href="${DISCORD_PATH}" style="display:inline-flex;align-items:center;gap:8px">${discordMark(15)} Ask in Discord ↗</a>
        <a class="btn ghost" href="/changelog">See what we shipped</a>
      </div>
      <details style="margin-top:14px">
        <summary class="mut" style="font-size:12.5px;cursor:pointer">Not on Discord? Send it here instead</summary>
        <form method="post" action="/feature-request" style="margin-top:10px">
          <input type="hidden" name="context" value="athlete-page">
          <input type="hidden" name="sport" value="${esc(d.sport ?? '')}">
          <textarea name="body" required placeholder="e.g. a sponsors section, a highlight reel, a head-to-head vs an opponent…" style="${ta}"></textarea>
          <div class="row"><button type="submit">Send suggestion</button></div>
        </form>
      </details>` : `
      <p class="mut" style="font-size:13px">Suggest a feature for your page — it goes straight into our product roadmap.</p>
      <form method="post" action="/feature-request">
        <input type="hidden" name="context" value="athlete-page">
        <input type="hidden" name="sport" value="${esc(d.sport ?? '')}">
        <textarea name="body" required placeholder="e.g. a sponsors section, a highlight reel, a head-to-head vs an opponent, my training stats…" style="${ta}"></textarea>
        <div class="row"><button type="submit">Send suggestion</button></div>
      </form>`}
    </div>
    <script>(function(){
      var list=document.getElementById('seclist'); if(!list)return;
      list.addEventListener('click',function(e){var b=e.target.closest('[data-move]'); if(!b)return; var r=b.closest('.secrow'); var d=b.getAttribute('data-move'); if(d==='up'&&r.previousElementSibling){list.insertBefore(r,r.previousElementSibling)} if(d==='down'&&r.nextElementSibling){list.insertBefore(r.nextElementSibling,r)}});
      var dragging=null;
      list.addEventListener('dragstart',function(e){var r=e.target.closest('.secrow'); if(r){dragging=r; r.classList.add('drag')}});
      list.addEventListener('dragend',function(){if(dragging){dragging.classList.remove('drag');dragging=null}});
      list.addEventListener('dragover',function(e){e.preventDefault(); if(!dragging)return; var r=e.target.closest('.secrow'); if(!r||r===dragging)return; var b=r.getBoundingClientRect(); var after=(e.clientY-b.top)/b.height>0.5; list.insertBefore(dragging, after?r.nextElementSibling:r)});
      document.getElementById('secform').addEventListener('submit',function(){var rows=Array.prototype.slice.call(list.querySelectorAll('.secrow')); var order=rows.map(function(r){return {key:r.getAttribute('data-key'), on:r.querySelector('input[type=checkbox]').checked}}); document.getElementById('orderfield').value=JSON.stringify(order)});
    })();
    (function(){var p=document.getElementById('bnprev'); if(!p)return; var x=document.getElementById('bnx'),y=document.getElementById('bny'),z=document.getElementById('bnz');
      function up(){p.style.objectPosition=x.value+'% '+y.value+'%'; p.style.transform='scale('+z.value+')';}
      [x,y,z].forEach(function(el){el.addEventListener('input',up)});})();</script>
    ${UPLOAD_SCRIPT}
  `, { back: `/athlete/${d.athleteId}`, nav: { active: 'you', guest: false, fanId: d.fanId } });
}

// --- /pros — the athlete acquisition door (§1b, §10). Sells the back office. --
export function renderPros(d: { guest: boolean; fanId: string | null }): string {
  const cta = d.guest ? '/signup?next=/onboarding/athlete&intent=pro' : '/onboarding/athlete';
  return layout('Horda for athletes', `
    <style>
      .prohero{padding:26px 0 8px}
      .prohero h1{font-size:34px;line-height:1.05;margin:8px 0}
      .beat{border:1px solid var(--b);border-radius:16px;padding:18px;margin:14px 0;background:var(--s)}
      .beat h2{font-size:16px;margin:0 0 6px;border:0;padding:0;text-transform:none;letter-spacing:0}
      .steps{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
      .steps span{font-size:12px;border:1px solid var(--b);border-radius:999px;padding:5px 11px;color:var(--mut)}
    </style>
    <div class="prohero">
      <div class="mut" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:800">Horda for athletes</div>
      <h1>Your fights, your fans, your revenue.</h1>
      <p class="mut" style="max-width:52ch">Post a result in one line — Horda writes the recap, makes the share cards, and updates your page. Run your events, sell tickets, and see exactly who you brought to the door. Built for boxers and footballers who train more than they post.</p>
      <div class="row"><a class="btn" href="${cta}">Create your page →</a><a class="btn ghost" href="${cta}">Publish your first event</a></div>
      <div class="steps"><span>1 · Sign up</span><span>2 · Photo + sport</span><span>3 · Connect socials</span><span>4 · Create your page</span><span>5 · First event</span></div>
      <p class="mut" style="font-size:12px">Under 5 minutes to your first event page. You keep your audience — export anytime.</p>
    </div>
    <div class="beat"><h2>Result in → content out, in 60 seconds</h2><p class="mut" style="font-size:13.5px;margin:0">A win, a time, a scoreline — one line in. Out comes a recap, a matchday/result graphic in your colours, and a subscriber‑first drop. No design skills, no content treadmill.</p></div>
    <div class="beat"><h2>Your events, your crowd — measured</h2><p class="mut" style="font-size:13.5px;margin:0">Run matches, fights and sessions, sell tickets, scan people in, and see exactly who you brought — all from what you already do. Free to run; a flat, fair fee only on paid tickets.</p></div>
    <div class="beat"><h2>One page for everything you host</h2><p class="mut" style="font-size:13.5px;margin:0">Fight nights, open sparring, matchdays — with RSVP, tickets and attendee lists. Your scene, on your radar.</p></div>
    <div class="row"><a class="btn" href="${cta}">Create your page →</a></div>
    <p class="mut" style="font-size:12px;margin-top:12px">Athlete pages are for people 18+. Youth teams live under their club, without player names.</p>
  `, { back: '/', nav: { active: 'home', guest: d.guest, fanId: d.fanId } });
}

// The profile hub's shared top selector — one control on every hub surface, so
// "click your profile" lands somewhere with obvious siblings. The Profile tab only
// shows for creators (accounts that own an athlete page); a plain fan has no public
// profile, so they get Your events / Notifications / Settings only.
export function profileTabs(d: { fanId: string; active: 'events' | 'profile' | 'notifications' | 'settings'; profileHref?: string }): string {
  const tab = (key: string, href: string, label: string) => `<a class="pt${d.active === key ? ' active' : ''}" href="${esc(href)}">${esc(label)}</a>`;
  return `<style>
      .proftop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 14px;flex-wrap:wrap}
      .proftabs{display:flex;gap:8px;flex-wrap:wrap}
      .pt{font-size:13px;font-weight:600;padding:7px 13px;border:1px solid var(--b);border-radius:999px;color:var(--bone);text-decoration:none}
      .pt:hover{border-color:var(--bone)}
      .pt.active{background:var(--acc);border-color:var(--acc);color:#fff}
      .pt.out{color:var(--mut)}
    </style>
    <div class="proftop">
      <div class="proftabs">${tab('events', `/fan/${d.fanId}`, 'Your events')}${d.profileHref ? tab('profile', d.profileHref, 'Profile') : ''}${tab('notifications', '/notifications/settings', 'Notifications')}${tab('settings', '/settings', 'Settings')}</div>
      <a class="pt out" href="/logout">Log out</a>
    </div>`;
}

// --- settings (Instagram-style grouped list) -------------------------------
export function renderSettings(d: { fanId: string; fanName: string; handle?: string | null; email?: string; phone?: string | null; ownsPages?: boolean; editPageHref?: string; insightsHref?: string; createHref?: string; notice?: string; error?: string; plan?: string; plusLive?: boolean; platformFeePct?: number }): string {
  const chev = '<span style="color:var(--mut)">›</span>';
  const row = (label: string, href: string, sub = '') => `<a class="setrow" href="${esc(href)}"><span>${esc(label)}${sub ? `<span class="setsub">${esc(sub)}</span>` : ''}</span>${chev}</a>`;
  const group = (title: string, rows: string) => `<div class="setgroup"><div class="seth">${esc(title)}</div>${rows}</div>`;
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--ink);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px 12px;font:inherit';
  const fieldLabel = 'font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);font-weight:700';
  return layout('Settings', `
    <style>
      .setgroup{margin:18px 0}
      .seth{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);font-weight:800;margin:0 2px 8px}
      .setrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid var(--b);border-bottom:0;background:var(--s);text-decoration:none;color:var(--bone);font-size:15px}
      .setgroup .setrow:first-of-type{border-radius:12px 12px 0 0}
      .setgroup .setrow:last-of-type{border-radius:0 0 12px 12px;border-bottom:1px solid var(--b)}
      .setsub{display:block;font-size:12px;color:var(--mut);margin-top:2px}
      .setrow.danger{color:#e5707a}
      .setcard{border:1px solid var(--b);border-radius:12px;background:var(--s);padding:16px}
      .setcard + .setcard{margin-top:8px}
      .setcard h4{font-size:14px;font-weight:700;margin:0 0 2px}.setcard .fh{font-size:12.5px;color:var(--mut);margin:0 0 10px}
      .flash{border-radius:10px;padding:10px 12px;font-size:13.5px;margin:10px 0}
      .flash.ok{border:1px solid #3fb950;color:#7ee2a0}.flash.err{border:1px solid #e5484d;color:#e5707a}
      .unhint{font-size:12.5px;margin-top:6px;min-height:16px;color:var(--mut)}
      .unhint.ok{color:#7ee2a0;font-weight:600}.unhint.bad{color:#e5707a;font-weight:600}
    </style>
    ${profileTabs({ fanId: d.fanId, active: 'settings', profileHref: d.editPageHref })}
    <h1>Settings</h1>
    ${d.notice ? `<div class="flash ok">${esc(d.notice)}</div>` : ''}
    ${d.error ? `<div class="flash err">${esc(d.error)}</div>` : ''}

    <div class="setgroup"><div class="seth">Account</div>
      <form class="setcard" method="post" action="/account/profile">
        <h4>Name &amp; username</h4>
        <p class="fh">Your username is your @handle — change it any time it isn’t taken.</p>
        <label style="${fieldLabel}">Name<input style="${inp}" name="name" value="${esc(d.fanName)}" maxlength="80"></label>
        <label style="${fieldLabel};display:block;margin-top:10px">Username<span style="position:relative;display:block"><span style="position:absolute;left:12px;top:50%;transform:translateY(-30%);color:var(--mut)">@</span><input style="${inp};padding-left:26px" id="unamefield" name="username" value="${esc(d.handle ?? '')}" placeholder="yourname" autocomplete="off" pattern="[A-Za-z0-9_]{3,20}" title="3–20 letters, numbers or underscores" data-current="${esc((d.handle ?? '').toLowerCase())}"></span></label>
        <div id="unamestatus" class="unhint"></div>
        <div class="row" style="margin-top:12px"><button class="btn" type="submit">Save</button></div>
      </form>
      <script>(function(){
        var i=document.getElementById('unamefield'),s=document.getElementById('unamestatus'),t;
        if(!i||!s)return;
        function set(cls,txt){s.className='unhint '+cls;s.textContent=txt;}
        function check(){
          var v=i.value.trim().replace(/^@/,'').toLowerCase();
          if(v===(i.getAttribute('data-current')||'')){set('','');return;}
          if(!/^[a-z0-9_]{3,20}$/.test(v)){set('bad', v?'Use 3–20 letters, numbers or underscores':'');return;}
          set('','Checking availability…');
          fetch('/account/username-available?u='+encodeURIComponent(v),{headers:{accept:'application/json'}})
            .then(function(r){return r.json()})
            .then(function(d){ if(v!==i.value.trim().replace(/^@/,'').toLowerCase())return;
              if(!d.valid){set('bad','Use 3–20 letters, numbers or underscores');}
              else if(d.available){set('ok','✓ @'+v+' is available');}
              else{set('bad','✗ @'+v+' is taken');} })
            .catch(function(){set('','');});
        }
        i.addEventListener('input',function(){clearTimeout(t);t=setTimeout(check,280);});
      })();</script>
      <div class="setcard">
        <h4>Email</h4>
        <p class="fh">Where your sign-in links and event reminders go.</p>
        <div style="${inp};opacity:.85">${esc(d.email ?? '—')}</div>
      </div>
      <form class="setcard" method="post" action="/account/phone">
        <h4>Phone <span class="fh" style="display:inline">· optional</span></h4>
        <p class="fh">Only used for event reminders. Never a login or shared publicly.</p>
        <input style="${inp}" name="phone" value="${esc(d.phone ?? '')}" placeholder="+49 …" inputmode="tel" maxlength="40">
        <div class="row" style="margin-top:12px"><button class="btn ghost" type="submit">Save phone</button></div>
      </form>
      <div class="setcard">
        <h4>Sign-in &amp; security</h4>
        <p class="fh">Horda is passwordless — you sign in with a magic link by email, so there’s no password to manage. Signed out of a shared device?</p>
        <form method="post" action="/account/signout-all"><button class="btn ghost" type="submit">Log out on all devices</button></form>
      </div>
      <details class="setcard" style="border-color:rgba(229,72,77,.4)">
        <summary style="cursor:pointer;font-weight:700;color:#e5707a">Delete account</summary>
        <p class="fh" style="margin-top:10px">This permanently removes your account, your follows, and your claims. It can’t be undone.${d.ownsPages ? ' <b style="color:var(--bone)">You still manage one or more pages — remove or transfer them first.</b>' : ''}</p>
        ${d.ownsPages ? '' : `<form method="post" action="/account/delete"><label style="${fieldLabel}">Type DELETE to confirm<input style="${inp}" name="confirm" placeholder="DELETE" autocomplete="off"></label><div class="row" style="margin-top:12px"><button class="btn" style="background:#e5484d;border-color:#e5484d;color:#fff" type="submit">Delete my account</button></div></form>`}
      </details>
    </div>

    <div class="setgroup"><div class="seth">Billing</div>
      ${d.plan === 'plus'
        ? `<form class="setcard" method="post" action="/plus/cancel">
             <h4>Horda Plus · <span style="color:var(--acc)">Active</span></h4>
             <p class="fh">0% platform fee on your paid tickets, plus the Plus tools. Cancel any time — you keep Plus until the period ends, then drop back to Free (${d.platformFeePct ?? 5}% fee).</p>
             <button class="btn ghost" type="submit">Cancel Horda Plus</button>
           </form>`
        : `<div class="setcard">
             <h4>Horda Free</h4>
             <p class="fh">You pay a ${d.platformFeePct ?? 5}% platform fee on paid tickets. ${d.plusLive ? 'Upgrade to Horda Plus for 0% fee and scale tools.' : 'Horda Plus (0% fee) is coming soon.'}</p>
             <a class="btn${d.plusLive ? '' : ' ghost'}" href="/about/pricing">${d.plusLive ? 'Upgrade to Horda Plus' : 'See pricing'}</a>
           </div>`}
    </div>

    ${group('Support', row('About Horda', '/about')
      + row('Changelog — what we just shipped', '/changelog', 'And what we’re building next')
      + (hasDiscord() ? row('Join our Discord ↗', discordUrl(), 'Ask for a feature, argue with our decisions') : ''))}
    <div class="setgroup">
      <a class="setrow danger" href="/logout"><span>Log out</span></a>
    </div>
    <div class="prov">Horda — the events home for sports and competitive culture.</div>
  `, { back: `/fan/${d.fanId}`, nav: { active: 'you', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// --- notifications (logged-in): organizer + fan activity --------------------
// Luma-style: a clean, roomy list split into "New" (unread) and "Earlier", each
// row a soft avatar-style icon, a headline, and a right-aligned timestamp.
export function renderNotifications(d: { fanId: string; createHref?: string; items: { kind: string; headline: string; href: string | null; createdAt: string; read: boolean }[] }): string {
  const icon = (k: string) => k === 'claim_new' ? '🎟' : k === 'claim_confirmed' ? '✅' : k === 'event_live' ? '🔴' : k === 'season_created' ? '📅' : k === 'follow' ? '➕' : '🔔';
  const row = (n: { kind: string; headline: string; href: string | null; createdAt: string; read: boolean }) =>
    `<a class="ntf${n.read ? '' : ' un'}" href="${esc(n.href || '#')}">
       <span class="nic">${icon(n.kind)}</span>
       <span class="ntx"><span class="nh">${esc(n.headline)}</span><span class="nd">${esc(n.createdAt)}</span></span>
       ${n.read ? '' : '<span class="ndot" aria-label="unread"></span>'}
     </a>`;
  const unread = d.items.filter(n => !n.read);
  const earlier = d.items.filter(n => n.read);
  const section = (title: string, list: typeof d.items) => list.length ? `<div class="nsec">${esc(title)}</div><div class="nlist">${list.map(row).join('')}</div>` : '';
  return layout('Notifications', `
    <style>
      .nsec{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:800;margin:22px 2px 8px}
      .nlist{display:flex;flex-direction:column}
      .ntf{display:flex;align-items:center;gap:13px;padding:14px 14px;border-bottom:1px solid var(--b);color:var(--bone);text-decoration:none}
      .ntf:hover{background:var(--s)}
      .ntf .nic{width:40px;height:40px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:18px;border-radius:50%;background:var(--s);border:1px solid var(--b)}
      .ntf.un .nic{border-color:var(--acc)}
      .ntx{display:flex;flex-direction:column;min-width:0;flex:1}.nh{font-size:14.5px;line-height:1.35}.nd{font-size:12px;color:var(--mut);margin-top:3px}
      .ndot{width:9px;height:9px;border-radius:50%;background:var(--acc);flex:0 0 auto}
      .nempty{text-align:center;color:var(--mut);padding:48px 16px}
    </style>
    <h1>Notifications</h1>
    ${d.items.length ? `${section(unread.length ? 'New' : '', unread)}${section('Earlier', earlier)}` : '<div class="nempty">You’re all caught up.<br><span style="font-size:13px">Ticket claims, approvals and live-event alerts for the crowds and events you run or follow will show up here.</span></div>'}
  `, { back: `/fan/${d.fanId}`, nav: { active: 'notifications', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// Notification categories (Luma-style groups). One flat list drives both the
// preferences page and the POST handler, so they can never drift.
export const NOTIF_GROUPS: { group: string; items: { key: string; label: string; desc: string }[] }[] = [
  { group: 'Events you attend', items: [
    { key: 'invites', label: 'Event invites', desc: 'When an organiser invites you to an event' },
    { key: 'reminders', label: 'Event reminders', desc: 'Before an event you claimed a spot at' },
    { key: 'blasts', label: 'Event blasts', desc: 'Announcements from organisers of events you’re attending' },
    { key: 'updates', label: 'Event updates', desc: 'Time, place or details changed' },
  ]},
  { group: 'Events you host', items: [
    { key: 'registrations', label: 'New registrations', desc: 'When someone claims a spot at your event' },
    { key: 'approvals', label: 'Approvals needed', desc: 'When someone needs your approval to attend' },
  ]},
  { group: 'Pages you manage', items: [
    { key: 'new_members', label: 'New followers', desc: 'When someone follows a page you run' },
  ]},
  { group: 'Horda', items: [
    { key: 'product_updates', label: 'Product updates', desc: 'What we ship, occasionally' },
  ]},
];
export const NOTIF_KEYS = NOTIF_GROUPS.flatMap(g => g.items.map(i => i.key));

// --- notification preferences (Luma-style "how do you want to be notified") ---
export function renderNotifPrefs(d: { fanId: string; createHref?: string; disabled: Set<string>; hasPhone: boolean; notice?: string; profileHref?: string }): string {
  const on = (k: string) => !d.disabled.has(k);
  const row = (it: { key: string; label: string; desc: string }) => `
    <label class="nprow">
      <span class="npmeta"><span class="npl">${esc(it.label)}</span><span class="npd">${esc(it.desc)}</span></span>
      <span class="npch"><input type="checkbox" name="${it.key}" ${on(it.key) ? 'checked' : ''}><span class="npsw"></span><span class="npchl">Email</span></span>
    </label>`;
  const group = (g: typeof NOTIF_GROUPS[number]) => `<div class="npsec">${esc(g.group)}</div><div class="npcard">${g.items.map(row).join('')}</div>`;
  return layout('Notifications', `
    <style>
      .npsec{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:800;margin:22px 2px 8px}
      .npcard{border:1px solid var(--b);border-radius:14px;background:var(--s);overflow:hidden}
      .nprow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--b);cursor:pointer}
      .nprow:last-child{border-bottom:0}
      .npmeta{display:flex;flex-direction:column;min-width:0}.npl{font-size:14.5px;font-weight:600}.npd{font-size:12.5px;color:var(--mut);margin-top:2px}
      .npch{display:flex;align-items:center;gap:9px;flex:0 0 auto}
      .npch input{position:absolute;opacity:0;width:0;height:0}
      .npsw{width:38px;height:22px;border-radius:999px;background:var(--b);position:relative;transition:.15s;flex:0 0 auto}
      .npsw::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--bone);transition:.15s}
      .npch input:checked + .npsw{background:var(--acc)}.npch input:checked + .npsw::after{transform:translateX(16px)}
      .npchl{font-size:12px;color:var(--mut);min-width:38px}
      .flash.ok{border:1px solid #3fb950;color:#7ee2a0;border-radius:10px;padding:10px 12px;font-size:13.5px;margin:10px 0}
    </style>
    ${profileTabs({ fanId: d.fanId, active: 'notifications', profileHref: d.profileHref })}
    <h1>Notifications</h1>
    <p class="mut">Choose how you’re notified about updates, invites and the events you run. Alerts also appear under the bell in the nav.</p>
    ${d.notice ? `<div class="flash ok">${esc(d.notice)}</div>` : ''}
    <form method="post" action="/notifications/settings">
      ${NOTIF_GROUPS.map(group).join('')}
      <p class="mut" style="font-size:12px;margin:16px 0 0">Email is live today${d.hasPhone ? '' : ' — add a phone in Settings for SMS reminders when they land'}. WhatsApp &amp; push are coming.</p>
      <div class="row" style="margin-top:14px"><button class="btn" type="submit">Save preferences</button></div>
    </form>
  `, { back: `/fan/${d.fanId}`, nav: { active: 'notifications', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// --- connections manager (owner) — request/admit/reject/remove club & league links
export function renderConnections(d: {
  fanId: string; createHref?: string; kind: string; id: string; name: string;
  outgoing: { kind: string; id: string; name: string; logoUrl: string | null; role?: string; linkId?: string; status?: string }[];
  incoming: { kind: string; id: string; name: string; logoUrl: string | null; role?: string; linkId?: string; status?: string }[];
  candidates: { kind: string; id: string; name: string }[];
}): string {
  const back = d.kind === 'athlete' ? `/athlete/${d.id}` : `/${d.kind}/${d.id}`;
  const logo = (c: { name: string; logoUrl: string | null }) => `<span class="clogo">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="">` : avatarSvg(c.name)}</span>`;
  const outRow = (c: typeof d.outgoing[number]) => `<div class="crow">${logo(c)}<span class="cmeta"><span class="cn">${esc(c.name)}</span><span class="cs">${c.status === 'active' ? 'Connected' : 'Requested — awaiting approval'}</span></span><form method="post" action="/connections/link/${c.linkId}/remove"><button class="btn ghost sm" type="submit">${c.status === 'active' ? 'Leave' : 'Cancel'}</button></form></div>`;
  const inRow = (c: typeof d.incoming[number]) => `<div class="crow">${logo(c)}<span class="cmeta"><span class="cn">${esc(c.name)}</span><span class="cs">${esc(c.kind)} · wants to join${c.status === 'active' ? ' (connected)' : ''}</span></span>${c.status === 'pending' ? `<span style="display:flex;gap:6px"><form method="post" action="/connections/link/${c.linkId}/admit"><button class="btn sm" type="submit">Admit</button></form><form method="post" action="/connections/link/${c.linkId}/reject"><button class="btn ghost sm" type="submit">Reject</button></form></span>` : `<form method="post" action="/connections/link/${c.linkId}/remove"><button class="btn ghost sm" type="submit">Remove</button></form>`}</div>`;
  const inp = 'width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:10px;font:inherit';
  return layout('Connections', `
    <style>.crow{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--b)}.clogo{width:38px;height:38px;border-radius:9px;overflow:hidden;border:1px solid var(--b);flex:0 0 auto}.clogo img,.clogo svg{width:100%;height:100%;object-fit:cover;display:block}.cmeta{flex:1;min-width:0}.cn{font-weight:700;display:block}.cs{font-size:12px;color:var(--mut)}</style>
    <h1>Connections</h1>
    <p class="mut">${esc(d.name)} — the clubs, leagues and series you're part of.</p>
    <h2>Your connections</h2>
    ${d.outgoing.length ? d.outgoing.map(outRow).join('') : '<p class="mut" style="font-size:13px">None yet.</p>'}
    ${d.incoming.length ? `<h2>Requests to join you</h2>${d.incoming.map(inRow).join('')}` : ''}
    <h2>Request to join</h2>
    <form method="post" action="/connections/request" style="max-width:420px">
      <input type="hidden" name="child_kind" value="${esc(d.kind)}"><input type="hidden" name="child_id" value="${esc(d.id)}">
      <label class="mut" style="display:block;font-size:13px">Pick a club or league<select name="parent" style="${inp}">${d.candidates.map(c => `<option value="${esc(c.kind)}:${esc(c.id)}">${esc(c.name)} (${esc(c.kind)})</option>`).join('')}</select></label>
      <div class="row"><button type="submit">Send request</button></div>
    </form>
    <div class="prov">You request to join; they admit or reject, and can remove you later (e.g. when you move clubs).</div>
  `, { back, nav: { active: 'you', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// --- handle-claim vitality campaign: reserve your @handle before you build --
export function renderClaimHandle(d: { guest: boolean; fanId: string | null; result?: { ok: boolean; reason?: string }; handle?: string }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const h = (d.handle || '').toLowerCase().replace(/^@/, '');
  let banner = '';
  if (d.result) {
    banner = d.result.ok
      ? `<div class="card" style="border-color:var(--bone)"><strong>✓ @${esc(h)} is reserved for you.</strong><div class="mut" style="font-size:13px;margin-top:4px">We'll email you to finish your page. First in line owns the name.</div><div class="row" style="margin-top:10px"><a class="btn" href="/signup?next=/onboarding/athlete">Build my page now →</a></div></div>`
      : `<div class="card"><strong>${d.result.reason === 'taken' ? `@${esc(h)} is already taken.` : d.result.reason === 'email' ? 'That email looks off — try again.' : 'Handles are 2–30 letters, numbers or underscores.'}</strong></div>`;
  }
  return layout('Claim your handle', `
    <h1>Claim your @handle</h1>
    <p class="mut" style="max-width:46ch">Lock in your name on Horda before someone else does. Reserve it now — build the page when you're ready. Free, takes ten seconds.</p>
    ${banner}
    <form method="post" action="/claim-handle" style="margin-top:14px;max-width:420px">
      <label class="mut" style="display:block;font-size:13px">Your handle
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px"><span class="mut" style="font-size:18px">@</span><input style="${inp};margin-top:0" name="handle" required value="${esc(h)}" placeholder="ricotheraven" pattern="[A-Za-z0-9_]{2,30}"></div></label>
      <label class="mut" style="display:block;margin:10px 0 0;font-size:13px">Email<input style="${inp}" type="email" name="email" required placeholder="you@email.com"></label>
      <label class="mut" style="display:block;margin:10px 0 0;font-size:13px">I'm a…
        <select name="kind" style="${inp}"><option value="athlete">Athlete</option><option value="club">Club / team</option><option value="other">Something else</option></select></label>
      <div class="row" style="margin-top:12px"><button type="submit">Reserve my handle</button></div>
    </form>
    <div class="prov">Reserving a handle holds the name; it doesn't create a public page until you build one.</div>
  `, { back: '/', nav: { active: 'home', guest: d.guest, fanId: d.fanId } });
}

// --- creator composer: the "+" create menu, every item tier-gated ----------
export function renderCompose(d: { athleteId: string; fanId: string | null; hasPaidTiers: boolean }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  const ta = 'display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:13px;font:inherit;min-height:120px;line-height:1.55';
  return layout('Create', `
    <h1>Create</h1>
    <p class="mut">On Horda you create <strong>events people claim</strong> — not content. Everything here is capped, counted, and terminates in a claim.</p>
    <div class="card"><h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Main Event</h2><p class="mut" style="font-size:13.5px">The marquee tier — fight night, race day, match day. Capacity, ticket types, waitlists, entry control.</p><a class="btn" href="/host/athlete/${esc(d.athleteId)}/new?tier=main">Create a Main Event →</a></div>
    <div class="card"><h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Gathering</h2><p class="mut" style="font-size:13.5px">The cadence engine — watch party, meetup, training session, run, capped online room. Anyone hosts.</p><a class="btn ghost" href="/host/athlete/${esc(d.athleteId)}/new?tier=gathering">Host a Gathering →</a></div>
    <div class="card"><h2 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">One-on-One</h2><p class="mut" style="font-size:13.5px">Booked, priced time with you — in person or video. Highest margin, geography-free online.</p><a class="btn ghost" href="/host/athlete/${esc(d.athleteId)}/new?tier=one_on_one">Open One-on-One →</a></div>
  `, { back: `/athlete/${d.athleteId}`, nav: { active: 'you', guest: false, fanId: d.fanId, createHref: `/athlete/${d.athleteId}/compose` } });
}

// PUBLIC share page — the acquisition loop. Open to everyone (like Shop): a
// non-user lands here from a shared card and meets a join CTA. Facts only.
export function renderSharePage(a: { title: string; card: string; body: string; shareText: string }, joinHref = '/signup', vw?: { guest: boolean; fanId: string | null }): string {
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
      <div class="row"><a href="${esc(joinHref)}"><button>Join free</button></a></div></div>`,
    // Public acquisition surface — but a logged-in viewer must still see their own
    // rail, not "Log in / Join free". Defaults to guest when the route doesn't say.
    { back: '/', nav: { active: 'explore', guest: vw?.guest ?? true, fanId: vw?.fanId ?? null } });
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

// /following — everything you follow, with a search to find more + unfollow.
export function renderFollowing(d: { fanId: string; createHref?: string; follows: { type: string; id: string; name: string }[]; sports?: { key: string; name: string }[]; regions?: string[]; q?: string; results?: { kind: string; id: string; name: string; region: string | null }[] }): string {
  const inp = 'background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:11px 13px;font:inherit;width:100%';
  const href = (type: string, id: string) => type === 'sport' ? `/?sport=${encodeURIComponent(id)}` : type === 'region' ? `/?region=${encodeURIComponent(id)}` : type === 'athlete' ? `/athlete/${id}` : `/${type}/${id}`;
  const kindTag = (k: string) => k === 'athlete' ? 'Athlete' : k === 'club' ? 'Club' : k === 'team' ? 'Team' : k === 'association' ? 'Federation' : k === 'sport' ? 'Sport' : k === 'region' ? 'City / region' : k;
  const followRow = (f: { type: string; id: string; name: string }) =>
    `<div class="frow"><a class="fmeta" href="${href(f.type, f.id)}"><span class="fav">${avatarSvg(f.name)}</span><span><span class="fnm">${esc(f.name)}</span><span class="fk">${esc(kindTag(f.type))}</span></span></a>
      <form method="post" action="/unfollow"><input type="hidden" name="target_type" value="${esc(f.type)}"><input type="hidden" name="target_id" value="${esc(f.id)}"><button class="btn ghost sm" type="submit">Unfollow</button></form></div>`;
  const resultRow = (r: { kind: string; id: string; name: string; region: string | null }) => {
    const already = d.follows.some(f => f.type === r.kind && f.id === r.id);
    return `<div class="frow"><a class="fmeta" href="${href(r.kind, r.id)}"><span class="fav">${avatarSvg(r.name)}</span><span><span class="fnm">${esc(r.name)}</span><span class="fk">${esc(kindTag(r.kind))}${r.region ? ' · ' + esc(r.region) : ''}</span></span></a>
      ${already ? `<span class="fk" style="color:var(--acc)">Following</span>` : `<form method="post" action="/follow"><input type="hidden" name="fan_id" value="${d.fanId}"><input type="hidden" name="target_type" value="${esc(r.kind)}"><input type="hidden" name="target_id" value="${esc(r.id)}"><button class="btn sm" type="submit">Follow</button></form>`}</div>`;
  };
  const body = `
    <style>
      .frow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--b)}
      .fmeta{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
      .fav{width:42px;height:42px;border-radius:50%;overflow:hidden;border:1px solid var(--b);flex:0 0 auto}.fav svg{width:100%;height:100%;display:block}
      .fnm{display:block;font-weight:600;font-size:14.5px}.fk{display:block;color:var(--mut);font-size:12px;margin-top:1px}
      .fsearch{display:flex;gap:8px;margin:14px 0 6px}
      .fgh{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:800;margin:16px 0 2px}
    </style>
    <h1>Following</h1>
    <p class="mut">Everything you back — athletes, clubs, federations, whole sports and cities. Their events fill your home feed.</p>
    <form class="fsearch" method="get" action="/following"><input name="q" value="${esc(d.q ?? '')}" placeholder="Search athletes, clubs, sports, cities…" style="${inp}" autocomplete="off"><button class="btn" type="submit">Search</button></form>
    ${d.q ? `<h2 class="mut" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:18px 0 6px">Results for “${esc(d.q)}”</h2>${(d.results && d.results.length) ? d.results.map(resultRow).join('') : '<p class="mut" style="margin-top:8px">No match — try another name or city.</p>'}` : ''}
    ${(() => {
      const sportFollows = (d.sports ?? []).map(s => ({ type: 'sport', id: s.key, name: s.name }));
      const regionFollows = (d.regions ?? []).map(r => ({ type: 'region', id: r, name: r }));
      const groups: [string, { type: string; id: string; name: string }[]][] = [
        ['Cities & regions', regionFollows],
        ['Sports', sportFollows],
        ['Athletes', d.follows.filter(f => f.type === 'athlete')],
        ['Clubs & teams', d.follows.filter(f => f.type === 'club' || f.type === 'team')],
        ['Federations', d.follows.filter(f => f.type === 'association')],
      ];
      const total = d.follows.length + sportFollows.length + regionFollows.length;
      if (!total) return '<h2 class="mut" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:22px 0 6px">You follow · 0</h2><p class="mut" style="margin-top:8px">You’re not following anyone, any sport or any city yet. Search above, or <a href="/" style="border-bottom:1px solid var(--b)">explore events</a>.</p>';
      return `<h2 class="mut" style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin:22px 0 6px">You follow · ${total}</h2>` +
        groups.filter(([, list]) => list.length).map(([label, list]) =>
          `<div class="fgh">${esc(label)} · ${list.length}</div>${list.map(followRow).join('')}`).join('');
    })()}
  `;
  return layout('Following', body, { back: '/', nav: { active: 'following', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// sign-up — create a real account (browsing is open; acting needs this).
// One sign-up for everyone (LinkedIn-style): you join as an individual; setting up
// an athlete or club page is a choice you make later, never a fork at the door.
export function renderSignup(next: string, follow = ''): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  return layout('Sign up', `
    <h1>Sign up</h1>
    <p class="mut">Enter your name and email and we’ll send a one-tap sign-in link. No password. Free. You can set up an athlete or club page later.</p>
    ${oauthButtons(next)}
    <form method="post" action="/auth/start">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      ${follow ? `<input type="hidden" name="follow" value="${esc(follow)}">` : ''}
      <label class="mut" style="display:block;margin:12px 0">Name<input style="${inp}" name="name" required></label>
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <div class="row"><button type="submit">Email me a sign-in link</button></div>
    </form>
    <p class="mut" style="margin-top:14px">Already have one? <a href="/login" style="border-bottom:1px solid var(--b)">Log in</a>.</p>`,
    { back: next || '/', nav: { guest: true, fanId: null } });
}

// Passwordless: after /auth/start we tell the user to check their email, and give
// them a box to type the 6-digit code. Dev mode surfaces the link + code inline.
export function renderMagicSent(d: { email: string; next?: string; devLink?: string | null; devCode?: string | null; error?: boolean; expired?: boolean; badCode?: boolean }): string {
  const inp = 'display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  if (d.error) return layout('Sign in', `<h1>Enter a valid email</h1><p class="mut">We need an email address to send your sign-in link.</p><div class="row" style="margin-top:12px"><a class="btn" href="/login">Try again</a></div>`, { back: '/' });
  if (d.expired) return layout('Link expired', `<h1>That link has expired</h1><p class="mut">Sign-in links last 15 minutes. Request a fresh one.</p><div class="row" style="margin-top:12px"><a class="btn" href="/login">Get a new link</a></div>`, { back: '/' });
  return layout('Check your email', `
    <h1>Check your email</h1>
    <p class="mut">We sent a sign-in link${d.email ? ` to <b style="color:var(--bone)">${esc(d.email)}</b>` : ''}. Tap it and you're in — it expires in 15 minutes.</p>
    <form method="post" action="/auth/code" style="margin-top:16px">
      <input type="hidden" name="next" value="${esc(d.next || '')}">
      <input type="hidden" name="email" value="${esc(d.email)}">
      <label class="mut" style="display:block">Or enter the 6-digit code${d.badCode ? ' <span style="color:#ff6b6b">— that code didn\'t match</span>' : ''}<input style="${inp}" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required></label>
      <div class="row" style="margin-top:12px"><button type="submit">Sign in</button></div>
    </form>
    ${d.devLink ? `<div class="card" style="margin-top:16px"><div class="mut" style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800">Dev mode — email not configured</div><p class="mut" style="font-size:13px;margin-top:6px">Link: <a href="${esc(d.devLink)}" style="border-bottom:1px solid var(--b);word-break:break-all">${esc(d.devLink)}</a></p>${d.devCode ? `<p class="mut" style="font-size:13px">Code: <b style="color:var(--bone);letter-spacing:3px">${esc(d.devCode)}</b></p>` : ''}</div>` : ''}
  `, { back: '/' });
}

// the separate creator entrance (athletes self-create; clubs/federations claim)
// Logged-in user with >1 page they can host under → pick which one hosts the event.
export function renderCreatePicker(d: { fanId: string | null; pages: { kind: string; id: string; name: string }[] }): string {
  const href = (p: { kind: string; id: string }) => `/host/${p.kind}/${p.id}/new`;
  const kindLabel: Record<string, string> = { athlete: 'You', club: 'Club', team: 'Team', association: 'Federation' };
  return layout('Create an event', `
    <style>.cgrid{display:grid;gap:10px;margin-top:16px}.ccard{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--b);border-radius:14px;padding:14px 16px}.ccard b{font-size:15px}.ccard .k{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}</style>
    <h1>Create an event</h1>
    <p class="mut">Who's hosting it?</p>
    <div class="cgrid">${d.pages.map(p => `<div class="ccard"><div><div class="k">${esc(kindLabel[p.kind] ?? p.kind)}</div><b>${esc(p.name)}</b></div><a class="btn" href="${href(p)}">Host as this →</a></div>`).join('')}</div>
  `, { back: '/', nav: { active: 'create', guest: false, fanId: d.fanId } });
}
// No page yet → a one-time 18+ check, then we spin up a personal host page.
export function renderCreateAge(d: { name: string; error?: boolean }): string {
  const inp = 'display:block;width:160px;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit';
  return layout('Create an event', `
    <h1>Let's set you up to host</h1>
    <p class="mut">We'll create a personal page so you can host events under your name. Hosting is for people 18 or older — just confirm your birth year once.</p>
    ${d.error ? `<p style="color:#ff6b6b;font-size:13px">You need to be 18 or older to host events.</p>` : ''}
    <form method="post" action="/create">
      <label class="mut" style="font-size:13px">Birth year<input class="" style="${inp}" type="number" name="birth_year" min="1900" max="2025" placeholder="1998" required></label>
      <div class="row" style="margin-top:14px"><button type="submit">Continue →</button></div>
    </form>
  `, { back: '/', nav: { active: 'create', guest: false, fanId: null } });
}
export function renderCreatorEntry(d: { guest: boolean }): string {
  const athleteHref = d.guest ? '/signup?next=/onboarding/athlete' : '/onboarding/athlete';
  const claimHref = d.guest ? '/signup?next=/onboarding/claim' : '/onboarding/claim';
  return layout('Set up your page', `
    <style>.cgrid{display:grid;gap:12px;margin-top:16px}.ccard{border:1px solid var(--b);border-radius:14px;padding:16px 18px}.ccard h2{margin:0 0 4px;font-size:17px;border:none;padding:0;text-transform:none;letter-spacing:0}.ccard p{color:var(--mut);font-size:13.5px;margin:0 0 12px}</style>
    <h1>For athletes, clubs &amp; federations</h1>
    <p class="mut">Run your own page on Horda — posts, members, tiers and events, all in one place.</p>
    <div class="cgrid">
      <div class="ccard"><h2>I’m an athlete</h2><p>Describe yourself in a sentence and we build your page — headline, cover, the lot. You own it instantly.</p><a class="btn" href="${athleteHref}">Create my page →</a> <a href="/about#features" style="margin-left:8px;font-size:13px;border-bottom:1px solid var(--b)">what you get →</a></div>
      <div class="ccard"><h2>We’re a club or federation</h2><p>Find your page and verify you represent it (official email, a code on your site, or a quick review).</p><a class="btn" href="${claimHref}">Claim our page →</a> <a href="/about#features" style="margin-left:8px;font-size:13px;border-bottom:1px solid var(--b)">what you get →</a></div>
    </div>
    ${d.guest ? `<p class="mut" style="margin-top:16px;font-size:12.5px">Just here to follow? <a href="/signup" style="border-bottom:1px solid var(--b)">Create a fan account →</a></p>` : `<p class="mut" style="margin-top:16px;font-size:12.5px">No need for a separate account — your page lives on your existing login.</p>`}`, { back: '/' });
}

// --- onboarding: fan first-run (pick a sport, follow a few faces) ----------
export function renderOnboardFan(d: { fanId: string; sport?: string; sports: { key: string; name: string }[]; athletes: { id: string; name: string; sport: string | null; region: string | null; verified?: boolean }[]; clubs: { id: string; name: string; sport: string | null; region: string | null; verified?: boolean }[]; followedCount: number; preselect?: string[] }): string {
  const pre = new Set(d.preselect ?? []);
  const fq = pre.size ? `follow=${encodeURIComponent([...pre].join(','))}` : '';
  const chip = (label: string, key?: string) => {
    const q = [key ? `sport=${key}` : '', fq].filter(Boolean).join('&');
    return `<a class="chip${(key ?? '') === (d.sport ?? '') ? ' on' : ''}" href="/onboarding/fan${q ? `?${q}` : ''}">${esc(label)}</a>`;
  };
  // Multi-select: a clicked athlete is pre-checked; selections stay visible and
  // highlighted (deselectable). Nothing persists until "Save".
  const pick = (type: string, id: string, name: string, sub: string, verified?: boolean) => {
    const k = `${type}:${id}`;
    return `<label class="pick"><input type="checkbox" name="t" value="${esc(k)}"${pre.has(k) ? ' checked' : ''}><span class="po"><span class="on">${esc(name)}${verified ? ' <span class="sf">✦</span>' : ''}</span><span class="osub">${esc(sub)}</span></span><span class="chk">✓</span></label>`;
  };
  const list = [
    ...d.athletes.map(a => pick('athlete', a.id, a.name, [a.sport, a.region].filter(Boolean).join(' · ') || 'athlete', a.verified)),
    ...d.clubs.map(c => pick('club', c.id, c.name, [c.sport, c.region].filter(Boolean).join(' · ') || 'club', c.verified)),
  ].join('') || `<p class="mut">No coverage for that sport yet — try another, or skip.</p>`;
  return layout('Set up your Horda', `
    <style>.pick{display:flex;align-items:center;gap:11px;border:1px solid var(--b);border-radius:12px;padding:11px 13px;margin:8px 0;cursor:pointer}
    .pick input{position:absolute;opacity:0;width:0;height:0}
    .pick .po{flex:1;min-width:0}.on{font-weight:800;font-size:15px}.osub{color:var(--mut);font-size:12px;text-transform:capitalize;display:block;margin-top:1px}.sf{color:var(--bone)}
    .pick .chk{flex:0 0 24px;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--b);display:flex;align-items:center;justify-content:center;color:transparent;font-weight:800;font-size:13px}
    .pick:has(input:checked){border-color:var(--bone);background:rgba(237,233,223,.05)}
    .pick:has(input:checked) .chk{background:var(--bone);color:var(--ink);border-color:var(--bone)}
    .chip{display:inline-block;border:1px solid var(--b);color:var(--mut);border-radius:999px;padding:6px 12px;font-size:12.5px;margin:0 6px 6px 0}.chip.on{background:var(--bone);color:var(--ink);border-color:var(--bone)}</style>
    <h1>Find your people</h1>
    <p class="mut">Pick a few to follow — they fill your feed. Tap to select or deselect; nothing's saved until you hit Save.${d.followedCount ? ` <b>Already following ${d.followedCount}.</b>` : ''}</p>
    <div style="margin:12px 0">${chip('All sports')}${d.sports.map(s => chip(s.name, s.key)).join('')}</div>
    <form method="post" action="/onboarding/follow">
      ${list}
      <div class="row" style="margin-top:18px"><button type="submit">Save &amp; continue →</button><a class="btn ghost" href="/onboarding/done">Skip</a></div>
    </form>`, { back: '/' });
}

// --- post-signup welcome: the one moment to pull someone into Discord -------
// Only rendered when DISCORD_INVITE_URL is set; otherwise the route redirects
// straight through as before. "Skip" is a plain, equal-weight link on purpose:
// a community you have to trick people into joining isn't a community.
export function renderWelcome(d: { fanId: string; createHref?: string }): string {
  const next = `/fan/${esc(d.fanId)}`;
  return layout('You’re in', `
    <div style="max-width:520px;margin:0 auto;text-align:center;padding:18px 0">
      <div style="color:#5865F2;line-height:0;margin-bottom:16px">${discordMark(38)}</div>
      <h1 style="font-size:29px;font-weight:900;letter-spacing:-.02em;margin-bottom:12px">You’re in. Now come tell us what to build.</h1>
      <p class="mut" style="line-height:1.6;margin-bottom:22px">Horda is built in the open — we ship every week and publish every change. Our Discord is where fans, athletes and organisers tell us what’s missing. Ask for something; when we build it, your name goes on the <a href="/changelog" style="color:var(--bone);border-bottom:1px solid var(--b)">changelog</a>.</p>
      <a class="btn" href="${esc(discordUrl())}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:9px">${discordMark(16)} Join the Discord ↗</a>
      <div style="margin-top:18px"><a class="mut" href="${next}" style="font-size:14px;border-bottom:1px solid var(--b)">Skip — take me to Horda</a></div>
    </div>
  `, { nav: { active: 'home', guest: false, fanId: d.fanId, createHref: d.createHref } });
}

// --- onboarding: AI-first. Describe yourself → we generate a polished page. ---
export function renderAiPrompt(d: { title: string; lead: string; placeholder: string; generateAction: string; hidden?: string; back: string; altLink?: string }): string {
  const ta = 'display:block;width:100%;margin-top:8px;background:var(--s);border:1px solid var(--b);border-radius:12px;color:var(--bone);padding:13px;font:inherit;min-height:150px;line-height:1.55';
  const sel = 'display:block;width:100%;margin-top:5px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:9px;font:inherit';
  return layout(d.title, `
    <h1>${esc(d.title)}</h1>
    <p class="mut">${esc(d.lead)}</p>
    <form method="post" action="${esc(d.generateAction)}">${d.hidden ?? ''}
      <textarea name="description" required placeholder="${esc(d.placeholder)}" style="${ta}"></textarea>
      <div style="margin-top:14px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700">Creative direction <span style="text-transform:none;letter-spacing:0;font-weight:400">— optional, steers the tone</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <label class="mut" style="flex:1;min-width:120px;font-size:12px">Mood
          <select name="mood" style="${sel}"><option value="">Auto</option><option value="dark, intense">Dark &amp; intense</option><option value="bright, fresh">Bright &amp; fresh</option><option value="bold, gritty">Bold &amp; gritty</option><option value="clean, minimal">Clean &amp; minimal</option><option value="playful, energetic">Playful</option></select></label>
        <label class="mut" style="flex:1;min-width:120px;font-size:12px">Energy
          <select name="energy" style="${sel}"><option value="">Auto</option><option value="calm and understated">Calm</option><option value="confident">Confident</option><option value="high-energy and loud">High-energy</option></select></label>
        <label class="mut" style="flex:1;min-width:120px;font-size:12px">Voice
          <select name="voice" style="${sel}"><option value="">Auto</option><option value="first person">First person (I…)</option><option value="third person">Third person</option></select></label>
      </div>
      <div class="row" style="margin-top:14px"><button type="submit">✦ Generate my page</button></div>
    </form>
    <p class="mut" style="margin-top:12px;font-size:12.5px">We turn your words into a bold, on-brand page — a cooler headline, a striking cover, the works. The creative direction shapes tone only; we never invent facts. You can tweak everything before it goes live.</p>
    ${d.altLink ?? ''}`, { back: d.back });
}

export function renderProfilePreview(d: { kind: string; gen: { displayName: string; handle: string; headline: string; tagline: string; bio: string; cover: string; sport?: string; links?: Record<string, string> }; description: string; createAction: string; generateAction: string; hidden?: string; showHandle?: boolean }): string {
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
      <div class="pvh">Sport</div>${sportSelect('sport', g.sport, inp)}
      ${g.links && Object.keys(g.links).length ? `<div class="pvh">Links found</div><div class="mut" style="font-size:12.5px">${Object.keys(g.links).map(k => esc(k)).join(' · ')}</div>` : ''}
      <div class="pvh">Profile picture</div>
      <input type="file" accept="image/*" data-target="avatar" style="color:inherit;font:inherit"><input type="hidden" name="avatar">
      <div class="pvh">Background photo <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">— optional; replaces the generated cover</span></div>
      <input type="file" accept="image/*" data-target="banner" style="color:inherit;font:inherit"><input type="hidden" name="banner">
      <label class="mut" style="display:block;margin:14px 0 0">Name<input style="${inp}" name="name" value="${esc(g.displayName)}" required></label>
      ${d.showHandle !== false ? `<label class="mut" style="display:block;margin:12px 0 0">Handle<input style="${inp}" name="handle" value="${esc(g.handle)}" required></label>` : ''}
      <label class="mut" style="display:block;margin:12px 0 0">Tagline<input style="${inp}" name="tagline" value="${esc(g.tagline)}"></label>
      <label class="mut" style="display:block;margin:12px 0 0">Bio / intro<textarea style="${inp};min-height:90px" name="bio">${esc(g.bio)}</textarea></label>
      ${d.kind === 'athlete' ? `<label class="mut" style="display:block;margin:12px 0 0">Your birth year <span style="font-size:12px">— athlete pages are 18+</span><input style="${inp}" name="birth_year" type="number" min="1900" max="${new Date().getFullYear()}" placeholder="e.g. 1998" required></label>` : ''}
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
    <p class="mut">Enter your email — we’ll send a one-tap sign-in link. No password needed.</p>
    ${oauthButtons(next)}
    <form method="post" action="/auth/start">
      <input type="hidden" name="next" value="${esc(next || '/')}">
      <label class="mut" style="display:block;margin:12px 0">Email<input style="${inp}" type="email" name="email" required></label>
      <div class="row"><button type="submit">Email me a sign-in link</button></div>
    </form>
    <p class="mut" style="margin-top:14px">New here? <a href="/signup" style="border-bottom:1px solid var(--b)">Create an account</a>.</p>`,
    { back: next || '/', nav: { guest: true, fanId: null } });
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
export function renderFanHome(d: { fanId: string; fanName: string; handle?: string | null; home: FanHome; follows: { type: string; id: string; name: string }[]; activation?: string; createHref?: string; doors?: { eventId: string; title: string; date: string | null; hostKind: string | null; hostId: string | null; remaining: number | null; tier: string; mine: boolean }[]; morningAfter?: { title: string; date: string; recordTotal: number } | null; pages?: { kind: string; id: string; name: string; events: { id: string; title: string; date?: string }[] }[];
  /** Events you hold a spot at — see the three-band note below. */
  attending?: { eventId: string; title: string; date: string | null; status: string; passToken: string | null; partySize: number; formatLabel: string | null }[];
  /** Events you co-organise (someone else owns them; you promote + see stats). */
  coRunning?: { eventId: string; title: string; date: string | null; hostName: string }[];
}): string {
  const { home } = d;
  const ehref = (k: string, id: string) => k === 'athlete' ? `/athlete/${id}` : `/${k}/${id}`;

  // THREE BANDS, THREE DIFFERENT JOBS. This page used to have one list, "Your
  // doors", which mixed all three — so the event you're RUNNING on Saturday sat
  // in the same list, styled the same way, as an event you might fancy.
  //
  //   You're running   — you are responsible. If it's wrong, it's your problem.
  //   You're going to  — you already have a ticket. Nothing to decide; get in.
  //   Might be for you — you have not committed. This is the only band that sells.
  //
  // Order is deliberate: obligation, then commitment, then browsing. You should
  // never have to scroll past things you might do to find the thing you promised.
  // "Organised by me" vs "attending" was ambiguous mostly because the words were
  // doing work the LAYOUT should do.

  // "Your pages" = the creator side of this same account: a switcher between the
  // fan feed and each page you run, plus where you manage that page's events.
  const pagesBlock = (d.pages && d.pages.length)
    ? `<h2>You're running</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">The pages you run and their events — you're the organiser here.</p>${d.pages.map(pg => {
        const next = pg.events[0];
        const nextUp = next
          ? `<div class="row" style="margin:8px 0 0;padding:9px 11px;border:1px solid var(--bone);border-radius:10px;justify-content:space-between"><span style="font-size:13px">⏱ Next: <strong>${esc(next.title)}</strong>${next.date ? ` · ${esc(next.date)}` : ''}</span><a class="tag" href="/e/${next.id}/room">Open room</a></div>`
          : `<div class="mut" style="font-size:12px;margin:8px 0 0">No upcoming event — <a href="/host/${pg.kind}/${pg.id}/new" style="border-bottom:1px solid var(--b)">schedule one</a> to put it on your radar.</div>`;
        const evs = pg.events.length
          ? `<ul style="list-style:none;margin:8px 0 0">${pg.events.slice(0, 5).map(e => `<li style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--b)"><a class="hl" href="/e/${e.id}" style="flex:1">${esc(e.title)}</a><span class="dt">${esc(e.date ?? '')}</span><a class="tag mutd" href="/manage/${e.id}">Manage</a></li>`).join('')}</ul>`
          : `<p class="mut" style="font-size:12.5px;margin:6px 0 0">No events yet.</p>`;
        return `<div class="card"><div class="row" style="justify-content:space-between;margin:0"><a class="hl" href="${ehref(pg.kind, pg.id)}">${esc(pg.name)} <span class="tag mutd">${esc(pg.kind)}</span></a><span class="row" style="gap:6px;margin:0"><a class="tag mutd" href="/embed/${pg.kind}/${pg.id}/code" title="Show your events on your own website">Embed</a><a class="tag" href="/host/${pg.kind}/${pg.id}/new">＋ Event</a></span></div>${nextUp}${evs}</div>`;
      }).join('')}<div class="row"><a class="tag mutd" href="/create">＋ Create another page</a></div>`
    : `<div class="card" style="border-color:var(--bone)"><strong>Competing? Become a Creathor.</strong><p class="mut" style="font-size:12.5px;margin:6px 0 10px">It's just an upgrade on this account — your fan feed stays exactly as it is. Get an athlete page, run events, and see who you bring to the door.</p><div class="row"><a class="btn sm" href="/pros">Get your athlete page →</a><a class="tag mutd" href="/create">Claim a club</a></div></div>`;
  const unread = home.notifications.filter(n => !n.read).length;

  const following = d.follows.length
    ? `<h2 id="hordas">My Hordas</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">Everyone you follow.</p><div class="row">${d.follows.map(f => `<a class="tag mutd" href="/${f.type === 'club' ? 'club' : f.type === 'athlete' ? 'athlete' : 'club'}/${f.id}">${esc(f.name)}</a>`).join(' ')}</div>`
    : `<h2 id="hordas">My Hordas</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">You're not following anyone yet. <a href="/" style="border-bottom:1px solid var(--b)">Discover athletes &amp; clubs →</a></p>`;

  // You're co-running: events someone else owns where you're a co-organiser. You
  // don't edit them — you promote with your own link and watch the stats.
  const coRunning = d.coRunning ?? [];
  const coRunningBlock = coRunning.length
    ? `<h2>You're co-running</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">Someone else hosts these — you co-run them: your own share link, and the numbers.</p><div class="doorlist">${coRunning.map(e => `<a class="doorcard" href="/e/${e.eventId}"><div style="flex:1"><div class="hl">${esc(e.title)}</div><div class="dt">${esc(e.date ?? 'soon')}${e.hostName ? ` · by ${esc(e.hostName)}` : ''}</div></div><span class="tag mutd">Co-running</span></a>`).join('')}</div>`
    : '';

  const notifs = home.notifications.length
    ? `<h2>Notifications ${unread ? `<span class="tag ok">${unread} new</span>` : ''}</h2><ul>${home.notifications.map(n => `<li><span class="tag mutd">${esc(n.kind)}</span><span class="hl">${esc(n.headline)}</span></li>`).join('')}</ul>` : '';

  // The feed is a ranked stream of DOORS — every card terminates in a claim,
  // never content. It's finite: it ends visibly ("you're up to date").
  const tierBadge: Record<string, string> = { main: 'Main Event', gathering: 'Gathering', one_on_one: 'One-on-One' };
  const doors = d.doors ?? [];
  const doorCard = (dr: NonNullable<typeof d.doors>[number]) => {
    const scar = dr.remaining == null ? '' : (dr.remaining <= 0 ? '<span class="tag mutd">Full · waitlist</span>' : `<span class="tag mutd">${dr.remaining} left</span>`);
    return `<a class="doorcard" href="/e/${dr.eventId}"><div style="flex:1"><div class="hl">${esc(dr.title)}</div><div class="dt">${esc(dr.date ?? 'soon')} · ${esc(tierBadge[dr.tier] ?? 'event')}</div></div><div style="text-align:right">${dr.mine ? '<span class="tag ok">Claimed</span>' : scar}<div style="margin-top:6px" class="tag">${dr.mine ? 'View pass' : 'Claim →'}</div></div></a>`;
  };
  // Band 3: browsing. An event you've already claimed is filtered OUT of it — it
  // has its own band above, and leaving it here is what made "organised vs
  // attending vs available" mush in the first place. Also drops the scarcity
  // count for claimed events by construction (the countdown rule, again).
  const attending = d.attending ?? [];
  const claimedIds = new Set(attending.map(a => a.eventId));
  const open = doors.filter(dr => !claimedIds.has(dr.eventId));
  const feed = open.length
    ? `<h2>Might be for you</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">Claimable events from the crowds you follow.</p><div class="doorlist">${open.map(doorCard).join('')}</div><div class="uptodate">You're up to date.</div>`
    : `<h2>Might be for you</h2><p class="mut">Follow a crowd and their claimable events show up here. <a href="/" style="border-bottom:1px solid var(--b)">Find your scene →</a></p>`;

  // Band 2: you already hold a spot. Nothing to sell — the only job is getting
  // you through the door, so the action is the pass and nothing competes with it.
  const attRow = (a: NonNullable<typeof d.attending>[number]) => {
    const wait = a.status === 'waitlisted';
    const pend = a.status === 'approved';
    const chip = wait ? '<span class="tag mutd">Waitlisted</span>'
      : pend ? '<span class="tag mutd">Awaiting approval</span>'
      : '<span class="tag ok">✓ You\'re in</span>';
    const via = [a.formatLabel, a.partySize > 1 ? `${a.partySize} tickets` : null].filter(Boolean).join(' · ');
    return `<a class="doorcard" href="${a.passToken && !wait ? `/pass/${a.passToken}` : `/e/${a.eventId}`}">
      <div style="flex:1"><div class="hl">${esc(a.title)}</div><div class="dt">${esc(a.date ?? 'soon')}${via ? ` · ${esc(via)}` : ''}</div></div>
      <div style="text-align:right">${chip}<div style="margin-top:6px" class="tag">${a.passToken && !wait ? 'View pass' : 'Details'}</div></div></a>`;
  };
  const attendingBlock = attending.length
    ? `<h2>You're going to</h2><p class="mut" style="font-size:12.5px;margin:-4px 0 8px">You hold a spot at these. Your pass is one tap away.</p><div class="doorlist">${attending.map(attRow).join('')}</div>`
    : '';

  return layout('Your events', `
    <style>
      .doorlist{display:flex;flex-direction:column;gap:8px;margin:8px 0}
      .doorcard{display:flex;align-items:center;gap:12px;border:1px solid var(--b);border-radius:14px;padding:13px 15px;background:var(--s);text-decoration:none;color:var(--bone)}
      .doorcard:hover{border-color:var(--bone)}
      /* Quick access to every public page you own — your athlete page, your clubs,
         your associations — so "where do I see my profile / my pages" is obvious. */
      .mypages{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 14px}
      .mypages .mplab{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);font-weight:700;margin-right:2px}
      .mpchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--b);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:var(--bone)}
      .mpchip:hover{border-color:var(--bone)}
      .mpchip .mpk{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
      /* "Your Horda" identity header — profile-first: your name + @handle, the
         one place that says "this space is yours". @handle → manage in Settings. */
      .yhhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0 14px}
      .yhhead .yhk{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--acc);font-weight:800}
      .yhhead .yhname{font-size:26px;font-weight:900;letter-spacing:-.02em;margin:2px 0 0}
      .yhhandle{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--b);border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:700;color:var(--bone);white-space:nowrap}
      .yhhandle:hover{border-color:var(--bone)}.yhhandle.add{color:var(--acc);border-color:rgba(225,90,64,.5)}
    </style>
    ${profileTabs({ fanId: d.fanId, active: 'events', profileHref: (() => { const a = (d.pages ?? []).find(p => p.kind === 'athlete'); return a ? `/athlete/${a.id}/customize` : undefined; })() })}
    <div class="yhhead">
      <div><div class="yhk">Your Horda</div><h1 class="yhname">Hi, ${esc((d.fanName || 'you').split(' ')[0])}</h1></div>
      ${d.handle ? `<a class="yhhandle" href="/settings" title="Manage your @handle">@${esc(d.handle)}</a>` : `<a class="yhhandle add" href="/settings">＋ Pick a @handle</a>`}
    </div>
    ${(d.pages && d.pages.length)
      ? `<div class="mypages"><span class="mplab">Your pages</span>${d.pages.map(pg => `<a class="mpchip" href="${ehref(pg.kind, pg.id)}">${esc(pg.name)}<span class="mpk">${esc(pg.kind)}</span></a>`).join('')}</div>`
      : ''}
    ${pagesBlock}
    ${coRunningBlock}
    ${attendingBlock}
    ${following}
    <div class="prov">Your events: what you run, what you co-run, what you're going to, and your Hordas. Notifications live under the bell.</div>`, { back: '/', nav: { active: 'you', guest: false, fanId: d.fanId, createHref: d.createHref } });
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
