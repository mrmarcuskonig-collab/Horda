import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const ev = (await app.db.query(`SELECT id FROM event WHERE host_kind IS NOT NULL LIMIT 1`)).rows[0].id;
const r = await fetch(`${base}/manage/${ev}`);
console.log('status', r.status);
if (r.status >= 500) { const t = await r.text(); console.log(t.slice(0,500)); }
await app.close();
