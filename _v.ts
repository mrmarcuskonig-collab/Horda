import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const t = await (await fetch(b+`/host/athlete/${app.ids.athletes[0].id}/new`)).text();
const i = t.indexOf('ev_vis');
console.log(JSON.stringify(t.slice(i-260, i+240)));
process.exit(0);
