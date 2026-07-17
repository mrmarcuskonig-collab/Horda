import { startServer } from './src/web/server.ts';
import * as fs from 'node:fs';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
fs.writeFileSync('/tmp/t_agb.html', await (await fetch(b+'/agb')).text());
fs.writeFileSync('/tmp/t_wid.html', await (await fetch(b+'/widerruf')).text());
fs.writeFileSync('/tmp/t_create.html', await (await fetch(b+`/host/athlete/${app.ids.athletes[0].id}/new`)).text());
console.log('ok'); process.exit(0);
