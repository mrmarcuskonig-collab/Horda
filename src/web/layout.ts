// layout.ts — shared chrome for the lighter pages (home, fan feed, sign-up).
// Dark Ink/Bone, matching the profile shell so the whole app is one theme.
import { ravenMark, ravenMarkCurrent } from './brand.ts';
import { THEME_BOOT, THEME_VARS, THM_CSS, themeToggle, bottomNav, backButton, deskRail, SHARE_SCRIPT } from './theme.ts';
import { MAPS_CSS, MAPS_SCRIPT } from './maps.ts';
import { type Lang } from './i18n.ts';
// map the bottom-nav active key to the labelled rail's active key
const railActive = (a?: string) => a === 'you' ? 'profile' : a === 'home' ? 'explore' : a;
export const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Escape, then turn any pasted http(s) URL into a clickable link. Safe because we
// escape first (the URL text can't contain raw <, >, or quotes after escaping).
export const linkify = (s: string): string =>
  esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, u =>
    `<a href="${u}" target="_blank" rel="noopener nofollow" style="border-bottom:1px solid var(--b)">${u.replace(/^https?:\/\//, '')}</a>`);

// Open Graph + Twitter card meta — so a shared link renders a rich preview
// (image, title, CTA) instead of a bare URL. The acquisition loop runs on this.
// `image` is only emitted when it's an absolute http(s) URL (scrapers ignore
// data: URIs and SVG), so creators with an uploaded photo get the big card.
export function ogMeta(o: { title: string; description: string; url?: string; image?: string | null; type?: string }): string {
  const img = o.image && /^https?:\/\//i.test(o.image) ? o.image : '';
  const t = esc(o.title), d = esc((o.description || '').slice(0, 200)), u = o.url ? esc(o.url) : '';
  return [
    `<meta property="og:site_name" content="Horda">`,
    `<meta property="og:type" content="${esc(o.type || 'website')}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    u ? `<meta property="og:url" content="${u}">` : '',
    img ? `<meta property="og:image" content="${esc(img)}">` : '',
    `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    img ? `<meta name="twitter:image" content="${esc(img)}">` : '',
  ].filter(Boolean).join('\n');
}

// `head` injects per-page <meta> — in practice the OG/Twitter card tags. The
// event page went without them entirely, so every event link ever shared unfurled
// as a bare URL: no picture, no title, nothing to tap toward. Pages that call
// layout() are the shareable ones; they need a way in.
export function layout(title: string, body: string, opts: { back?: string; head?: string; nav?: { active?: string; guest: boolean; fanId: string | null; createHref?: string; lang?: Lang; unread?: number } } = {}): string {
  const nv = opts.nav ?? { guest: true, fanId: null };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Horda</title>${opts.head ?? ''}${THEME_BOOT}
<style>
  ${THEME_VARS}
  ${THM_CSS}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.45;padding:0 18px 96px}
  .hz-main{max-width:680px;margin:0 auto}
  a{color:inherit;text-decoration:none}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--b);padding:12px 0 9px;position:sticky;top:0;background:var(--ink);z-index:5}
  .mark{display:flex;align-items:center;text-decoration:none;color:var(--bone)}.mark svg{display:block}
  h1{font-size:30px;font-weight:800;letter-spacing:.4px;margin:22px 0 2px;text-transform:uppercase}
  h2{font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:800;margin:26px 0 10px;border-bottom:1px solid var(--b);padding-bottom:6px}
  .mut{color:var(--mut)}
  .rec{font-variant-numeric:tabular-nums}
  .big{font-size:40px;font-weight:800;letter-spacing:1px;font-variant-numeric:tabular-nums;margin:6px 0}
  ul{list-style:none}
  li{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--b);font-size:14px}
  li .hl{flex:1}
  .dt{color:var(--mut);font-size:12px;white-space:nowrap}
  .tag{font-size:10.5px;font-weight:800;letter-spacing:1px;border:1.5px solid var(--bone);border-radius:6px;padding:1px 7px;white-space:nowrap}
  .tag.mutd{color:var(--mut);border-color:var(--b);font-weight:700}
  .tag.win,.tag.ok{background:var(--bone);color:var(--ink)}
  .card{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:14px 16px;margin:10px 0}
  .post{font-size:15px}
  table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}
  th,td{text-align:right;padding:7px 4px;border-bottom:1px solid var(--b)}
  th:nth-child(2),td.t{text-align:left}
  th{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}
  td.pts{font-weight:800}
  tr.me{background:var(--bone);color:var(--ink)}
  form{display:inline}
  button{font:inherit;font-weight:800;letter-spacing:.5px;cursor:pointer;background:var(--acc);color:var(--accink);border:1.5px solid var(--acc);border-radius:var(--btnr);padding:9px 16px;font-size:14px}
  button.ghost{background:transparent;color:var(--bone);border-color:var(--b)}
  .btn{display:inline-block;background:var(--acc);color:var(--accink);font-weight:800;border:1.5px solid var(--acc);border-radius:var(--btnr);padding:9px 16px;font-size:14px}
  .btn.ghost{background:transparent;color:var(--bone);border-color:var(--b)}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
  .prov{margin-top:28px;color:var(--mut);font-size:11px;border-top:1px solid var(--b);padding-top:12px}
  .backx{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;border:1.5px solid var(--b);color:var(--bone);font-size:22px;line-height:1;text-decoration:none;padding-bottom:2px}.backx:hover{border-color:var(--bone)}
  ${MAPS_CSS}
</style></head><body class="deskrail">
  ${deskRail({ guest: nv.guest, fanId: nv.fanId, lang: nv.lang, unread: nv.unread, active: railActive(nv.active) })}
  ${opts.back ? backButton(opts.back) : ''}
  <div class="hz-main">
  ${opts.back ? '<div style="height:40px"></div>' : ''}
  ${body}
  </div>
  ${bottomNav(nv)}
  ${SHARE_SCRIPT}
  ${MAPS_SCRIPT}
</body></html>`;
}
