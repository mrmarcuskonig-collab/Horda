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

export const THM_CSS = `${_PEEK_CSS}
.thm{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--b);background:transparent;color:var(--bone);cursor:pointer;padding:0;flex:0 0 auto}.thm:hover{border-color:var(--bone)}.thm svg{display:block}
  .vbadge{display:inline-flex;vertical-align:-2px;margin-left:4px;color:currentColor}.vbadge svg{display:block}
  /* Mobile: a FLOATING translucent bar (the iOS 26 / Instagram pattern) — it
     hovers above the content with the page visibly moving underneath it, rather
     than sitting in an opaque tray welded to the bottom edge. Three things make
     it read as glass: a semi-transparent fill, a real backdrop blur, and a
     saturate() boost so colours behind it stay alive instead of going grey.
     Corner radius is 20px — our button language (--btnr:12px) scaled up for a
     bigger object, deliberately NOT a 999px pill, which would fight the app's
     squarer geometry. */
  .bnav{position:fixed;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:40;
    border:1px solid rgba(255,255,255,.10);border-radius:20px;
    background:color-mix(in srgb, var(--ink) 62%, transparent);
    -webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%);
    box-shadow:0 8px 30px rgba(0,0,0,.38)}
  .bninner{max-width:680px;margin:0 auto;display:flex;justify-content:space-around;align-items:center;padding:10px 6px}
  .bnav a{flex:1;max-width:130px;display:flex;align-items:center;justify-content:center;color:var(--mut);padding:3px 0}
  .bnav a.on{color:var(--acc)}
  .bnav a:hover{color:var(--bone)}
  .bnav svg{width:25px;height:25px;display:block}
  /* No backdrop-filter (older Android/Firefox) → fall back to a near-solid fill
     so the bar stays legible instead of turning into a transparent smear. */
  @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
    .bnav{background:color-mix(in srgb, var(--ink) 94%, transparent)}
  }
  /* Desktop: lift the bar into a vertical rail on the LEFT (Instagram pattern),
     sitting in the left gutter so it never overlaps the centred 680px column. */
  @media(min-width:1024px){
    /* Undo the floating-glass treatment: on desktop this is a flush rail, not a
       hovering pill. Every mobile-only property is explicitly reset here. */
    .bnav{top:0;left:0;right:auto;bottom:0;width:74px;border:0;border-right:1px solid var(--b);border-radius:0;
      background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;box-shadow:none}
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
import { PEEK_CSS as _PEEK_CSS, PEEK_SCRIPT as _PEEK_SCRIPT } from './peek.ts';

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
/**
 * Back means "the page I came from", not "this page's parent".
 *
 * It used to be a plain `<a href={href}>` where href was a SEMANTIC parent — the
 * event page passed the host page, the map passed "/". So map → tap an event →
 * back landed you on the event's ORGANISER, a page you'd never seen. That's the
 * "clicking logic doesn't work" report: the arrow didn't go back, it teleported.
 *
 * Now it prefers real browser history and only falls back to the semantic href
 * when there is none (a cold deep-link, or a crawler). The href is kept as that
 * fallback and as the middle-click / no-JS destination — so it degrades to the
 * old behaviour rather than to nothing, but the common case finally does what the
 * arrow says.
 */
/**
 * The follow / following control, in ONE place.
 *
 * Every entity page rendered a bare "Follow" that never knew you already
 * followed — so a page you follow still begged you to follow it, and the only
 * real action left (unfollow) wasn't offered. This takes the follow state and
 * renders the right thing:
 *   - guest        → "Follow" that routes to signup (carrying the intent)
 *   - not following → POST /follow, labelled "Follow"
 *   - following     → POST /unfollow, labelled "Following ✓" (hover/press = Unfollow)
 *
 * One function so the athlete page, the club/team/association shell and anywhere
 * else can never drift out of sync again. Both /follow and /unfollow redirect
 * back to the referer, so the button flips on the very next render.
 */
export function followControl(o: { guest: boolean; following: boolean; targetType: string; targetId: string; fanId?: string | null; cls?: string; lang?: _Lang }): string {
  const lang = o.lang ?? 'en';
  const cls = o.cls || 'btn';
  if (o.guest) return `<a class="${cls}" href="/signup?follow=${encodeURIComponent(o.targetType + ':' + o.targetId)}">${_t(lang, 'follow')}</a>`;
  const fields = `<input type="hidden" name="fan_id" value="${o.fanId ?? ''}"><input type="hidden" name="target_type" value="${o.targetType}"><input type="hidden" name="target_id" value="${o.targetId}">`;
  if (o.following) {
    // Filled state, and the label flips to "Unfollow" on hover/focus so the
    // destructive action is legible only when you're reaching for it.
    return `<form method="post" action="/unfollow" style="display:inline"><button class="${cls} on hz-following" type="submit" data-following="1"><span class="hzf-is">${_t(lang, 'following_btn')} ✓</span><span class="hzf-un">${_t(lang, 'unfollow')}</span></button></form>${FOLLOW_CSS}`;
  }
  return `<form method="post" action="/follow" style="display:inline">${fields}<button class="${cls}" type="submit">${_t(lang, 'follow')}</button></form>`;
}
const FOLLOW_CSS = `<style>.hz-following .hzf-un{display:none}.hz-following:hover .hzf-is,.hz-following:focus .hzf-is{display:none}.hz-following:hover .hzf-un,.hz-following:focus .hzf-un{display:inline}</style>`;

export function backButton(href?: string): string {
  const icon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>`;
  const dest = href || '/';
  // Back means "the page I came from" — exactly what the browser's own back
  // button does. So: if there's any history, go back; otherwise (a cold deep-link
  // opened as the first page in the tab) fall to the semantic href.
  //
  // WHAT WENT WRONG BEFORE — twice, and this is the diligent version:
  //  1) The first version hardcoded `back = host page`, so map/discover → event →
  //     back teleported to the organiser.
  //  2) The second version gated on `document.referrer` being same-origin. But
  //     the referrer is EMPTY in plenty of real cases (referrer-policy headers,
  //     JS-initiated navigations, privacy settings), so the gate silently failed
  //     and fell through to that same hardcoded href — which, when you own the
  //     event, is YOUR OWN PROFILE. That's the "back sends me to my profile" bug.
  //
  // The fix depends on NOTHING but history length. `event.preventDefault()` (not
  // `return false`, which is unreliable in inline handlers) cancels the link so
  // the href fallback only ever runs when history.back() can't.
  const onclick = `if(history.length>1){event.preventDefault();history.back()}`;
  return `<a class="hz-back" href="${dest}" aria-label="Back" title="Back" onclick="${onclick}">${icon}</a>`;
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
      ${item('explore', '/', RAIL_ICON.explore, _t(lang, 'your_horda'))}
      ${item('following', followHref, RAIL_ICON.following, _t(lang, 'following'))}
      ${o.guest ? '' : item('notifications', '/notifications', RAIL_ICON.bell, _t(lang, 'notifications'), unread ? `<span class="dr-badge">${unread > 9 ? '9+' : unread}</span>` : '')}
      ${item('create', '/create', RAIL_ICON.create, _t(lang, 'create_event'))}
      ${/* Guests get no profile slot — the "Claim your @handle" campaign is
           deferred, and the foot already offers Log in / Sign up. Showing a
           profile item to a logged-out visitor made the signup page look
           logged-in. */
        o.guest ? '' : item('profile', profileHref(o), RAIL_ICON.profile, _t(lang, 'profile'))}
    </nav>
    ${/* English-only: no language toggle. No "your feed" button either — the feed
         IS Your Horda, one nav item up. */''}
    <div class="dr-foot">${o.guest
      ? `<a class="btn ghost" href="/login">${_t(lang, 'login')}</a><a class="btn" href="/signup">${_t(lang, 'join_free')}</a>`
      : ''}</div>
  </aside>${_PEEK_SCRIPT}`;
}

// Universal Share button — native share sheet where available (mobile / social),
// otherwise copies the current page link to the clipboard. Self-contained: the
// URL is read from location.href at click time, so it works on any page.
// A share button. By default it shares the current page URL anonymously. Pass a
// `url` (path or absolute) to share a specific link — e.g. an attributable
// /e/:id?via=<token> so claims get credited to the sharer.
/**
 * Share. When `img` is given, this sends the PICTURE — the whole card — not just
 * a URL.
 *
 * Web Share Level 2 (`navigator.share({files})`) is the only route that puts a
 * real image into WhatsApp, iMessage and, crucially, an Instagram Story. Meta
 * publishes no web intent for Instagram, so without files the honest best we can
 * do is "copy the link and paste it yourself".
 *
 * The ladder, best → worst, degrading only when the browser can't do better:
 *   1. share the file + the link      (mobile Safari/Chrome — the card lands)
 *   2. share the link                 (desktop Safari, older Android)
 *   3. copy the link to the clipboard (everything else)
 * `canShare({files})` is checked BEFORE calling — Firefox/desktop throw on files
 * and the fan would just see a share button that does nothing.
 */
export function shareButton(o: { title?: string; cls?: string; label?: string; url?: string; img?: string; text?: string } = {}): string {
  const e2 = (s: string) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const t = e2(o.title || ''), u = e2(o.url || ''), img = e2(o.img || ''), txt = e2(o.text || '');
  const icon = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.2 10.9 7.1-3.8M8.2 13.1l7.1 3.8"/></svg>`;
  const onclick = `hzShare(this)`;
  return `<button type="button" class="${o.cls || 'btn ghost sm'}" data-t="${t}"${u ? ` data-u="${u}"` : ''}${img ? ` data-img="${img}"` : ''}${txt ? ` data-x="${txt}"` : ''} aria-label="Share" onclick="${onclick}">${icon}${o.label || 'Share'}</button>`;
}

