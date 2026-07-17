import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'FANVIEW',starts_at:soon,location_kind:'hybrid',
    fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'25',fmt_inperson_cap:'200',fmt_inperson_maxpp:'4',
    fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://yt/x',fmt_stream1_label:'YouTube'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const p = await (await fetch(b+'/e/'+eid+'?guest=1')).text();
console.log('fan sees a choice of doors:', p.includes('Choose how you want to be there'));
console.log('  in-person door (€25):    ', p.includes('Get ticket · €25'));
console.log('  stream door (free):      ', p.includes('Stream on YouTube'));
console.log('  quantity picker (max 4): ', p.includes('name="party_size"') && p.includes('4 people'));
console.log('  each door posts a format:', (p.match(/name="format_id"/g)||[]).length===2);
console.log('  per-door remaining:      ', p.includes('200 left'));
console.log('  stream has NO qty picker:', (p.match(/name="party_size"/g)||[]).length===1);
process.exit(0);
