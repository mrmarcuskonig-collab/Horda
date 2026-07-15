import { startServer } from './src/web/server.ts';
import { writeFileSync } from 'node:fs';
const app=await startServer(0); const base=`http://localhost:${app.port}`;
const rico=app.ids.athletes[0].id;
writeFileSync('/sessions/trusting-nifty-einstein/mnt/outputs/horda-edit-preview.html', await (await fetch(base+'/athlete/'+rico+'/customize')).text());
console.log('done'); await app.close(); process.exit(0);