// One implementation for every share button on the page. Inlined per-button
// before, which meant the file-sharing logic would have had to be duplicated
// into every onclick attribute — and would have drifted the first time it changed.
export const SHARE_SCRIPT = `<script>
window.hzShare=function(b){
  var r=b.getAttribute('data-u'), u=r?(r.charAt(0)==='/'?location.origin+r:r):location.href;
  var t=b.getAttribute('data-t')||document.title;
  var x=b.getAttribute('data-x')||t;
  var im=b.getAttribute('data-img');
  var done=function(msg){var o=b.innerHTML;b.innerHTML=msg;setTimeout(function(){b.innerHTML=o},1800)};
  var link=function(){
    if(navigator.share){navigator.share({title:t,text:x,url:u}).catch(function(){})}
    else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(function(){done('Link copied ✓')})}
    else{prompt('Copy this link',u)}
  };
  if(!im||!navigator.canShare){return link()}
  // Fetch the card, then ask whether this browser will actually take a file.
  // Never block the tap on the network: if the card is slow or missing, the link
  // still goes out. A share that fails silently is worse than a plain link.
  var to=setTimeout(link,2500), sent=false;
  fetch(im.charAt(0)==='/'?location.origin+im:im).then(function(r){ if(!r.ok)throw 0; return r.blob() }).then(function(bl){
    if(sent)return; clearTimeout(to);
    var f=new File([bl],'horda-matchday.png',{type:bl.type||'image/png'});
    if(navigator.canShare({files:[f]})){ sent=true; return navigator.share({files:[f],title:t,text:x,url:u}) }
    sent=true; link();
  }).catch(function(){ if(!sent){sent=true;clearTimeout(to);link()} });
};
</script>`;

