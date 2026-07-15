// theme.ts — one identity, two skins. Dark (Ink/Bone) is the default Horda look;
// light is the bright, photo-forward variant. The choice is per-device and
// applied before first paint (no flash). Every page shares these tokens, so the
// whole app flips together.
//
// Usage in a full document:
//   <head><meta charset="utf-8">${THEME_BOOT}
//   <style>${THEME_VARS}${THM_CSS} ...page css...</style></head>
//   ... put ${themeToggle()} in the header nav ...

// Single dark "arena" theme — no light mode, no toggle (design guardrail).
// Base is a warm dark GREY (not pure black); the accent is a coral-orange used
// for CTAs. Buttons are softly rounded (--btnr), not full pills.
export const THEME_VARS = `
  :root{color-scheme:dark;--ink:#232020;--bone:#EDE9DF;--s:rgba(237,233,223,.05);--b:rgba(237,233,223,.16);--mut:rgba(237,233,223,.6);--scrim:rgba(26,23,23,.84);--acc:#E15A40;--acc2:#cd4c33;--accink:#1b1310;--btnr:12px}
`;

// No theme boot needed — the app is dark-only. Kept as an empty export so every
// page's <head> that references it stays valid.
export const THEME_BOOT = '';

export const THM_CSS = `.thm{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--b);background:transparent;color:var(--bone);cursor:pointer;padding:0;flex:0 0 auto}.thm:hover{border-color:var(--bone)}.thm svg{display:block}
  .vbadge{display:inline-flex;vertical-align:-2px;margin-left:4px;color:currentColor}.vbadge svg{display:block}
  .bnav{position:fixed;left:0;right:0;bottom:0;z-index:40;border-top:1px solid var(--b);background:var(--scrim);backdrop-filter:blur(14px)}
  .bninner{max-width:680px;margin:0 auto;display:flex;justify-content:space-around;align-items:center;padding:11px 6px calc(11px + env(safe-area-inset-bottom))}
  .bnav a{flex:1;max-width:130px;display:flex;align-items:center;justify-content:center;color:var(--mut);padding:3px 0}
  .bnav a.on{color:var(--acc)}
  .bnav a:hover{color:var(--bone)}
  .bnav svg{width:25px;height:25px;display:block}
  /* Desktop: lift the bar into a vertical rail on the LEFT (Instagram pattern),
     sitting in the left gutter so it never overlaps the centred 680px column. */
  @media(min-width:1024px){
    .bnav{top:0;right:auto;bottom:0;width:74px;border-top:0;border-right:1px solid var(--b);background:transparent;backdrop-filter:none}
    .bninner{flex-direction:column;justify-content:flex-start;align-items:center;gap:8px;height:100%;max-width:none;padding:80px 0 0}
    .bnav a{flex:0 0 auto;max-width:none;width:46px;height:46px;border-radius:13px}
    .bnav a.on{background:var(--s)}
    .bnav a:hover{background:var(--s)}
  }
  /* --- polish layer (mobile-first, IG/TikTok idiom) --- */
  .btn,button{transition:transform .12s ease,opacity .12s ease,background .15s ease,border-color .15s ease}
  .btn:active,button:active{transform:scale(.97)}
  .btn:hover,button:hover{opacity:.92}
  /* Global button system: coral-orange CTA fill, softly rounded (not pill).
     body-scoped so it wins over each page's local .btn; ghost/dark stay outline;
     icon controls (.thm/.backx/.hz-back) keep their circular shape. */
  body .btn,body .rb,body button:not(.thm):not(.backx):not(.locbtn){border-radius:var(--btnr)}
  body .btn:not(.ghost):not(.dark){background:var(--acc);color:var(--accink);border-color:var(--acc);font-weight:800}
  body .btn:not(.ghost):not(.dark):hover{background:var(--acc2);border-color:var(--acc2);opacity:1}
  body .rb.p,body .btn.p{background:var(--acc);color:var(--accink);border-color:var(--acc);font-weight:800}
  body .thm,body .backx,body .hz-back,body .locbtn{border-radius:999px}
  .card{transition:border-color .15s ease}
  /* Poster hero: full-bleed media with a legibility scrim + overlaid title */
  .poster{position:relative;margin:0 -18px;height:min(78vw,420px);overflow:hidden}
  .poster>img,.poster>video{width:100%;height:100%;object-fit:cover;display:block}
  .poster::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--ink) 2%,rgba(11,11,12,.35) 42%,transparent 72%)}
  .poster .pcap{position:absolute;left:18px;right:18px;bottom:16px;z-index:2}
  .poster .pkick{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;background:var(--bone);color:var(--ink);border-radius:999px;padding:4px 11px;margin-bottom:10px}
  .poster .ptitle{font-size:clamp(26px,8vw,42px);font-weight:800;line-height:1.02;letter-spacing:-.01em;text-shadow:0 2px 24px rgba(0,0,0,.5)}
  .poster .pmeta{margin-top:8px;font-size:13px;color:rgba(237,233,223,.85);display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .live-dot{width:8px;height:8px;border-radius:50%;background:#e5484d;box-shadow:0 0 0 4px rgba(229,72,77,.25);display:inline-block}
  /* Sticky action bar — the persistent primary CTA (event/crowd pages) */
  .actionbar{position:fixed;left:0;right:0;bottom:calc(54px + env(safe-area-inset-bottom));z-index:45;background:var(--scrim);backdrop-filter:blur(16px);border-top:1px solid var(--b);border-bottom:1px solid var(--b);padding:10px 16px}
  .actionbar .abin{max-width:680px;margin:0 auto;display:flex;align-items:center;gap:12px}
  .actionbar .ablabel{flex:1;min-width:0;line-height:1.15}
  .actionbar .abt{font-size:14px;font-weight:800}.actionbar .abs{font-size:11.5px;color:var(--mut)}
  .actionbar .btn,.actionbar button{padding:12px 22px;font-size:15px;white-space:nowrap}
  @media(min-width:1024px){.actionbar{left:74px;bottom:0}}
  /* language pill toggle (settings) */
  .lgtog{display:inline-flex;gap:2px;border:1px solid var(--b);border-radius:999px;padding:2px;background:transparent}
  .lgp{font-size:11.5px;font-weight:700;letter-spacing:.3px;color:var(--mut);border-radius:999px;padding:4px 11px}
  .lgp.on{background:var(--bone);color:var(--ink)}
  .lgp:not(.on):hover{color:var(--bone)}
  /* TikTok-style desktop left rail (labelled). Hidden on mobile; the bottom
     tab bar takes over there. Shown from 1024px, sitting in the left gutter. */
  /* consistent floating back button (no page headers) — top-left, over content;
     offset past the rail on desktop so it never overlaps the nav. */
  .hz-back{position:fixed;top:12px;left:12px;z-index:60;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:1px solid var(--b);background:var(--scrim);backdrop-filter:blur(10px);color:var(--bone);text-decoration:none;cursor:pointer;padding:0}
  .hz-back:hover{border-color:var(--bone)}.hz-back svg{display:block}
  .drail{display:none}
  @media(min-width:1024px){
    .drail{display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;width:236px;border-right:1px solid var(--b);background:var(--ink);padding:20px 14px 16px;z-index:50;overflow-y:auto}
    body.deskrail{padding-left:236px}
    body.deskrail .bnav{display:none}
    body.deskrail .top{display:none}
    body.deskrail .hz-back{left:250px}   /* clear the fixed rail */
  }
  .dr-logo{display:flex;align-items:center;gap:9px;padding:2px 8px 16px;color:var(--bone);text-decoration:none}
  .dr-logo b{font-size:19px;font-weight:800;letter-spacing:-.02em}
  .dr-search{display:block;margin:0 4px 14px}
  .dr-search input{width:100%;background:var(--s);border:1px solid var(--b);border-radius:999px;color:var(--bone);padding:9px 14px;font:inherit;font-size:13px}
  .dr-search input:focus{outline:none;border-color:var(--bone)}.dr-search input::placeholder{color:var(--mut)}
  .dr-nav{display:flex;flex-direction:column;gap:2px}
  .dr-item{display:flex;align-items:center;gap:14px;padding:11px 12px;border-radius:12px;color:var(--bone);font-size:16px;font-weight:600;text-decoration:none}
  .dr-item svg{width:26px;height:26px;flex:0 0 auto}
  .dr-item:hover{background:var(--s)}
  /* selected nav = coral-orange accent (label + icon + badge), never underlined */
  .dr-item.on,.dr-item.on svg{color:var(--acc)}
  .dr-item .dr-badge{margin-left:auto;background:var(--acc);color:#fff;font-size:11px;font-weight:800;min-width:19px;height:19px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
  .dr-sep{height:1px;background:var(--b);margin:14px 8px}
  .dr-set{display:flex;flex-direction:column;gap:10px;padding:0 8px}
  .dr-srow{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .dr-slabel{font-size:13px;color:var(--mut);font-weight:500}
  .dr-foot{margin-top:auto;padding:14px 8px 4px;display:flex;flex-direction:column;gap:8px}`;

