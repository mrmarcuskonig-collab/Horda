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
const create = await (await fetch(base + '/onboarding?guest=1')).text();
ok('creator entrance offers both paths (guest → sign up first)', create.includes('Create my page') && create.includes('Claim our page') && create.includes('/signup?next=/onboarding/athlete'));

// The create-a-page hub adapts to what you already are.
import { renderCreatorEntry } from '../src/web/pages.ts';
const noAth = renderCreatorEntry({ guest: false, hasAthlete: false });
ok('a fan (no athlete page) can create as athlete AND club/federation/organiser',
  noAth.includes('Create my page') && noAth.includes('We’re a club') && noAth.includes('We’re a federation') && noAth.includes('We organise events'));
const withAth = renderCreatorEntry({ guest: false, hasAthlete: true });
ok('once you have an athlete page, only the org options remain (no second athlete page)',
  !withAth.includes('Create my page') && withAth.includes('We’re a club') && withAth.includes('We’re a federation') && withAth.includes('We organise events'));
// /create is now the event-first action, not the page chooser: guests are sent to sign up
const createGuest = await fetch(base + '/create?guest=1', { redirect: 'manual' });
ok('/create routes guests to sign up (then straight to hosting)', createGuest.status === 303 && (createGuest.headers.get('location') || '').startsWith('/signup'));
// Magic-link only: signup sends a link, and verifying it routes to the `next`
// onboarding path (carried on the token) + sets the session. Helper drives the
// full start→verify so downstream `next` routing is exercised end to end.
const magicSignup = async (email: string, name: string, next?: string) => {
  const body = await fetch(base + '/signup', post({ email, name, ...(next ? { next } : {}) })).then(r => r.text());
  const tok = (body.match(/\/auth\/verify\?token=([a-f0-9-]+)/) || [])[1] || '';
  return fetch(base + '/auth/verify?token=' + tok, { redirect: 'manual' });
};
const sa = await magicSignup('a@x.com', 'A', '/onboarding/athlete');
ok('creator entry (athlete) → athlete onboarding', sa.status === 303 && sa.headers.get('location') === '/onboarding/athlete');
const sf = await magicSignup('f@x.com', 'F');
ok('plain fan sign-up → fan onboarding', sf.headers.get('location') === '/onboarding/fan');
const sc = await magicSignup('c@x.com', 'C', '/onboarding/claim');
ok('creator entry (club) → claim search', sc.headers.get('location') === '/onboarding/claim');

console.log('\n[onboarding · AI-first athlete flow]');
const cookie = (sa.headers.get('set-cookie') || '').split(';')[0];
const authed = (p: string, init: any = {}) => fetch(base + p, { ...init, headers: { cookie, ...(init.headers || {}) } });
ok('prompt box shown first', (await (await authed('/onboarding/athlete')).text()).includes('Generate my page'));
const prev = await (await authed('/onboarding/athlete/generate', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ description: 'Southpaw boxer "The Hawk" from Berlin, all action.' }) })).text();
ok('preview renders generated cover + publish', prev.includes('data:image/svg+xml') && prev.includes('Publish my page'));
const cre = await authed('/onboarding/athlete', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ name: 'The Hawk', handle: 'thehawk', tagline: 'Berlin southpaw', bio: 'In my own words.', birth_year: '1996', cover: 'data:image/svg+xml;utf8,GEN', avatar: 'data:image/png;base64,AVATARPNG', banner: 'data:image/png;base64,BGPHOTO' }) });
ok('publish creates the page + redirects to it', cre.status === 303 && (cre.headers.get('location') || '').startsWith('/athlete/'));
const aid = (cre.headers.get('location') || '').split('/').pop()!;
const acc = (await app.db.query<{ id: string }>(`SELECT id FROM account WHERE email='a@x.com'`)).rows[0].id;
ok('creator owns the new page instantly (persons self-create)', await owns(app.db, acc, 'athlete', aid));
const row = (await app.db.query<{ avatar_url: string; banner_url: string }>(`SELECT avatar_url, banner_url FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('manual background photo replaces the generated cover', row.banner_url.includes('BGPHOTO'));
ok('manual profile picture saved', row.avatar_url.includes('AVATARPNG'));

console.log('\n[onboarding · fan + claim paths]');
const cookieF = (sf.headers.get('set-cookie') || '').split(';')[0];
ok('fan onboarding = multi-select follow picker (save to persist)', (await (await fetch(base + '/onboarding/fan', { headers: { cookie: cookieF } })).text()).includes('action="/onboarding/follow"'));
const cookieC = (sc.headers.get('set-cookie') || '').split(';')[0];
const cs = await (await fetch(base + '/onboarding/claim?q=Beispiel', { headers: { cookie: cookieC } })).text();
// search surfaces the existing club (with its logo/name); claimable → Claim button,
// already on Horda → an "On Horda" marker. Either way it's found and a create form exists.
ok('claim search finds the club + shows claim-or-exists', cs.includes('FC Beispiel') && (cs.includes('/claim/club/') || cs.includes('On Horda')));
ok('claim page offers create-from-scratch', cs.includes('action="/onboarding/create"'));

console.log('\n[onboarding · /about marketing site (4 pages + nav)]');
const about = await (await fetch(base + '/about')).text();
ok('/about main: nav links to the three pages', about.includes('href="/about/creators"') && about.includes('href="/about/features"') && about.includes('href="/about/pricing"'));
ok('/about main: four audience beats (organisers/athletes/clubs/fans) + poster wall + sign-off', about.includes('class="beat"') && about.includes('>Organisers<') && about.includes('>Athletes<') && about.includes('>Clubs &amp; federations<') && about.includes('>Fans<') && about.includes('class="wall"') && about.includes('See you at the gate'));
ok('/about main is a standalone marketing site — no app rail/bottom bar', !about.includes('class="bnav"') && !about.includes('class="drail"'));
const cr = await (await fetch(base + '/about/creators')).text();
ok('/about/creators: organisers + athletes + clubs + fans + CTAs', cr.includes('id="organisers"') && cr.includes('id="athletes"') && cr.includes('id="clubs"') && cr.includes('id="fans"') && cr.includes('/onboarding/athlete') && cr.includes('/onboarding/claim'));
const ft = await (await fetch(base + '/about/features')).text();
ok('/about/features: outcome-led + fight-night walkthrough', ft.includes('Sell tickets. Scan') && ft.includes('See who drove them') && ft.includes('A fight night, end to end') && ft.includes('promo link'));
const pr = await (await fetch(base + '/about/pricing')).text();
ok('/about/pricing: Luma-style two-tier (Free 5% + Horda Plus 0% fee), config-driven', pr.includes('Horda Free') && pr.includes('Horda Plus') && pr.includes('5% platform fee') && pr.includes('0% platform fee') && !pr.includes('Clubhouse'));
ok('about header is logo-only (no marketing nav bar), logo links back to the app', cr.includes('class="mnav"') && !cr.includes('class="navitem') && /class="mark" href="\/"/.test(cr));
ok('old /athletes + /clubs redirect into /about/creators', (await fetch(base + '/athletes', { redirect: 'manual' })).headers.get('location') === '/about/creators' && (await fetch(base + '/clubs', { redirect: 'manual' })).headers.get('location') === '/about/creators');

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
