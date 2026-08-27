import { writeFileSync } from 'node:fs';
import { renderPitch } from './src/web/pitch.ts';
const O='/sessions/trusting-nifty-einstein/mnt/outputs/';
writeFileSync(O+'furia-athletes-page.html', renderPitch('athletes', true));
writeFileSync(O+'furia-clubs-page.html', renderPitch('clubs', true));
process.exit(0);
