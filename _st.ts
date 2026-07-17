import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'STEP',starts_at:soon,location_kind:'hybrid',
    fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'25',fmt_inperson_cap:'200',fmt_inperson_maxpp:'4',
    fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://yt/x',fmt_stream1_label:'YouTube'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const p = await (await fetch(b+'/e/'+eid+'?guest=1')).text();
console.log('no dropdown anymore:      ', !p.includes('<select name="party_size'));
console.log('stepper starts at 1:      ', p.includes('class="stepin"') && p.includes('value="1"'));
console.log('has − and + buttons:      ', p.includes('data-d="-1"') && p.includes('data-d="1"'));
console.log('capped at organiser max 4:', p.includes('max="4"'));
console.log('CTA knows the unit price: ', p.includes('data-unit="2500"'));
console.log('CTA template for many:    ', p.includes('Get {n} tickets'));
console.log('stream door: no stepper:  ', (p.match(/class="step"/g)||[]).length===1);
console.log('stepper buttons are type=button (never submit):', !/class="stepbtn"[^>]*type="submit"/.test(p) && p.includes('type="button" class="stepbtn"'));
process.exit(0);
