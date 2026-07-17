import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'W',starts_at:'2030-01-01T10:00',location_kind:'in_person',fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'18'}).toString()});
console.log('status',r.status,'loc',r.headers.get('location'));
if(r.status!==303) console.log((await r.text()).slice(0,500));
process.exit(0);
