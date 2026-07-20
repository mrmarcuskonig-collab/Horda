// _observe_check.ts — proves /healthz + the clean 500 page + reporting sink.
import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };

const h = await fetch(base + '/healthz');
const j = await h.json();
ok('/healthz 200', h.status === 200);
ok('/healthz db=true', j.db === true);
ok('/healthz migrated=true', j.migrated === true, JSON.stringify(j));

// Reporting sink: point the webhook at a local capture server, force an error,
// confirm a report is POSTed and the USER sees the clean page (no stack trace).
const { createServer } = await import('node:http');
let captured: any = null;
const sink = createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { captured = JSON.parse(b); } catch {} res.end('ok'); }); });
await new Promise<void>(r => sink.listen(0, r));
const sinkPort = (sink.address() as any).port;
process.env.HORDA_ERROR_WEBHOOK = `http://localhost:${sinkPort}`;

const { reportError, errorPage } = await import('./src/web/observe.ts');
reportError(new Error('synthetic boom'), { where: 'test', method: 'GET', path: '/x' });
await new Promise(r => setTimeout(r, 400));
ok('an error is POSTed to the webhook sink', captured != null && /synthetic boom/.test(JSON.stringify(captured)));
ok('the user-facing error page leaks no stack trace', !/at \/|ReferenceError|\.ts:/.test(errorPage()) && /on us/.test(errorPage()));

sink.close();
console.log(`\n──────── observe: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