// ---- shared global shell: the SAME top bar + labelled left rail on every page --
// (imports kept local to avoid pulling page renderers into the theme module)
import { ravenMarkCurrent as _ravenMark } from './brand.ts';
import { t as _t, type Lang as _Lang } from './i18n.ts';

const RAIL_ICON = {
  explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z"/></svg>`,
  following: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20c0-3.4 2.7-5.6 5.5-5.6S14.5 16.6 14.5 20"/><path d="M17 8.5v5M14.5 11h5"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.2 5.4 1.8 6.2.3.4 0 .9-.5.9H4.7c-.5 0-.8-.5-.5-.9C4.8 14.4 6 13 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  create: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5.5 20c0-3.7 2.9-6.2 6.5-6.2S18.5 16.3 18.5 20"/></svg>`,
};

// The one consistent back control used on every page (no headers). If `href` is
// given it links there; otherwise it goes back in history (falling back to home).
// Fixed top-left, floating over content / cover — same look everywhere.
export function backButton(href?: string): string {
  const icon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>`;
  return href
    ? `<a class="hz-back" href="${href}" aria-label="Back" title="Back">${icon}</a>`
    : `<button type="button" class="hz-back" aria-label="Back" title="Back" onclick="if(history.length>1){history.back()}else{location.href='/'}">${icon}</button>`;
}

