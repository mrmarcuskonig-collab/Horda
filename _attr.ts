import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
// versus event → host is side A, a rival side B, each with a promo token
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'ATTR',starts_at:soon,location_kind:'in_person',fmt_inperson:'1',ip_cost:'free',
    archetype:'versus',side_b_name:'FC Rival'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const parties=(await app.db.query<any>(`SELECT id, role, side, placeholder, promo_token FROM event_party WHERE event_id=$1 ORDER BY role`,[eid])).rows;
console.log('parties + promo tokens:');
for(const p of parties) console.log(`  ${p.role}${p.side?'/'+p.side:''} ${p.placeholder??'(host)'} → ${p.promo_token}`);
const sideB = parties.find((p:any)=>p.side==='B');
// 1. a FAN share under their own name
const fanShare = await fetch(b+`/e/${eid}/share`,{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({}).toString()});
console.log('\nfan "share under my name" →', fanShare.status, fanShare.headers.get('location')?.slice(0,60));
const shares=(await app.db.query<any>(`SELECT token, fan_id FROM event_share WHERE event_id=$1`,[eid])).rows;
console.log('  event_share rows:', shares.length, shares[0]?.token ? '(token minted ✓)' : '(NO TOKEN ✗)');
// 2. someone arrives via that share and claims
if(shares[0]){
  await fetch(b+`/e/${eid}?via=${shares[0].token}`);
  const clicks=(await app.db.query<any>(`SELECT clicks FROM event_share WHERE token=$1`,[shares[0].token])).rows[0];
  console.log('  click recorded  :', JSON.stringify(clicks));
}
// 3. someone arrives via the SIDE B promo link and claims
await fetch(b+`/e/${eid}?p=${sideB.promo_token}`);
const f2=(await app.db.query<any>(`INSERT INTO fan (display_name) VALUES ('Via Rival') RETURNING id`,[])).rows[0].id;
await app.db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,source_edge) VALUES ($1,$2,'claimed',1,$3)`,[eid,f2,`party:${sideB.promo_token}`]);
const edges=(await app.db.query<any>(`SELECT source_edge, count(*)::int n FROM claim WHERE event_id=$1 GROUP BY source_edge`,[eid])).rows;
console.log('\nclaims by source_edge:', JSON.stringify(edges));
// 4. the roll-up the organiser sees
const { partyReach } = await import('./src/db/events_repo.ts').catch(()=>({partyReach:null} as any));
console.log('partyReach exported?', typeof partyReach);
const manage = await (await fetch(b+'/manage/'+eid)).text();
console.log('manage shows the share panel:', manage.includes('promo') || manage.includes('Share panel') || manage.includes('drove'));
process.exit(0);
