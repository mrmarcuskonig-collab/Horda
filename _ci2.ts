import { startServer } from './src/web/server.ts';
import { signup, createSession } from './src/db/auth_repo.ts';
import { listParties } from './src/db/events_repo.ts';
import { sideInviteByToken, acceptSideInvite } from './src/db/coorg_repo.ts';
const app=await startServer(0); const base=`http://localhost:${app.port}`;
const club=app.ids.clubs[0].id;
const form=(o:any,c?:string)=>({method:'POST' as const,redirect:'manual' as const,headers:{'content-type':'application/x-www-form-urlencoded',...(c?{cookie:c}:{})},body:new URLSearchParams(o).toString()});
const mk=await fetch(base+'/events',form({host_kind:'club',host_id:club,title:'Derby',starts_at:'2027-12-01T19:00',timezone:'Europe/Berlin',location_kind:'in_person',location:'Berlin',admission:'open',access_mode:'ticket',archetype:'versus',side_b_name:'FC Rival',fmt_inperson:'1',ip_cost:'open'}));
const evId=(mk.headers.get('location')||'').match(/[0-9a-f]{8}-[0-9a-f-]+/)?.[0]||'';
const sideB=(await listParties(app.db,evId)).find((p:any)=>p.side==='B');
const invBody=await (await fetch(base+`/e/${evId}/party/${sideB.id}/invite`,form({}))).text();
const tok=invBody.match(/join-side\?invite=(i[a-f0-9]+)/)?.[1]||'';
console.log('token:',tok.slice(0,8));
const inv=await signup(app.db,`r_${Date.now()}@x.io`,'Rival','pw123456');
const cookie=`hz_session=${await createSession(app.db,inv.accountId)}`;
// repo-level accept to isolate
const direct=await acceptSideInvite(app.db,{token:tok,accountId:inv.accountId});
console.log('repo acceptSideInvite:',JSON.stringify(direct));
await app.close();process.exit(0);