// The identical TikTok-style labelled left rail on every page (desktop). Mobile
// keeps the bottom tab bar. `active` ∈ explore|following|notifications|create|profile.
export function deskRail(o: { guest: boolean; fanId: string | null; lang?: _Lang; unread?: number; active?: string; region?: string; sport?: string }): string {
  const lang = o.lang ?? 'en';
  const unread = o.unread ?? 0;
  const followHref = o.guest ? '/signup' : '/following';
  const item = (key: string, href: string, icon: string, label: string, badge = '') => {
    const on = o.active === key;
    return `<a class="dr-item${on ? ' on' : ''}" href="${href}"${on ? ' aria-current="page"' : ''}>${icon}<span>${label}</span>${badge}</a>`;
  };
  return `<aside class="drail">
    <a class="dr-logo" href="/" aria-label="Horda">${_ravenMark(26)}<b>Horda</b></a>
    <form class="dr-search" method="get" action="/">${o.sport ? `<input type="hidden" name="sport" value="${o.sport}">` : ''}<input name="region" value="${o.region ?? ''}" placeholder="${_t(lang, 'search_ph')}" autocomplete="off" aria-label="${_t(lang, 'search_ph')}"></form>
    <nav class="dr-nav" aria-label="Primary">
      ${item('explore', '/', RAIL_ICON.explore, _t(lang, 'explore'))}
      ${item('following', followHref, RAIL_ICON.following, _t(lang, 'following'))}
      ${o.guest ? '' : item('notifications', '/notifications', RAIL_ICON.bell, _t(lang, 'notifications'), unread ? `<span class="dr-badge">${unread > 9 ? '9+' : unread}</span>` : '')}
      ${item('create', '/create', RAIL_ICON.create, _t(lang, 'create_event'))}
      ${item('profile', '/settings', RAIL_ICON.profile, _t(lang, 'profile'))}
    </nav>
    <div class="dr-sep"></div>
    <div class="dr-set"><div class="dr-srow"><span class="dr-slabel">${_t(lang, 'language')}</span>${langToggle(lang)}</div></div>
    <div class="dr-foot">${o.guest
      ? `<a class="btn ghost" href="/login">${_t(lang, 'login')}</a><a class="btn" href="/signup">${_t(lang, 'join_free')}</a>`
      : `<a class="btn" href="/fan/${o.fanId ?? ''}">${_t(lang, 'your_feed')} →</a>`}</div>
  </aside>`;
}