// Share menu with named targets — WhatsApp, X, Instagram, copy link.
//
// A note on Instagram: there is NO web share intent for it. Meta provides no
// equivalent of wa.me or twitter.com/intent — you cannot hand Instagram a URL
// from the web and have it compose a post. The only real routes are the native
// OS share sheet (which lists Instagram on a phone) or copy-and-paste. So the
// Instagram button copies the link and says so, rather than pretending. On
// mobile the native sheet is offered first, which is the path that actually
// reaches Instagram Stories.
export function shareMenu(o: { url: string; title?: string; text?: string; cls?: string } = { url: '' }): string {
  const esc2 = (s: string) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const u = esc2(o.url);
  const t = esc2(o.title || '');
  const txt = esc2(o.text || o.title || '');
  const ico = (p: string) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">${p}</svg>`;
  const wa = ico('<path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.1 5 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.4z"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/>');
  const x = ico('<path d="M17.5 3h3l-6.6 7.5L21.7 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.6 3h6.2l4.2 5.6L17.5 3zm-1 16.2h1.7L7.6 4.7H5.8l10.7 14.5z"/>');
  const ig = ico('<path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 3.3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 10.7a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm6.8-11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>');
  const link = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.5 1.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5L12.5 17"/></svg>`;
  // Resolve relative → absolute at click time so one snippet works on any page.
  const abs = `(function(r){return r.charAt(0)==='/'?location.origin+r:r})('${u}')`;
  const js = `(function(k,b){var U=${abs},T=${JSON.stringify(txt)};
    if(k==='wa'){open('https://wa.me/?text='+encodeURIComponent(T+' '+U),'_blank','noopener')}
    else if(k==='x'){open('https://twitter.com/intent/tweet?url='+encodeURIComponent(U)+'&text='+encodeURIComponent(T),'_blank','noopener')}
    else if(k==='native'){if(navigator.share){navigator.share({title:T,url:U}).catch(function(){})}}
    else{var f=function(){var o=b.innerHTML;b.innerHTML=(k==='ig'?'Link copied — paste it in Instagram ✓':'Link copied ✓');setTimeout(function(){b.innerHTML=o},2200)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(U).then(f)}else{prompt('Copy this link',U)}}})`;
  return `<div class="shmenu ${o.cls || ''}">
    <button type="button" class="shbtn shnative" onclick="${js}('native',this)" data-t="${t}">Share…</button>
    <button type="button" class="shbtn" onclick="${js}('wa',this)">${wa} WhatsApp</button>
    <button type="button" class="shbtn" onclick="${js}('x',this)">${x} X</button>
    <button type="button" class="shbtn" onclick="${js}('ig',this)">${ig} Instagram</button>
    <button type="button" class="shbtn" onclick="${js}('copy',this)">${link} Copy link</button>
  </div>`;
}

