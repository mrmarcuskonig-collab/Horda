import { startServer } from './src/web/server.ts';
import { partyAttribution, shareAttribution, getOrCreateShareToken, recordShareClick } from './src/db/events_repo.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port; const db=app.db;
const h = app.ids.athletes[0].id;
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'ATTR',starts_at:soon,location_kind:'in_person',
    fmt_inperson:'1',ip_cost:'paid',fmt_inperson_price:'25',fmt_inperson_maxpp:'4',archetype:'versus',side_b_name:'FC Rival'}).toString()});
const eid=(r.headers.get('location')||'').replace('/e/','');
const sideB=(await db.query<any>(`SELECT promo_token FROM event_party WHERE event_id=$1 AND side='B'`,[eid])).rows[0].promo_token;
const fan = async(n:string)=>(await db.query<any>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`,[n])).rows[0].id;
// 1. RIVAL PROMO LINK: two people arrive, one brings 3 mates (4 seats)
const a=await fan('A'), c=await fan('C');
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',4,2500,$3)`,[eid,a,'party:'+sideB]);
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',1,2500,$3)`,[eid,c,'party:'+sideB]);
const pa = await partyAttribution(db, eid);
const bRow = pa.rows.find(x=>x.side==='B')!;
console.log('RIVAL SIDE B drove:');
console.log('  identities (people we now know) :', bRow.identities, '(2 accounts ✓)');
console.log('  ticket buyers                   :', bRow.ticketBuyers, '(2 payers ✓)');
console.log('  TICKETS sold                    :', bRow.tickets, '← was reported as 2, truly 5');
console.log('  totals:', JSON.stringify(pa.total));
// 2. FAN SHARE under own name
const sharer=await fan('Sharer'), viaFan=await fan('CameVia');
const tok = await getOrCreateShareToken(db, eid, sharer);
console.log('\nFAN SHARE under own name → token minted:', !!tok);
const clicked = await recordShareClick(db, tok);
console.log('  click attributed back to the sharer:', clicked?.fanId===sharer);
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'claimed',3,2500,$3)`,[eid,viaFan,'via:'+tok]);
const sa = await shareAttribution(db, eid);
console.log('  sharer drove:', JSON.stringify({name:sa[0].name, clicks:sa[0].clicks, identities:sa[0].claims, tickets:sa[0].tickets}), '← 1 identity, 3 tickets');
// 3. refunded/no-show must not count
const d2=await fan('Refunded');
await db.query(`INSERT INTO claim (event_id,fan_id,status,party_size,price_cents,source_edge) VALUES ($1,$2,'refunded',2,2500,$3)`,[eid,d2,'party:'+sideB]);
const pa2 = await partyAttribution(db, eid);
console.log('\nrefunded claims excluded:', pa2.rows.find(x=>x.side==='B')!.tickets===5);
process.exit(0);