// Universal Share button — native share sheet where available (mobile / social),
// otherwise copies the current page link to the clipboard. Self-contained: the
// URL is read from location.href at click time, so it works on any page.
// A share button. By default it shares the current page URL anonymously. Pass a
// `url` (path or absolute) to share a specific link — e.g. an attributable
// /e/:id?via=<token> so claims get credited to the sharer.
export function shareButton(o: { title?: string; cls?: string; label?: string; url?: string } = {}): string {
  const t = (o.title || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const u = (o.url || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const icon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.9 7.1-3.8M8.2 13.1l7.1 3.8"/></svg>`;
  // data-u is a path or absolute URL; resolve it against the origin at click time.
  const onclick = `(function(b){var r=b.getAttribute('data-u'),u=r?(r.charAt(0)==='/'?location.origin+r:r):location.href,t=b.getAttribute('data-t')||document.title;if(navigator.share){navigator.share({title:t,url:u}).catch(function(){})}else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(function(){var o=b.innerHTML;b.innerHTML='Link copied ✓';setTimeout(function(){b.innerHTML=o},1600)})}else{prompt('Copy this link',u)}})(this)`;
  return `<button type="button" class="${o.cls || 'btn ghost sm'}" data-t="${t}"${u ? ` data-u="${u}"` : ''} aria-label="Share" onclick="${onclick}">${icon}${o.label || 'Share'}</button>`;
}

// Small DE/EN pill toggle. Each pill links to /set-lang; the server returns to the
// page you were on (via ?next= when known, else the Referer). Persisted as a cookie.
export function langToggle(lang: 'en' | 'de', next?: string): string {
  const q = next ? `&next=${encodeURIComponent(next)}` : '';
  const pill = (l: 'en' | 'de', txt: string) =>
    `<a class="lgp${lang === l ? ' on' : ''}" href="/set-lang?l=${l}${q}" aria-label="${l === 'de' ? 'Deutsch' : 'English'}">${txt}</a>`;
  return `<span class="lgtog" role="group" aria-label="Language">${pill('de', 'DE')}${pill('en', 'EN')}</span>`;
}

// A small "verified / official page" seal — uses currentColor so it reads on any
// surface. Shown on pages that have been claim-verified (real trust signal).
export function verifiedBadge(): string {
  return `<span class="vbadge" title="Verified — official page" aria-label="verified"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.4"/><path d="m5.3 8.2 1.8 1.8 3.7-3.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}

// Instagram-style persistent bottom tab bar. Familiar icons, clear active state.
const NAV_ICON = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.6 12 3l9 7.6"/><path d="M5.2 9.4V20h13.6V9.4"/></svg>`,
  explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.7-3.7"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20S3 14.6 3 8.9C3 6 5.1 4 7.7 4c1.8 0 3.3 1 4.3 2.4C13 5 14.5 4 16.3 4 18.9 4 21 6 21 8.9 21 14.6 12 20 12 20Z"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5.5 20c0-3.7 2.9-6.2 6.5-6.2S18.5 16.3 18.5 20"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8.5v7M8.5 12h7"/></svg>`,
};
// `createHref` is set only for creators (someone who owns a page) — that's the
// "+" beside the heart. Plain fans never see a create/publish entry.
export function bottomNav(o: { active?: string; guest: boolean; fanId: string | null; createHref?: string }): string {
  // Heart = Following / My Hordas (who you follow); Person = You / your profile.
  const you = o.guest ? '/signup' : `/fan/${o.fanId ?? ''}`;
  const following = o.guest ? '/signup' : '/following';
  const tab = (key: string, href: string, label: string, icon: string) =>
    `<a href="${href}" class="${o.active === key ? 'on' : ''}" aria-label="${label}" title="${label}"${o.active === key ? ' aria-current="page"' : ''}>${icon}</a>`;
  return `<nav class="bnav" aria-label="Primary"><div class="bninner">
    ${tab('home', '/', 'Home', NAV_ICON.home)}
    ${tab('explore', '/map', 'Explore', NAV_ICON.explore)}
    ${o.createHref ? tab('create', o.createHref, 'Create', NAV_ICON.plus) : ''}
    ${tab('following', following, 'Following — your Hordas', NAV_ICON.heart)}
    ${tab('you', you, 'You', NAV_ICON.person)}
  </div></nav>`;
}

// The persistent primary-action bar (IG/TikTok pattern). `cta` is a button/link
// or a small form. Add class="hasbar" to the page body/wrapper so content clears it.
export function actionBar(o: { title: string; sub?: string; cta: string }): string {
  return `<div class="actionbar"><div class="abin"><div class="ablabel"><div class="abt">${o.title}</div>${o.sub ? `<div class="abs">${o.sub}</div>` : ''}</div>${o.cta}</div></div>`;
}

// Retired: Horda is a single dark "arena" theme with no light mode and no toggle.
// Kept as a no-op so existing call sites render nothing (removed cleanly over time).
export function themeToggle(): string {
  return '';
}
