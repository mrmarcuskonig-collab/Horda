import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const r = await fetch(b+`/host/athlete/${h}/new`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'Regression Night',starts_at:'2030-09-12T20:00',location:'Kreuzberg',admission:'open',room_enabled:'1',room_label:'Fight <Night>'}).toString()});
console.log('status',r.status,'loc',r.headers.get('location'));
if(r.status!==303){const t=await r.text();console.log(t.slice(0,300));}
process.exit(0);
