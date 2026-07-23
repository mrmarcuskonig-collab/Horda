import { startServer } from './src/web/server.ts';
import { writeFileSync } from 'node:fs';
const app = await startServer(0);
for (const [p,f] of [['/about','about'],['/about/creators','about_creators']] as const) {
  const h = await fetch(`http://localhost:${app.port}${p}`).then(r=>r.text());
  writeFileSync(`/sessions/trusting-nifty-einstein/mnt/outputs/${f}_preview.html`, h);
}
await app.close(); process.exit(0);
