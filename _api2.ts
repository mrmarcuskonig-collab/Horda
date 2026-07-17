import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const r = await fetch(b+'/api/entities?q=ric');
console.log('status', r.status, 'ct', r.headers.get('content-type'));
console.log((await r.text()).slice(0,400));
process.exit(0);
