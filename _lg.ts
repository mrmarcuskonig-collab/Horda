import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
for (const p of ['/impressum','/datenschutz','/discord','/privacy','/']) {
  const r = await fetch(b+p,{redirect:'manual'});
  const t = r.status===200?await r.text():'';
  console.log(p, r.status, r.status===200?`len=${t.length} ddg=${t.includes('§ 5 Digitale-Dienste-Gesetz')} os=${/os-plattform|ec\.europa\.eu\/consumers\/odr/i.test(t)}`:'→'+r.headers.get('location'));
}
process.exit(0);
