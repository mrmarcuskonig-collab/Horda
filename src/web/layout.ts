// layout.ts — shared chrome for the lighter pages (home, fan feed, sign-up).
// Dark Ink/Bone, matching the profile shell so the whole app is one theme.
import { ravenMark } from './brand.ts';
export const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function layout(title: string, body: string, opts: { back?: string } = {}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.svg"><title>${esc(title)} — Horda</title>
<style>
  :root{color-scheme:dark;--ink:#0B0B0C;--bone:#EDE9DF;--s:rgba(237,233,223,.05);--b:rgba(237,233,223,.16);--mut:rgba(237,233,223,.6)}
  *{margin:0;box-sizing:border-box}
  body{background:var(--ink);color:var(--bone);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.45;max-width:680px;margin:0 auto;padding:0 18px 70px}
  a{color:inherit}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--b);padding:12px 0 9px;position:sticky;top:0;background:var(--ink);z-index:5}
  .mark{display:flex;align-items:center;text-decoration:none}.mark svg{display:block}
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
  button{font:inherit;font-weight:800;letter-spacing:.5px;cursor:pointer;background:var(--bone);color:var(--ink);border:1.5px solid var(--bone);border-radius:999px;padding:9px 16px;font-size:14px}
  button.ghost{background:transparent;color:var(--bone)}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
  .prov{margin-top:28px;color:var(--mut);font-size:11px;border-top:1px solid var(--b);padding-top:12px}
</style></head><body>
  <div class="top"><a class="mark" href="/" aria-label="Horda — home">${ravenMark(30, 'bone')}</a>
  ${opts.back ? `<a class="dt" href="${esc(opts.back)}">← back</a>` : '<span class="dt">system of record</span>'}</div>
  ${body}
</body></html>`;
}
