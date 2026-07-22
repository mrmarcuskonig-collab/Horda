import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const cols = await app.db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='event' ORDER BY ordinal_position`);
console.log('EVENT COLS:', cols.rows.map(r=>r.column_name).join(', '));
await app.close(); process.exit(0);
