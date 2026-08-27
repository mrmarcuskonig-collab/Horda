import { writeFileSync } from 'node:fs';
import { startServer } from './src/web/server.ts';
import { createScheduledEvent } from './src/db/events_repo.ts';
import { addFormat } from './src/db/event_format_repo.ts';
import { notify } from './src/db/notif_repo.ts';
const app: any = await startServer(0);
const base = `http://localhost:${app.port}`;
const rico = app.ids.athletes[0].id;
const db = app.db;
// a LIVE event (started 20 min ago → within the 3h window)
const liveId = await createScheduledEvent(db, { hostKind:'athlete', hostId:rico, title:'Fight Night — LIVE', startsAt:new Date(Date.now()-20*60000).toISOString(), location:'Kreuzberg Boxing, Berlin', admission:'open', locationKind:'hybrid' });
// a multi-format championship
const champId = await createScheduledEvent(db, { hostKind:'athlete', hostId:rico, title:'German Championship Final', startsAt:new Date(Date.now()+7*864e5).toISOString(), location:'Olympiastadion, Berlin', admission:'open', locationKind:'hybrid' });
await addFormat(db,{eventId:champId,kind:'in_person',label:'In person',requiresTicket:true,priceCents:2500,capacity:200,sort:0});
await addFormat(db,{eventId:champId,kind:'stream',label:'TikTok Live',channelUrl:'https://tiktok.com/@x/live',requiresTicket:false,sort:1});
await addFormat(db,{eventId:champId,kind:'stream',label:'Sportdeutschland.TV',channelUrl:'https://sportdeutschland.tv/x',requiresTicket:false,sort:2});
// notifications for the demo fan
const fan = app.ids.fanId;
await notify(db,{fanId:fan,kind:'claim_new',headline:'Alex M. confirmed for German Championship Final — In person.',href:`/manage/${champId}`,eventId:champId});
await notify(db,{fanId:fan,kind:'claim_new',headline:'Sarah K. confirmed for German Championship Final — TikTok Live.',href:`/manage/${champId}`,eventId:champId});
await notify(db,{fanId:fan,kind:'claim_confirmed',headline:"You're confirmed for Fight Night — LIVE.",href:'/',eventId:liveId});
const w = async (name:string,p:string,opts?:any)=>{const t=await (await fetch(base+p,opts)).text();writeFileSync('../'+name,t);console.log(name,t.length);};
await w('furia-DESIGN-erkunden-live.html','/?guest=1');
await w('furia-DESIGN-event-multiformat.html',`/e/${champId}?guest=1`);
await w('furia-DESIGN-notifications.html','/notifications');
await w('furia-DESIGN-create-event.html',`/host/athlete/${rico}/new`);
process.exit(0);
