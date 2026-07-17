import { startServer } from './src/web/server.ts';
const app = await startServer(0); const b='http://127.0.0.1:'+app.port;
const enc=(o:any)=>new URLSearchParams(o).toString();
const sa = await fetch(b+'/signup',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:enc({email:'a@x.com',name:'A',password:'secret123',next:'/onboarding/athlete'})});
const cookie=(sa.headers.get('set-cookie')||'').split(';')[0];
const r = await fetch(b+'/onboarding/athlete',{method:'POST',redirect:'manual',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:enc({name:'The Hawk',handle:'thehawk',tagline:'x',bio:'y',birth_year:'1996',cover:'data:image/svg+xml;utf8,GEN'})});
console.log('status',r.status,'loc',r.headers.get('location'));
if(r.status!==303) console.log((await r.text()).slice(0,400));
process.exit(0);
