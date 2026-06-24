import { startServer } from './src/web/server.ts';
const app = await startServer(0); const base=`http://localhost:${app.port}`;
let okN=0, bad=0; const log:string[]=[];
const hit = async (label:string, p:string, init:any={}, want:number[]=[200]) => {
  try { const r = await fetch(base+p,{redirect:'manual',...init}); const good=want.includes(r.status);
    log.push(`${good?'ok ':'XX '} ${r.status}  ${label}`); good?okN++:bad++; return r; }
  catch(e:any){ log.push(`XX ERR ${label} :: ${e.message}`); bad++; return null as any; }
};
const enc=(o:any)=>new URLSearchParams(o);
const F=(o:any)=>({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:enc(o)});

// public pages
for (const p of ['/','/athletes','/clubs','/create','/signup','/login','/map','/?guest=1']) await hit('GET '+p, p, {}, [200]);
const rico = app.ids.athletes[0].id, club = app.ids.clubs[0].id;
await hit('GET athlete', '/athlete/'+rico); await hit('GET club', '/club/'+club);
const ev = (await app.db.query<{id:string}>(`SELECT id FROM event WHERE host_kind IS NOT NULL LIMIT 1`)).rows[0].id;
await hit('GET event', '/e/'+ev);

// FAN journey
const su = await hit('POST signup (fan)', '/signup', F({email:'smoke-fan@x.com',name:'Smoke',password:'secret123'}), [303]);
const cookie = (su.headers.get('set-cookie')||'').split(';')[0];
const C = (o:any={})=>({headers:{cookie,...(o.headers||{})}, ...o});
const fanId = (await app.db.query<{id:string}>(`SELECT f.id FROM fan f JOIN account a ON a.id=f.account_id WHERE a.email='smoke-fan@x.com'`)).rows[0].id;
await hit('GET onboarding/fan', '/onboarding/fan', C(), [200]);
await hit('POST follow', '/follow', C(F({fan_id:fanId,target_type:'athlete',target_id:rico})), [303]);
await hit('POST rsvp', '/rsvp', C(F({fan_id:fanId,event_id:ev,response:'going'})), [303]);
await hit('POST join supporter (stub)', '/join', C(F({fan_id:fanId,owner_kind:'athlete',owner_id:rico,level:'supporter',billing:'monthly'})), [303]);
await hit('GET athlete as member', '/athlete/'+rico, C(), [200]);
await hit('GET fan home', '/fan/'+fanId, C(), [200]);

// CREATOR journey (AI onboarding, no keys → deterministic)
const sc = await hit('POST signup (creator next)', '/signup', F({email:'smoke-ath@x.com',name:'Ath',password:'secret123',next:'/onboarding/athlete'}), [303]);
const cookie2 = (sc.headers.get('set-cookie')||'').split(';')[0];
const C2=(o:any={})=>({headers:{cookie:cookie2,...(o.headers||{})}, ...o});
await hit('GET onboarding/athlete (prompt)', '/onboarding/athlete', C2(), [200]);
await hit('POST generate (AI)', '/onboarding/athlete/generate', C2(F({description:'I\'m Nia "Storm" Okafor, a sprinter from Cologne. https://instagram.com/nia'})), [200]);
const pub = await hit('POST publish page', '/onboarding/athlete', C2(F({name:'Nia Okafor',handle:'niastorm',tagline:'Cologne sprinter',bio:'Fast.',cover:'data:image/svg+xml;utf8,GEN'})), [303]);
const newAth = (pub.headers.get('location')||'').split('/').pop();
await hit('GET new athlete page', '/athlete/'+newAth, C2(), [200]);
await hit('POST create event', '/events', C2(F({host_kind:'athlete',host_id:newAth,title:'Track session',starts_at:'2026-09-01T18:00',admission:'open'})), [303]);
console.log(log.join('\n'));
console.log(`\n──── ${okN} ok · ${bad} errors ────`);
await app.close(); process.exit(0);
