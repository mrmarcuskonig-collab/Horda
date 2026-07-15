import { startServer } from './src/web/server.ts';
import vm from 'node:vm';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
function scripts(html:string){const out:string[]=[];const re=/<script>([\s\S]*?)<\/script>/g;let m;while((m=re.exec(html))){if(m[1].trim())out.push(m[1])}return out;}
for (const path of ['/?guest=1','/map']) {
  const html = await (await fetch(base+path)).text();
  for (const s of scripts(html)) { try { new vm.Script(s); } catch(e){ console.log('SYNTAX ERROR in', path, '→', (e as Error).message); console.log(s.slice(0,200)); } }
  console.log(path, '→ scripts OK:', scripts(html).length, '| datalist:', html.includes('<datalist'), '| locbtn:', html.includes('id="locbtn"'), '| hz-av:', html.includes("className:'hz-av'"));
}
await app.close(); process.exit(0);
