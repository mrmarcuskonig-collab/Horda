import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const host = app.ids.athletes[0].id, rival = app.ids.clubs[0].id;
const mk = async (body:any) => {
  const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString()});
  return (r.headers.get('location')||'').replace('/e/','');
};
// 1. rival PICKED from the typeahead → linked to the real club
const e1 = await mk({host_kind:'athlete',host_id:host,title:'Picked rival',starts_at:'2030-01-01T20:00',admission:'open',archetype:'versus',side_b_name:'FC Beispiel',side_b_kind:'club',side_b_id:rival});
const p1 = (await app.db.query<any>(`SELECT role,side,entity_kind,entity_id,placeholder,status FROM event_party WHERE event_id=$1 AND side='B'`,[e1])).rows[0];
console.log('picked rival →', JSON.stringify(p1));
// 2. rival typed free-text → unclaimed placeholder (growth loop preserved)
const e2 = await mk({host_kind:'athlete',host_id:host,title:'Free rival',starts_at:'2030-01-01T20:00',admission:'open',archetype:'versus',side_b_name:'FC Nowhere'});
const p2 = (await app.db.query<any>(`SELECT entity_id,placeholder,status FROM event_party WHERE event_id=$1 AND side='B'`,[e2])).rows[0];
console.log('typed rival  →', JSON.stringify(p2));
// 3. roster: one picked, one free text
const e3 = await mk({host_kind:'athlete',host_id:host,title:'Card',starts_at:'2030-01-01T20:00',admission:'open',archetype:'multi',roster:'Rico, Ghost Guy',roster_ids:`athlete:${host},`});
const p3 = (await app.db.query<any>(`SELECT entity_id,placeholder,status FROM event_party WHERE event_id=$1 AND role='attending_athlete' ORDER BY placeholder NULLS FIRST`,[e3])).rows;
console.log('roster       →', JSON.stringify(p3));
// 4. a forged/garbage id must not link
const e4 = await mk({host_kind:'athlete',host_id:host,title:'Bad id',starts_at:'2030-01-01T20:00',admission:'open',archetype:'versus',side_b_name:'X',side_b_kind:'club',side_b_id:'not-a-uuid'});
const p4 = (await app.db.query<any>(`SELECT entity_id,placeholder,status FROM event_party WHERE event_id=$1 AND side='B'`,[e4])).rows[0];
console.log('bad id       →', JSON.stringify(p4));
process.exit(0);
