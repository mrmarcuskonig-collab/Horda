import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const g = (p:string)=>fetch(`http://localhost:${app.port}${p}`).then(r=>r.text());
for (const p of ['/about','/about/creators','/about/features','/about/pricing','/changelog']) {
  const h = await g(p);
  const hasRail = h.includes('class="bnav"') || h.includes('class="drail"');
  console.log(p.padEnd(20), 'rail:', hasRail, '| mnav:', h.includes('class="mnav"'), '| THM(drail css):', h.includes('.drail'));
}
const a = await g('/about');
console.log('--- /about audiences ---');
for (const s of ['Event organisers','Athletes','Clubs &amp; federations','Fans','audcard','Find your outcome','btn acc']) console.log('  ', s.padEnd(24), a.includes(s));
await app.close(); process.exit(0);
