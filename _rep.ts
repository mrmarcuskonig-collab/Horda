import { startServer } from './src/web/server.ts';
import { setRoomConfig, getRoomConfig } from './src/db/hook_repo.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const ev = (await app.db.query<{id:string}>(`SELECT id FROM event ORDER BY starts_at DESC LIMIT 1`)).rows[0].id;
// default state on a fresh event
console.log('room config on a normal event:', JSON.stringify(await getRoomConfig(app.db, ev)));
const before = await fetch(b+'/e/'+ev); console.log('event page (no room):', before.status);
// now enable a room — this is the code path that crashed
await setRoomConfig(app.db, ev, { enabled: true, label: 'Fight Night <Room>' });
const after = await fetch(b+'/e/'+ev); const t = await after.text();
console.log('event page (room ENABLED):', after.status);
console.log('  esc crash gone:', !t.includes('esc is not defined'));
console.log('  label escaped:', t.includes('Fight Night &lt;Room&gt;'));
process.exit(0);
