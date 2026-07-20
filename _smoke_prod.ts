// _smoke_prod.ts — production smoke test. Run AGAINST THE LIVE SITE after a deploy.
//   BASE_URL=https://your-domain node _smoke_prod.ts
// (the sibling _smoke.ts boots a LOCAL server; this one hits a running instance.)
// Checks what unit tests can't: that the deployed instance booted, the real DB is
// reachable and migrated, core pages render, and the login-email path accepts a
// request. Exits non-zero on any failure — wire it as a post-deploy gate.
const BASE = (process.env.BASE_URL || process.argv[2] || '').replace(/\/$/, '');
if (!BASE) { console.error('usage: BASE_URL=https://your-domain node _smoke_prod.ts'); process.exit(2); }

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, extra = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ·  ' + extra : ''}`); c ? pass++ : fail++; };
const get = async (p: string) => {
  const t0 = Date.now();
  const res = await fetch(BASE + p, { redirect: 'manual', headers: { 'user-agent': 'horda-smoke' } });
  return { status: res.status, ms: Date.now() - t0, text: await res.text().catch(() => ''), res };
};

console.log(`\n[smoke] ${BASE}`);

// 1. Health: DB reachable + migrations at HEAD — the single most important check.
try {
  const h = await get('/healthz');
  let j: any = {}; try { j = JSON.parse(h.text); } catch {}
  ok('/healthz returns 200', h.status === 200, `${h.ms}ms`);
  ok('/healthz reports db reachable', j.db === true);
  ok('/healthz reports migrations at HEAD', j.migrated === true, j.release ? `release ${j.release}` : '');
} catch (e: any) { ok('/healthz reachable at all', false, e?.message); }

// 2. Core pages render (200, no stack trace leaked).
for (const p of ['/', '/map', '/about', '/changelog', '/sitemap.xml', '/robots.txt']) {
  try {
    const r = await get(p);
    const leaked = /ReferenceError|TypeError|is not defined|<pre>[\s\S]*\bat\b/.test(r.text);
    ok(`GET ${p} is healthy`, (r.status === 200 || r.status === 304) && !leaked, `${r.status} ${r.ms}ms`);
  } catch (e: any) { ok(`GET ${p}`, false, e?.message); }
}

// 3. Login-email path accepts a request (proves route + emailer wiring didn't
//    500; does NOT verify delivery — that needs your inbox).
try {
  const r = await fetch(BASE + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'smoke-test@horda.app' }).toString(),
  });
  ok('POST /login accepts a magic-link request (no 500)', r.status < 500, String(r.status));
} catch (e: any) { ok('POST /login reachable', false, e?.message); }

// 4. HTTPS + content-type basics.
ok('served over HTTPS', BASE.startsWith('https://'));
try { const r = await get('/'); ok('home is HTML', /text\/html/.test(r.res.headers.get('content-type') || '')); } catch {}

console.log(`\n──────── smoke: ${pass} passed, ${fail} failed ────────`);
if (fail) console.log('DEPLOY IS NOT HEALTHY — investigate before sending users.');
process.exit(fail ? 1 : 0);
