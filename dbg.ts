import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const aid = (await app.db.query(`SELECT id FROM athlete LIMIT 1`)).rows[0].id;
console.log('athlete id:', aid);
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 7000);
try {
  const r = await fetch(`${base}/athlete/${aid}`, { signal: ctrl.signal });
  const body = await r.text();
  console.log('STATUS', r.status, 'LEN', body.length);
  console.log('HEAD:', body.slice(0, 150));
} catch (e) { console.log('FETCH ERROR:', (e as Error).message); }
clearTimeout(t);
await app.close();
process.exit(0);
