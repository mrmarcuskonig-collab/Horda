import { startServer } from './src/web/server.ts';
import { listFormats } from './src/db/event_format_repo.ts';
import { createClaim, formatSpots } from './src/db/claim_rail_repo.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port; const db=app.db;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const mk = async (o:any) => {
  const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'C',starts_at:soon,...o}).toString()});
  const id=(r.headers.get('location')||'').replace('/e/','');
  return {id, ways: await listFormats(db,id)};
};
const fan = async(n:string)=>(await db.query<any>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`,[n])).rows[0].id;

console.log('SCENARIO 1 — hall capped at 10, stream unlimited (your example)');
const A = await mk({location_kind:'hybrid',fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'20',fmt_inperson_cap:'10',fmt_inperson_maxpp:'4',
                    fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://yt/x'});
const ipA=A.ways.find(w=>w.kind==='in_person')!, stA=A.ways.find(w=>w.kind==='stream')!;
console.log('  hall cap:', ipA.capacity, '| stream cap:', stA.capacity, '(null = unlimited ✓)');
const f1=await fan('buys3');
await createClaim(db,{eventId:A.id,fanId:f1,capacity:ipA.capacity,mode:'open',formatId:ipA.id,partySize:3,maxPerPerson:4});
console.log('  someone buys 3 in-person tickets →');
console.log('    hall now  :', JSON.stringify(await formatSpots(db, ipA.id, ipA.capacity)), '← 10-3 = 7 left ✓');
console.log('    stream now:', JSON.stringify(await formatSpots(db, stA.id, stA.capacity)), '← untouched, unlimited ✓');
const f2=await fan('streams');
await createClaim(db,{eventId:A.id,fanId:f2,capacity:stA.capacity,mode:'open',formatId:stA.id,partySize:1,maxPerPerson:1});
console.log('  someone claims the stream →');
console.log('    hall STILL:', (await formatSpots(db, ipA.id, ipA.capacity)).remaining, 'left ← a stream claim must NOT eat a seat ✓');

console.log('\nSCENARIO 2 — webinar: stream capped at 2, no in-person');
const B = await mk({location_kind:'online',fmt_stream:'1',st_cost:'paid',fmt_stream1_price:'8',fmt_stream1_url:'https://zoom/x',fmt_stream1_cap:'2'});
const stB=B.ways[0];
console.log('  stream cap:', stB.capacity, '← organiser decided ✓');
const w1=await fan('w1'), w2=await fan('w2'), w3=await fan('w3');
for (const [n,f] of [['w1',w1],['w2',w2],['w3',w3]] as [string,string][]) {
  const c = await createClaim(db,{eventId:B.id,fanId:f,capacity:stB.capacity,mode:'open',formatId:stB.id,partySize:1,maxPerPerson:1});
  console.log(`    ${n} → ${c.status}`);
}
console.log('  webinar seats:', JSON.stringify(await formatSpots(db, stB.id, stB.capacity)), '← 3rd waitlisted ✓');

console.log('\nSCENARIO 3 — both capped independently');
const C = await mk({location_kind:'hybrid',fmt_inperson:'1',ip_cost:'free',fmt_inperson_cap:'1',fmt_stream:'1',st_cost:'free',fmt_stream1_url:'https://yt/x',fmt_stream1_cap:'1'});
console.log('  hall cap:', C.ways.find(w=>w.kind==='in_person')!.capacity, '| stream cap:', C.ways.find(w=>w.kind==='stream')!.capacity);

console.log('\nSCENARIO 4 — "open to all" stream: a cap is meaningless, must be ignored');
const D = await mk({location_kind:'online',fmt_stream:'1',st_cost:'open',fmt_stream1_url:'https://yt/x',fmt_stream1_cap:'50'});
console.log('  stream cap stored:', D.ways[0].capacity, '← null: nobody claims, so nothing to count ✓');
process.exit(0);
