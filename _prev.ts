import { startServer } from './src/web/server.ts';
import * as fs from 'node:fs';
const app = await startServer(0); const base='http://127.0.0.1:'+app.port;
const rico = app.ids.athletes[0].id;
// make the demo fan follow rico so the feed + following page are non-empty
await fetch(base+'/follow', {method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({fan_id:app.ids.fanId,target_type:'athlete',target_id:rico}).toString()});
fs.writeFileSync('/tmp/g_home.html', await (await fetch(base+'/')).text());
fs.writeFileSync('/tmp/g_following.html', await (await fetch(base+'/following?q=rico')).text());
fs.writeFileSync('/tmp/g_customize.html', await (await fetch(base+`/athlete/${rico}/customize`)).text());
fs.writeFileSync('/tmp/g_home_guest.html', await (await fetch(base+'/?guest=1')).text());
console.log('ok');
process.exit(0);
