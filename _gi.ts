import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const mk = async (o:any) => {
  const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'T',starts_at:'2030-05-05T19:00',...o}).toString()});
  const id=(r.headers.get('location')||'').replace('/e/','');
  return (await app.db.query<any>(`SELECT admission,access_mode,price_cents,capacity,waitlist_enabled,approval_required,visibility,(SELECT key FROM sport WHERE id=sport_id) sport FROM event WHERE id=$1`,[id])).rows[0];
};
console.log('in_person + free_open  →', JSON.stringify(await mk({location_kind:'in_person',getin:'free_open'})));
console.log('in_person + free_ticket→', JSON.stringify(await mk({location_kind:'in_person',getin:'free_ticket'})));
console.log('in_person + paid       →', JSON.stringify(await mk({location_kind:'in_person',getin:'paid',price:'18,50'})));
console.log('online + watch_open    →', JSON.stringify(await mk({location_kind:'online',getin:'watch_open'})));
console.log('online + watch_claim   →', JSON.stringify(await mk({location_kind:'online',getin:'watch_claim'})));
console.log('paid + approval        →', JSON.stringify(await mk({location_kind:'in_person',getin:'paid',price:'10',approval_required:'1'})));
console.log('capacity off (default) →', JSON.stringify(await mk({location_kind:'in_person',getin:'free_open',capacity:'50'})));
console.log('capacity on + waitlist →', JSON.stringify(await mk({location_kind:'in_person',getin:'free_open',capacity_limited:'1',capacity:'50',waitlist_enabled:'1'})));
console.log('private + sport hyrox  →', JSON.stringify(await mk({location_kind:'in_person',getin:'free_open',visibility:'unlisted',sport:'hyrox'})));
process.exit(0);
