import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const a = await fetch(`http://localhost:${app.port}/about`).then(r=>r.text());
const mark = a.slice(a.indexOf('class="mark"'), a.indexOf('class="mark"')+180).replace(/\n/g,' ');
console.log('mark html:', mark);
console.log('has raven svg + Furia wordmark:', a.includes('aria-label="Furia — home"') && /class="mark"[^>]*>\s*<svg[\s\S]*?<\/svg><b>Furia<\/b>/.test(a));
await app.close(); process.exit(0);
