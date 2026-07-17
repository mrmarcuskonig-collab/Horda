import { startServer } from './src/web/server.ts';
import { listFormats } from './src/db/event_format_repo.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
// hybrid: hall capped at 2, stream unlimited; 4 tickets per person at the door
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'HYB',starts_at:soon,location_kind:'hybrid',
    fmt_inperson:'1',ip_cost:'free',fmt_inperson_cap:'2',fmt_inperson_maxpp:'4',
    fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://yt/x',fmt_stream1_label:'YouTube'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const fs = await listFormats(app.db, eid);
const ip = fs.find(x=>x.kind==='in_person')!, st = fs.find(x=>x.kind==='stream')!;
const claim = async (fan:string, fmt:string, qty?:string) => {
  const body:any={fan_id:fan,format_id:fmt}; if(qty) body.party_size=qty;
  await fetch(b+`/claim/${eid}`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString()});
};
const mkFan = async (n:string) => (await app.db.query<any>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`,[n])).rows[0].id;
const f1=await mkFan('F1'), f2=await mkFan('F2'), f3=await mkFan('F3');
await claim(f1, ip.id, '2');           // takes 2 of 2 hall spots
await claim(f2, ip.id, '1');           // hall is full → waitlist
await claim(f3, st.id, '1');           // stream must STILL be open
const rows = (await app.db.query<any>(`SELECT fan_id, status, party_size, format_id FROM claim WHERE event_id=$1`,[eid])).rows;
const nm=(id:string)=>id===f1?'F1':id===f2?'F2':'F3';
const fm=(id:string)=>id===ip.id?'in_person':'stream';
console.log("  claims:", rows.length);
for(const r of rows) console.log(`  ${nm(r.fan_id)} → ${fm(r.format_id)} · ${r.status} · party_size=${r.party_size}`);
// over-claim past max_per_person must be clamped, not trusted
const f4=await mkFan('F4'); await claim(f4, st.id, '99');
console.log('  f4 rows:', (await app.db.query<any>(`SELECT count(*)::int n FROM claim WHERE fan_id=$1`,[f4])).rows[0].n);
const over=(await app.db.query<any>(`SELECT party_size FROM claim WHERE fan_id=$1`,[f4])).rows[0];
console.log('  F4 posted party_size=99 on a max-1 stream → stored', over.party_size, '(must be 1)');
process.exit(0);
