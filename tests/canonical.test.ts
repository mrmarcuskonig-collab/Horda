// canonical.test.ts — alias domains 301 to the one canonical host.
//   joinfuria.app (and www, and the old joinfuria.com) → https://joinfuria.com/<same path>
//   the canonical host, the onrender/localhost host, and /healthz pass through.
// Run: node tests/canonical.test.ts
import { startServer } from '../src/web/server.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
// `Host` is a forbidden fetch header, so we simulate the edge via x-forwarded-host —
// which is exactly what Render's proxy sends, and what the app reads first.
const get = (pathname: string, host?: string) =>
  fetch(base + pathname, { redirect: 'manual', headers: host ? { 'x-forwarded-host': host } : {} });

console.log('\n[canonical host redirect]');

// --- .app → .com, path + query preserved ---
const a = await get('/e/abc?via=x', 'joinfuria.app');
ok('joinfuria.app 301s to joinfuria.com', a.status === 301);
ok('…preserving path + query', a.headers.get('location') === 'https://joinfuria.com/e/abc?via=x');

const w = await get('/', 'www.joinfuria.app');
ok('www.joinfuria.app also redirects', w.status === 301 && w.headers.get('location') === 'https://joinfuria.com/');

// --- old brand + www of the canonical also fold in ---
const other = await get('/', 'somewhere-else.com');
ok('an unlisted host is NOT redirected (only listed aliases)', other.status !== 301);
const wc = await get('/', 'www.joinfuria.com');
ok('www.joinfuria.com → apex', wc.status === 301 && wc.headers.get('location') === 'https://joinfuria.com/');

// --- pass-throughs: the canonical host, the platform host, localhost, health ---
const canon = await get('/', 'joinfuria.com');
ok('the canonical host is NOT redirected', canon.status !== 301);
const render = await get('/', 'furia-abc.onrender.com');
ok('the onrender.com host passes through', render.status !== 301);
const local = await get('/');
ok('localhost passes through', local.status !== 301);
const health = await get('/healthz', 'joinfuria.app');
ok('health check is never redirected (checked before host)', health.status !== 301);

await app.close();
console.log(`\n──────── canonical: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
