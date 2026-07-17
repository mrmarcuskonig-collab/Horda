import { startServer } from './src/web/server.ts';
import * as fs from 'node:fs';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
fs.writeFileSync('/tmp/n_impressum.html', await (await fetch(b+'/impressum')).text());
fs.writeFileSync('/tmp/n_datenschutz.html', await (await fetch(b+'/datenschutz')).text());
fs.writeFileSync('/tmp/n_home.html', await (await fetch(b+'/')).text());
fs.writeFileSync('/tmp/n_empty.html', await (await fetch(b+'/?sport=hyrox&region=Nowhereville')).text());
console.log('ok'); process.exit(0);
