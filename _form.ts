import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const r = await fetch(b+`/host/athlete/${h}/new`);
const t = await r.text();
console.log('form status', r.status);
if(r.status!==200){ console.log(t.slice(0,300)); process.exit(0); }
for (const [k,v] of [['Event name','Event name'],['public/private top','ev_vis'],['sport top','name="sport"'],['getin radios','name="getin"'],['price hidden','ev_price_wrap'],['capacity opt-in','ev_cap_on'],['waitlist','waitlist_enabled'],['approval','approval_required'],['Genehmigung','Genehmigung'],['details collapsed','<details class="more"'],['lang-restore','sessionStorage'],['geo autofill','/api/geo'],['no old Admission select','name="admission"'],['no 5 stream fields','name="youtube"']] as [string,string][])
  console.log((t.includes(v)?'  yes':'  NO '), k);
process.exit(0);
