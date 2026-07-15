import { generateProfile } from './src/web/profilegen.ts';
// model that throws (simulates Anthropic API error / bad key / bad model name)
const boom = async () => { throw new Error('anthropic 400'); };
const g1 = await generateProfile({ kind:'athlete', description:'Mara Vogel, triathlete & running influencer from Lisbon.' }, boom as any);
console.log('throwing model → still builds a page:', !!g1.displayName, '| cover:', g1.cover.startsWith('<svg')||g1.cover.includes('svg'));
// model that returns garbage
const junk = async () => 'not json at all';
const g2 = await generateProfile({ kind:'athlete', description:'Boxer "The Hawk" from Berlin.' }, junk as any);
console.log('garbage model → still builds:', !!g2.displayName, '| handle:', g2.handle);
process.exit(0);
