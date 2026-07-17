import { startServer } from './src/web/server.ts';
import { listFormats } from './src/db/event_format_repo.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const mk = async (o:any) => {
  const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'W',starts_at:soon,...o}).toString()});
  const id=(r.headers.get('location')||'').replace('/e/','');
  const ev=(await app.db.query<any>(`SELECT admission,access_mode FROM event WHERE id=$1`,[id])).rows[0];
  const fs=await listFormats(app.db,id);
  return {id, ev, ways: fs.map(x=>`${x.kind}:${x.label}:${x.requiresTicket?('€'+(x.priceCents!/100)):'free'}:cap=${x.capacity??'∞'}:maxpp=${x.maxPerPerson}`)};
};
const A = await mk({location_kind:'in_person',fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'18',fmt_inperson_cap:'100',fmt_inperson_maxpp:'4'});
console.log('IN PERSON paid, 4 per person:', JSON.stringify(A.ev), A.ways);
const B = await mk({location_kind:'hybrid',fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'25',fmt_inperson_cap:'200',fmt_inperson_maxpp:'2',fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://youtube.com/x',fmt_stream1_label:'YouTube'});
console.log('HYBRID both doors:          ', JSON.stringify(B.ev), B.ways);
const C = await mk({location_kind:'online',fmt_stream:'1',st_cost:'open',fmt_stream1_url:'https://yt/x'});
console.log('ONLINE open stream:         ', JSON.stringify(C.ev), C.ways);
const D = await mk({location_kind:'online',fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'9',fmt_stream:'1',st_cost:'paid',fmt_stream1_price:'5',fmt_stream1_url:'https://yt/x'});
console.log('ONLINE (in-person refused): ', JSON.stringify(D.ev), D.ways);
process.exit(0);
