import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const r = await app.db.query<any>(`SELECT key FROM sport ORDER BY display_order`);
console.log('sport registry:', r.rows.map((x:any)=>x.key).join(', ') || '(empty)');
process.exit(0);
