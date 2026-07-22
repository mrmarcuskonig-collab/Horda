import { startServer } from './src/web/server.ts';
import pw from '/tmp/node_modules/playwright-core/index.js';
const EXE='/sessions/trusting-nifty-einstein/.cache/ms-playwright/chromium-1228/chrome-linux/chrome';
const app=await startServer(0); const base=`http://localhost:${app.port}`;
const b=await (pw as any).chromium.launch({headless:true,executablePath:EXE,env:{...process.env,LD_LIBRARY_PATH:'/tmp/xlibs'},args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--headless=new']});
const ctx=await b.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true});
const p=await ctx.newPage();
p.on('pageerror',(e:any)=>console.log('PAGEERR',String(e).slice(0,120)));
await p.goto(base+'/',{waitUntil:'networkidle'});
const diag=await p.evaluate(()=>({mm:window.matchMedia('(max-width:820px)').matches, hasFn:typeof (window as any).__hzPeekOpen, sheet:!!document.getElementById('hz-peek'), peekScript:document.body.innerHTML.includes('__hzPeekOpen')}));
console.log('diag',JSON.stringify(diag));
const href=await p.$eval('a[href^="/e/"]',(a:any)=>a.getAttribute('href'));
console.log('href',href, 're', /^\/e\/[0-9a-f-]+(\?|$)/i.test(href));
// manual open
await p.evaluate((h)=>(window as any).__hzPeekOpen && (window as any).__hzPeekOpen(h), href);
await p.waitForTimeout(600);
const open=await p.evaluate(()=>({on:document.getElementById('hz-peekscrim')?.classList.contains('on'), body:(document.querySelector('#hz-peek .hz-pkbody')?.innerHTML||'').slice(0,60)}));
console.log('afterManual',JSON.stringify(open));
await b.close();await app.close();process.exit(0);
