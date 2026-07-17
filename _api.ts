import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
for (const q of ['ric','fc','beis','x']) {
  const r = await fetch(b+'/api/entities?q='+q);
  const j: any = await r.json();
  console.log(`q=${q.padEnd(5)} status=${r.status}`, (j.results||[]).map((x:any)=>`${x.kind}:${x.name}`).join(', ') || '(none)');
}
const sportRank = await (await fetch(b+'/api/entities?q=r&sport=boxing')).json() as any;
console.log('2-char min (q=r):', JSON.stringify(sportRank.results));
process.exit(0);
