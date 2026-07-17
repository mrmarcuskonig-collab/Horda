import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'BERLIN 20:00',starts_at:'2030-09-12T20:00',timezone:'Europe/Berlin',
    location_kind:'in_person',location:'Kreuzberg',fmt_inperson:'1',ip_cost:'free'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const row=(await app.db.query<any>(`SELECT starts_at, timezone FROM event WHERE id=$1`,[eid])).rows[0];
console.log('THE FIX, end to end — organiser in Berlin typed 20:00:\n');
console.log('  true instant stored :', new Date(row.starts_at).toISOString(), '(18:00Z = 20:00 CEST ✓)');
const page = await (await fetch(b+'/e/'+eid)).text();
console.log('  event page shows    :', (page.match(/>(\d{2}:\d{2})</)||[])[1] ?? '?');
const ics = await (await fetch(b+'/e/'+eid+'/ics')).text();
const dt=(ics.match(/DTSTART:(\S+)/)||[])[1];
console.log('  ICS DTSTART         :', dt);
console.log('  → in the fan\'s Berlin calendar:', new Date(row.starts_at).toLocaleString('en-GB',{timeZone:'Europe/Berlin'}), '← WAS 21:00, now 20:00');
// the ticket
await fetch(b+`/claim/${eid}`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({}).toString()});
const tok=(await app.db.query<any>(`SELECT pa.token FROM pass pa JOIN claim c ON c.id=pa.claim_id WHERE c.event_id=$1 LIMIT 1`,[eid])).rows[0]?.token;
if(tok){ const pass = await (await fetch(b+'/pass/'+tok)).text();
  console.log('  ticket shows        :', (pass.match(/12 Sept, (\d{2}:\d{2})/)||[])[1] ?? '?', '+ zone label:', /CEST/.test(pass));
  console.log('  ticket says it\'s venue-local:', pass.includes('Local time at the venue')); }
process.exit(0);
