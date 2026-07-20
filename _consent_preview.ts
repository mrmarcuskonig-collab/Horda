// _consent_preview.ts — renders the dormant consent step in DE + EN to a standalone
// HTML file for review. Writes to ../_consent_preview.html (outputs root).
import { consentStep, CONSENT_POLICY_VERSION } from './src/web/consent.ts';
import { writeFileSync } from 'node:fs';

const frame = (title: string, inner: string) => `
  <div class="frame">
    <div class="phone">
      <div class="pt">${title}</div>
      <form onsubmit="return false">
        <h1 style="font-size:23px;font-weight:900;letter-spacing:-.02em;margin:2px 0 4px">Create your Horda</h1>
        <p style="color:var(--mut);font-size:13px;margin:0 0 4px">Enter your email — we'll send a code.</p>
        <input placeholder="you@email.com" style="width:100%;box-sizing:border-box;background:#1c1917;border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px 13px;margin:8px 0">
        ${inner}
        <button style="width:100%;background:var(--acc);color:#fff;border:0;border-radius:10px;padding:12px;font-weight:800;font-size:15px;margin-top:6px;cursor:pointer">Continue →</button>
        <p style="text-align:center;color:var(--mut);font-size:11px;margin-top:10px">policy: ${CONSENT_POLICY_VERSION}</p>
      </form>
    </div>
  </div>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Horda — consent step preview (dormant)</title>
<style>
  :root{--ink:#232020;--acc:#E15A40;--bone:#EDE9DF;--mut:#a49e97;--b:#3a3532}
  *{box-sizing:border-box}
  body{margin:0;background:#151312;color:var(--bone);font-family:Inter,system-ui,sans-serif;padding:28px}
  h2.title{font-weight:900;letter-spacing:-.01em;margin:0 0 4px}
  p.sub{color:var(--mut);max-width:640px;line-height:1.55}
  .wrap{display:flex;gap:28px;flex-wrap:wrap;margin-top:22px}
  .frame{flex:0 0 auto}
  .phone{width:380px;background:var(--ink);border:1px solid var(--b);border-radius:20px;padding:20px}
  .pt{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:12px}
  .note{margin-top:8px;padding:12px 14px;border:1px dashed var(--b);border-radius:10px;color:var(--mut);font-size:12.5px;max-width:640px;line-height:1.55}
</style></head><body>
  <h2 class="title">Registration consent step — v1 (dormant, pending legal)</h2>
  <p class="sub">Two low-risk scopes only. Every box is optional and unchecked; the step is non-blocking; each scope is separate; the policy version rides with the form. The monetisable scopes (commercial / AI-licensing) are intentionally absent until counsel designs a compliant, unbundled, minor-safe flow.</p>
  <div class="note"><b>Not wired to capture in production.</b> This is the surface to red-line — the server route that writes <code>rights_grant</code> rows is not built yet. See docs/consent-grant-model-for-legal-review.md.</div>
  <div class="wrap">
    ${frame('English', consentStep('en'))}
    ${frame('Deutsch', consentStep('de'))}
  </div>
</body></html>`;

writeFileSync(new URL('../_consent_preview.html', import.meta.url), html);
console.log('wrote _consent_preview.html');
