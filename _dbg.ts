import { startServer } from './src/web/server.ts';
const app = await startServer(0); const base='http://127.0.0.1:'+app.port;
const post=(b:any)=>({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(b).toString(),redirect:'manual' as const});
// start magic link for a new email
const email='newfan_'+Date.now()+'@x.co';
const r1 = await fetch(base+'/auth/start', post({email}));
const html1 = await r1.text();
const code = (html1.match(/Code: <b[^>]*>(\d{6})/)||[])[1];
const link = (html1.match(/\/auth\/verify\?token=([a-f0-9-]+)/)||[])[1];
console.log('start status',r1.status,'code',code,'hasLink',!!link);
// verify via magic link
const r2 = await fetch(base+'/auth/verify?token='+link, {redirect:'manual'});
console.log('verify status',r2.status,'loc',r2.headers.get('location'),'cookie',(r2.headers.get('set-cookie')||'').slice(0,20));
// account created?
const acc = await app.db.query(`SELECT id,email,password_hash FROM account WHERE email=$1`,[email]);
console.log('account', acc.rows[0]);
// OTP path with a second email
const email2='otp_'+Date.now()+'@x.co';
const s2 = await (await fetch(base+'/auth/start', post({email:email2}))).text();
const code2 = (s2.match(/Code: <b[^>]*>(\d{6})/)||[])[1];
const r3 = await fetch(base+'/auth/code', post({email:email2, code:code2}));
console.log('otp login status',r3.status,'loc',r3.headers.get('location'));
process.exit(0);
