// embed.ts — the embeddable events widget. A club/athlete/association drops one
// <iframe> onto their own website and it shows their upcoming Horda events with
// live "Get tickets" links. Self-contained (its own CSS, no app chrome), frameable
// (we set no X-Frame-Options), and it always reflects the latest events — no manual
// updating. The owner-facing /embed/:kind/:id/code page hands them the snippet.
import { esc, layout } from './layout.ts';

const KIND_PATH: Record<string, string> = { athlete: 'athlete', club: 'club', team: 'team', association: 'association' };
export const embedKinds = Object.keys(KIND_PATH);
export function entityHref(kind: string, id: string): string { return `/${KIND_PATH[kind] ?? 'club'}/${id}`; }

export interface EmbedEvent { id: string; title: string; date?: string; live?: boolean }

// The widget itself — rendered inside the customer's iframe. Deliberately tiny and
// dependency-free so it loads fast and can't be broken by the host page's CSS.
export function renderEmbedWidget(o: { kind: string; id: string; name: string; events: EmbedEvent[]; origin: string }): string {
  const ev = o.origin;
  const rows = o.events.length
    ? o.events.map(e => `<a class="ee" href="${ev}/e/${e.id}" target="_blank" rel="noopener">
        <span class="et"><b>${esc(e.title)}</b>${e.live ? '<i class="lv">● LIVE</i>' : ''}<em>${esc(e.date ?? 'Date TBA')}</em></span>
        <span class="eb">Tickets →</span></a>`).join('')
    : `<div class="empty">No upcoming events right now. <a href="${ev}${entityHref(o.kind, o.id)}" target="_blank" rel="noopener">Follow on Horda →</a></div>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(o.name)} — events</title>
<style>
  :root{--ink:#232020;--bone:#EDE9DF;--mut:rgba(237,233,223,.62);--b:rgba(237,233,223,.16);--acc:#E15A40}
  *{margin:0;box-sizing:border-box}
  body{background:transparent;color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif}
  .wrap{background:var(--ink);border:1px solid var(--b);border-radius:16px;padding:16px;max-width:520px;margin:0 auto}
  .hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}
  .hd h1{font-size:16px;font-weight:800;letter-spacing:-.01em}
  .hd .sub{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);font-weight:700}
  .ee{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--b);text-decoration:none;color:var(--bone)}
  .ee:hover .eb{background:var(--acc);border-color:var(--acc);color:#fff}
  .et{display:flex;flex-direction:column;gap:3px;min-width:0}
  .et b{font-size:14.5px;font-weight:600;line-height:1.25}
  .et em{font-size:12.5px;color:var(--mut);font-style:normal}
  .et .lv{font-size:10px;font-weight:800;color:var(--acc);letter-spacing:.08em;font-style:normal;margin-left:2px}
  .eb{flex:0 0 auto;font-size:12.5px;font-weight:700;border:1px solid var(--b);border-radius:999px;padding:7px 13px;white-space:nowrap;transition:.15s}
  .empty{color:var(--mut);font-size:13.5px;padding:12px 0;border-top:1px solid var(--b)}
  .empty a,.ft a{color:var(--acc);text-decoration:none}
  .ft{margin-top:12px;font-size:11px;color:var(--mut);text-align:right}
</style></head><body>
  <div class="wrap">
    <div class="hd"><h1>${esc(o.name)}</h1><span class="sub">Upcoming events</span></div>
    ${rows}
    <div class="ft">Powered by <a href="${ev}/about" target="_blank" rel="noopener">Horda</a></div>
  </div>
</body></html>`;
}

// The snippet to copy. Given to the owner. The iframe shows a sensible default
// height the customer can change, and always reflects the latest events.
export function embedSnippet(kind: string, id: string, origin: string, name: string): string {
  return `<iframe src="${origin}/embed/${kind}/${id}" title="${esc(name)} — events on Horda" width="100%" height="440" style="border:0;max-width:520px" loading="lazy"></iframe>`;
}

// Owner-facing page: the copy-paste snippet, a live preview, and a link to the
// how-to Q&A. Reached from a managed page ("Embed on your website").
export function renderEmbedCode(o: { kind: string; id: string; name: string; origin: string; fanId: string | null }): string {
  const snippet = embedSnippet(o.kind, o.id, o.origin, o.name);
  const inp = 'width:100%;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:12px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-all';
  const body = `
    <h1>Embed on your website</h1>
    <p class="mut" style="max-width:60ch">Put <b style="color:var(--bone)">${esc(o.name)}</b>'s upcoming events — with live ticket links — straight onto your own site. Paste this once; it updates itself whenever you add or change an event.</p>
    <h2>1 · Copy the code</h2>
    <textarea id="embcode" readonly style="${inp}" rows="3">${esc(snippet)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn" type="button" onclick="var t=document.getElementById('embcode');t.select();navigator.clipboard&&navigator.clipboard.writeText(t.value);this.textContent='Copied ✓'">Copy code</button><a class="btn ghost" href="/about/embed" target="_blank" rel="noopener">How do I add this to my site? →</a></div>
    <h2>2 · Paste it into your page</h2>
    <p class="mut" style="max-width:60ch">Drop it into any HTML block — a website builder's “embed / HTML” element, a WordPress Custom HTML block, Wix, Squarespace, Webflow, or your own site's code. Full step‑by‑step, per builder, is in the <a href="/about/embed" target="_blank" rel="noopener" style="border-bottom:1px solid var(--b)">embed Q&amp;A</a>.</p>
    <h2>Live preview</h2>
    <p class="mut" style="font-size:12.5px">This is exactly what visitors will see:</p>
    <div style="background:#111;border:1px solid var(--b);border-radius:14px;padding:16px;margin-top:8px">
      <iframe src="${o.origin}/embed/${esc(o.kind)}/${esc(o.id)}" title="Preview" width="100%" height="440" style="border:0;max-width:520px" loading="lazy"></iframe>
    </div>
    <p class="prov">The widget is public and read‑only — it shows your events and sends visitors to Horda to get tickets. Nothing about your account is exposed.</p>`;
  return layout('Embed · ' + o.name, body, { back: entityHref(o.kind, o.id), nav: { active: 'you', guest: false, fanId: o.fanId } });
}
