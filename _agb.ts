import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
for (const p of ['/agb','/widerruf','/terms','/withdrawal']) {
  const r = await fetch(b+p, {redirect:'manual'});
  const t = r.status===200?await r.text():'';
  console.log(p.padEnd(12), r.status, r.status===200?`len=${t.length}`:'');
}
const agb = await (await fetch(b+'/agb')).text();
console.log('\nAGB says Horda is a platform, not the organiser:', agb.includes('Vermittlungsplattform, nicht der Veranstalter'));
console.log('AGB names the 10% take rate:', agb.includes('10%'));
console.log('AGB says tickets are personengebunden:', agb.includes('personengebunden'));
console.log('AGB says resale is NOT offered:', agb.includes('nicht angeboten'));
const w = await (await fetch(b+'/widerruf')).text();
console.log('Widerruf cites § 312g Abs. 2 Nr. 9 BGB:', w.includes('312g Abs. 2 Nr. 9'));
console.log('Widerruf has the Muster form:', w.includes('Muster-Widerrufsformular'));
console.log('AGB linked from the app footer:', (await (await fetch(b+'/')).text()).includes('/agb'));
process.exit(0);
