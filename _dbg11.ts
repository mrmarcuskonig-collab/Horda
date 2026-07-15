import { startServer } from './src/web/server.ts';
const app:any = await startServer(0);
const base=`http://localhost:${app.port}`, club=app.ids.clubs[0].id;
const r = await fetch(base+`/club/${club}`); const t=await r.text();
console.log('status',r.status); console.log(t.slice(0,500));
process.exit(0);
