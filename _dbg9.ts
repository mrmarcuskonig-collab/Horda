import { startServer } from './src/web/server.ts';
const app:any = await startServer(0);
const base=`http://localhost:${app.port}`, rico=app.ids.athletes[0].id;
const r = await fetch(base+`/athlete/${rico}`);
const t = await r.text();
console.log('status', r.status, 'len', t.length);
console.log(t.slice(0,600));
process.exit(0);
