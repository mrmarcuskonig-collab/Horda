import { startServer } from './src/web/server.ts';
import * as fs from 'node:fs';
const app = await startServer(0); const base='http://127.0.0.1:'+app.port;
fs.writeFileSync('/tmp/c_changelog.html', await (await fetch(base+'/changelog')).text());
fs.writeFileSync('/tmp/c_about.html', await (await fetch(base+'/about')).text());
console.log('ok');
process.exit(0);
