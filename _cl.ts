import { startServer } from './src/web/server.ts';
const app = await startServer(0); const base='http://127.0.0.1:'+app.port;
for (const p of ['/changelog','/about','/about/changelog','/']) {
  const r = await fetch(base+p, {redirect:'manual'});
  const t = r.status===200 ? await r.text() : '';
  console.log(p, r.status, r.status===200 ? `len=${t.length} discord=${/discord/i.test(t)} building=${t.includes('Now building')}` : '→'+r.headers.get('location'));
}
process.exit(0);
