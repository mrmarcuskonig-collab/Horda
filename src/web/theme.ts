// theme.ts — one identity, two skins. Dark (Ink/Bone) is the default Horda look;
// light is the bright, photo-forward variant. The choice is per-device and
// applied before first paint (no flash). Every page shares these tokens, so the
// whole app flips together.
//
// Usage in a full document:
//   <head><meta charset="utf-8">${THEME_BOOT}
//   <style>${THEME_VARS}${THM_CSS} ...page css...</style></head>
//   ... put ${themeToggle()} in the header nav ...

export const THEME_VARS = `
  :root{color-scheme:dark;--ink:#0B0B0C;--bone:#EDE9DF;--s:rgba(237,233,223,.05);--b:rgba(237,233,223,.16);--mut:rgba(237,233,223,.6);--scrim:rgba(11,11,12,.82)}
  html[data-theme="light"]{color-scheme:light;--ink:#FBF9F4;--bone:#141310;--s:rgba(20,19,16,.045);--b:rgba(20,19,16,.13);--mut:rgba(20,19,16,.56);--scrim:rgba(251,249,244,.82)}
`;

// Runs in <head> before body paint → sets the saved theme with no flash of dark.
export const THEME_BOOT = `<script>try{if(localStorage.getItem('hz_theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}</script>`;

export const THM_CSS = `.thm{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--b);background:transparent;color:var(--bone);cursor:pointer;padding:0;flex:0 0 auto}.thm:hover{border-color:var(--bone)}.thm svg{display:block}
  .vbadge{display:inline-flex;vertical-align:-2px;margin-left:4px;color:currentColor}.vbadge svg{display:block}
  .bnav{position:fixed;left:0;right:0;bottom:0;z-index:40;border-top:1px solid var(--b);background:var(--scrim);backdrop-filter:blur(14px)}
  .bninner{max-width:680px;margin:0 auto;display:flex;justify-content:space-around;align-items:center;padding:11px 6px calc(11px + env(safe-area-inset-bottom))}
  .bnav a{flex:1;max-width:130px;display:flex;align-items:center;justify-content:center;color:var(--mut);padding:3px 0}
  .bnav a.on{color:var(--bone)}
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
  }`;

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
  const following = o.guest ? '/signup' : `/fan/${o.fanId ?? ''}#hordas`;
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

// A round contrast-disc toggle. Flips the <html data-theme> and persists it.
export function themeToggle(): string {
  return `<button type="button" class="thm" aria-label="Switch light or dark theme" title="Switch theme" onclick="(function(d){var l=d.getAttribute('data-theme')==='light';if(l){d.removeAttribute('data-theme')}else{d.setAttribute('data-theme','light')}try{localStorage.setItem('hz_theme',l?'dark':'light')}catch(e){}window.dispatchEvent(new Event('hz-theme'))})(document.documentElement)"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="7.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 1.6a7.4 7.4 0 0 0 0 14.8z" fill="currentColor"/></svg></button>`;
}
