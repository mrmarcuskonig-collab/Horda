import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
// An organiser in BERLIN types 20:00 for a fight night.
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'TZ TEST',starts_at:'2030-09-12T20:00',location_kind:'in_person',fmt_inperson:'1',ip_cost:'free'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const row=(await app.db.query<any>(`SELECT starts_at FROM event WHERE id=$1`,[eid])).rows[0];
console.log('organiser typed:      2030-09-12 20:00 (meaning 20:00 in Berlin)');
console.log('stored instant:      ', new Date(row.starts_at).toISOString());
console.log('  → in Berlin that is:', new Date(row.starts_at).toLocaleString('en-GB',{timeZone:'Europe/Berlin'}));
const ics = await (await fetch(b+'/e/'+eid+'/ics')).text();
const dt = (ics.match(/DTSTART:(\S+)/)||[])[1];
console.log('ICS says:            ', dt, '(UTC)');
console.log('  → the fan\'s calendar shows:', new Date(row.starts_at).toLocaleString('en-GB',{timeZone:'Europe/Berlin'}), 'in Berlin');
console.log('  → event page shows:  ', (await (await fetch(b+'/e/'+eid)).text()).match(/\d{2}:\d{2}/)?.[0] ?? '(no time)');
console.log('=== is there a timezone column?', (await app.db.query<any>(`SELECT 1 FROM information_schema.columns WHERE table_name='event' AND column_name LIKE '%time%zone%'`)).rows.length > 0);
process.exit(0);
