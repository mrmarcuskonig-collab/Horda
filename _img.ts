import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const h = app.ids.athletes[0].id;
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const soon=new Date(Date.now()+864e5).toISOString().slice(0,16);
const r = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'IMG_EVENT',starts_at:soon,location_kind:'in_person',getin:'free_open',sport:'boxing',cover:png}).toString()});
const id=(r.headers.get('location')||'').replace('/e/','');
const row=(await app.db.query<any>(`SELECT cover_url FROM event WHERE id=$1`,[id])).rows[0];
console.log('1. stored on the event:      ', !!row.cover_url);
const ev = await (await fetch(b+'/e/'+id)).text();
console.log('2. renders on the event page:', ev.includes(row.cover_url.slice(0,40)));
const home = await (await fetch(b+'/')).text();
console.log('3. renders on the home card: ', home.includes('IMG_EVENT') && home.includes(row.cover_url.slice(0,40)));
// and an event WITHOUT an image still gets art, never an empty card
const r2 = await fetch(b+'/events',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({host_kind:'athlete',host_id:h,title:'NOIMG_EVENT',starts_at:soon,location_kind:'in_person',getin:'free_open',sport:'boxing'}).toString()});
const home2 = await (await fetch(b+'/')).text();
console.log('4. no image → generated art: ', home2.includes('NOIMG_EVENT') && home2.includes('class="fimg" src="data:image/svg'));
console.log('5. form has the upload up top:', (await (await fetch(b+`/host/athlete/${h}/new`)).text()).includes('ev_cover_drop'));
process.exit(0);
