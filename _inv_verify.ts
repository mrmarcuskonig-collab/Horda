import { startServer } from './src/web/server.ts';
const app = await startServer(0); const db = app.db;
const q = async (s:string,p:any[]=[]) => (await db.query<any>(s,p)).rows;
// run the exact queries the inventory uses
const accounts = await q(`SELECT id, email, display_name, created_at FROM account ORDER BY created_at`);
const events = await q(`SELECT e.id, e.name AS title, e.host_kind, e.host_id, e.starts_at, e.created_at,
  COALESCE(c.name, t.name, a.name, ath.display_name) AS host_name
  FROM event e
  LEFT JOIN club c ON e.host_kind='club' AND c.id=e.host_id
  LEFT JOIN team t ON e.host_kind='team' AND t.id=e.host_id
  LEFT JOIN association a ON e.host_kind='association' AND a.id=e.host_id
  LEFT JOIN athlete ath ON e.host_kind='athlete' AND ath.id=e.host_id
  ORDER BY e.created_at`);
const clubs = await q(`SELECT id,name FROM club`);
const claims = await q(`SELECT count(*)::int n FROM claim`);
console.log('accounts:', accounts.length, '| events:', events.length, '| clubs:', clubs.length, '| claims:', claims[0].n);
console.log('sample event host_name:', events[0]?.host_name);
console.log('QUERIES-OK');
await app.close(); process.exit(0);
