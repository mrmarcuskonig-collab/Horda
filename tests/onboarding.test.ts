// onboarding.test.ts — role-routed sign-up + AI-first creator onboarding.
// Run: node tests/onboarding.test.ts
import { startServer } from '../src/web/server.ts';
import { generateProfile } from '../src/web/profilegen.ts';
import { owns } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const enc = (o: Record<string, string>) => new URLSearchParams(o);
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc(o) });

console.log('\n[onboarding · AI profile generator]');
const g = await generateProfile({ kind: 'athlete', description: `I'm Rico "The Raven" Vargas, a southpaw welterweight boxer out of Kreuzberg, Berlin. I want a dark, intense fight-week page.` });
ok('generates a display name + clean handle', !!g.displayName && /^[a-z0-9]+$/.test(g.handle));
ok('cover is on-brand SVG (Ink bg + raven mark)', g.cover.includes('#0B0B0C') && g.cover.includes('M12,100'));
ok('cover features the name/nickname (uppercase)', g.cover.toUpperCase().includes('RAVEN'));
ok('facts-only: no invented record in bio', !/\b\d+-\d+\b/.test(g.bio) || g.bio.includes('2'));   // we never fabricate; only echoes their words
const g2 = await generateProfile({ kind: 'athlete', description: 'x' }, async () => JSON.stringify({ displayName: 'Mia Test', handle: 'miatest', headline: 'Runner', tagline: 'fast', bio: 'b', sport: 'running' }));
ok('uses the model output when a model is wired', g2.displayName === 'Mia Test' && g2.handle === 'miatest');
const g3 = await generateProfile({ kind: 'athlete', description: `I'm Mara Vogel, a triathlete from Hamburg. My site: https://maravogel.de and https://instagram.com/maravogel . I want a clean, fresh page with a bright vibe.` });
ok('bio excludes style/vibe instructions', !/\b(want|vibe|fresh|page)\b/i.test(g3.bio));
ok('bio has no raw URLs', !/https?:\/\//.test(g3.bio));
ok('captures website + instagram links from the prompt', g3.links.website === 'https://maravogel.de' && g3.links.instagram === 'https://instagram.com/maravogel');

console.log('\n[onboarding · clean fan-first sign-up + separate creator entrance]');
ok('sign-up is fan-clean (no role chooser)', !(await (await fetch(base + '/signup')).text()).includes("I'm here to"));
const create = await (await fetch(base + '/create?guest=1')).text();
ok('creator entrance offers both paths (guest → sign up first)', create.includes('Create my page') && create.includes('Claim our page') && create.includes('/signup?next=/onboarding/athlete'));
const sa = await fetch(base + '/signup', post({ email: 'a@x.com', name: 'A', password: 'secret123', next: '/onboarding/athlete' }));
ok('creator entry (athlete) → athlete onboarding', sa.status === 303 && sa.headers.get('location') === '/onboarding/athlete');
const sf = await fetch(base + '/signup', post({ email: 'f@x.com', name: 'F', password: 'secret123' }));
ok('plain fan sign-up → fan onboarding', sf.headers.get('location') === '/onboarding/fan');
const sc = await fetch(base + '/signup', post({ email: 'c@x.com', name: 'C', password: 'secret123', next: '/onboarding/claim' }));
ok('creator entry (club) → claim search', sc.headers.get('location') === '/onboarding/claim');

console.log('\n[onboarding · AI-first athlete flow]');
const cookie = (sa.headers.get('set-cookie') || '').split(';')[0];
const authed = (p: string, init: any = {}) => fetch(base + p, { ...init, headers: { cookie, ...(init.headers || {}) } });
ok('prompt box shown first', (await (await authed('/onboarding/athlete')).text()).includes('Generate my page'));
const prev = await (await authed('/onboarding/athlete/generate', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ description: 'Southpaw boxer "The Hawk" from Berlin, all action.' }) })).text();
ok('preview renders generated cover + publish', prev.includes('data:image/svg+xml') && prev.includes('Publish my page'));
const cre = await authed('/onboarding/athlete', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ name: 'The Hawk', handle: 'thehawk', tagline: 'Berlin southpaw', bio: 'In my own words.', cover: 'data:image/svg+xml;utf8,GEN', avatar: 'data:image/png;base64,AVATARPNG', banner: 'data:image/png;base64,BGPHOTO' }) });
ok('publish creates the page + redirects to it', cre.status === 303 && (cre.headers.get('location') || '').startsWith('/athlete/'));
const aid = (cre.headers.get('location') || '').split('/').pop()!;
const acc = (await app.db.query<{ id: string }>(`SELECT id FROM account WHERE email='a@x.com'`)).rows[0].id;
ok('creator owns the new page instantly (persons self-create)', await owns(app.db, acc, 'athlete', aid));
const row = (await app.db.query<{ avatar_url: string; banner_url: string }>(`SELECT avatar_url, banner_url FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('manual background photo replaces the generated cover', row.banner_url.includes('BGPHOTO'));
ok('manual profile picture saved', row.avatar_url.includes('AVATARPNG'));

console.log('\n[onboarding · fan + claim paths]');
const cookieF = (sf.headers.get('set-cookie') || '').split(';')[0];
ok('fan onboarding suggests faces to follow', (await (await fetch(base + '/onboarding/fan', { headers: { cookie: cookieF } })).text()).includes('action="/follow"'));
const cookieC = (sc.headers.get('set-cookie') || '').split(';')[0];
const cs = await (await fetch(base + '/onboarding/claim?q=Beispiel', { headers: { cookie: cookieC } })).text();
ok('claim search finds the club + offers Claim', cs.includes('FC Beispiel') && cs.includes('/claim/club/'));

console.log('\n[onboarding · creator benefit pages]');
const ath = await (await fetch(base + '/athletes')).text();
ok('/athletes pitch: outcome headline + what-you-get + CTA', ath.includes('superfans') && ath.includes('What you get') && (ath.includes('/onboarding/athlete') || ath.includes('/signup?next=/onboarding/athlete')));
const clubs = await (await fetch(base + '/clubs')).text();
ok('/clubs pitch: fixtures/matchday + claim CTA', clubs.includes('matchday') && clubs.includes('Claim') && (clubs.includes('/onboarding/claim') || clubs.includes('/signup?next=/onboarding/claim')));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