export const SHMENU_CSS = `
  .shmenu{display:flex;flex-wrap:wrap;gap:8px}
  .shmenu .shbtn{display:inline-flex;align-items:center;gap:7px;background:var(--s);border:1px solid var(--b);border-radius:var(--btnr);color:var(--bone);padding:9px 14px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
  .shmenu .shbtn:hover{border-color:var(--bone)}
  /* The native sheet is the only route to Instagram Stories, so lead with it —
     but only where it exists, otherwise it's a dead button. */
  .shmenu .shnative{display:none}
  @media(hover:none) and (pointer:coarse){.shmenu .shnative{display:inline-flex;background:var(--acc);color:var(--accink);border-color:var(--acc)}}`;

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

/**
 * Where the profile nav slot points. NEVER `/fan/` with an empty id.
 *
 * Both navs used `/fan/${o.fanId ?? ''}` behind a `guest` check — correct as long
 * as guest=false always implies a fanId. It doesn't: the marketing pages call
 * bottomNav({ guest, fanId: null }) because they have no fan in scope, so a
 * logged-in visitor on /about got href="/fan/" — a 404 IN THE GLOBAL NAV, on the
 * pages we send strangers to. `?? ''` is how it hid: it turned a missing id into
 * a valid-looking URL instead of an obvious error.
 *
 * Fixed at the helper, not the callers. A nav that CAN emit a broken link is
 * broken by construction — the next caller to pass null would reintroduce it.
 */
function profileHref(o: { guest: boolean; fanId: string | null }): string {
  return (o.guest || !o.fanId) ? '/signup' : `/fan/${o.fanId}`;
}

// Instagram-style persistent bottom tab bar. Familiar icons, clear active state.
const NAV_ICON = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.6 12 3l9 7.6"/><path d="M5.2 9.4V20h13.6V9.4"/></svg>`,
  explore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.7-3.7"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20S3 14.6 3 8.9C3 6 5.1 4 7.7 4c1.8 0 3.3 1 4.3 2.4C13 5 14.5 4 16.3 4 18.9 4 21 6 21 8.9 21 14.6 12 20 12 20Z"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5.5 20c0-3.7 2.9-6.2 6.5-6.2S18.5 16.3 18.5 20"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8.5v7M8.5 12h7"/></svg>`,
  // Mirrors RAIL_ICON.bell so mobile and desktop show the same notifications icon.
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.2 5.4 1.8 6.2.3.4 0 .9-.5.9H4.7c-.5 0-.8-.5-.5-.9C4.8 14.4 6 13 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
};
// `createHref` is set only for creators (someone who owns a page) — that's the
// "+" beside the heart. Plain fans never see a create/publish entry.
// Mobile bottom bar. Mirrors the desktop rail exactly — same five destinations,
// same order, same active key — so the app doesn't feel like two products.
// (It used to have its own set: Home / Map / Create / Following / You.)
export function bottomNav(o: { active?: string; guest: boolean; fanId: string | null; createHref?: string; lang?: _Lang }): string {
  const lang = o.lang ?? 'en';
  const you = o.guest ? '/signup' : profileHref(o);
  const following = o.guest ? '/signup' : '/following';
  const tab = (key: string, href: string, label: string, icon: string) =>
    `<a href="${href}" class="${o.active === key ? 'on' : ''}" aria-label="${label}" title="${label}"${o.active === key ? ' aria-current="page"' : ''}>${icon}</a>`;
  return `<nav class="bnav" aria-label="Primary"><div class="bninner">
    ${tab('home', '/', _t(lang, 'your_horda'), NAV_ICON.home)}
    ${tab('following', following, _t(lang, 'following'), NAV_ICON.heart)}
    ${o.createHref ? tab('create', o.createHref, _t(lang, 'create_event'), NAV_ICON.plus) : ''}
    ${o.guest ? '' : tab('notifications', '/notifications', _t(lang, 'notifications'), NAV_ICON.bell)}
    ${o.guest ? tab('you', '/signup', 'Sign up', NAV_ICON.person) : tab('you', you, _t(lang, 'profile'), NAV_ICON.person)}
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
