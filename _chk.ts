import { generateProfile } from './src/web/profilegen.ts';
const g = await generateProfile({ kind:'athlete', description:`I'm Rico "The Raven" Vargas, a southpaw welterweight boxer out of Kreuzberg, Berlin. Dark, intense, fight-week.` });
console.log('name:', g.displayName, '| handle:', g.handle, '| headline:', g.headline, '| tagline:', g.tagline);
console.log('cover has RAVEN:', g.cover.toUpperCase().includes('RAVEN'), '| BOXING kicker:', g.cover.toUpperCase().includes('BOXING'));
process.exit(0);
