import { writeFileSync } from 'node:fs';
import { startServer } from './src/web/server.ts';
const app:any = await startServer(0);
const t = await (await fetch(`http://localhost:${app.port}/map`)).text();
writeFileSync('../furia-DESIGN-event-map.html', t);
console.log('map', t.length, /Event map/.test(t)?'EVENT-MAP':'?', /Creator map/.test(t)?'HAS-CREATOR':'no-creator');
process.exit(0);
