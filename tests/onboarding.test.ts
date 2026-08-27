// onboarding.test.ts — role-routed sign-up + creator onboarding.
// The AI describe→generate→preview flow is GONE: creating a page is a plain form
// you finish with Save. These assertions replaced the generateProfile ones.
// Run: node tests/onboarding.test.ts
import { startServer } from '../src/web/server.ts';
import { owns } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const enc = (o: Record<string, string>) => new URLSearchParams(o);
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc(o) });

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

console.log('\n[onboarding · plain athlete create, finished with Save]');
const cookie = (sa.headers.get('set-cookie') || '').split(';')[0];
const authed = (p: string, init: any = {}) => fetch(base + p, { ...init, headers: { cookie, ...(init.headers || {}) } });
const form = await (await authed('/onboarding/athlete')).text();
ok('the create form is a plain form finished with Save', form.includes('>Save</button>'));
ok('no AI generate step survives', !form.includes('Generate my page') && !form.includes('✦'));
ok('no creative-direction pickers survive', !form.includes('name="mood"') && !form.includes('name="energy"') && !form.includes('name="voice"'));
ok('a new page does NOT choose its own URL up front', !form.includes('name="handle"'));
ok('it asks for a one-line about AND a longer description', form.includes('name="tagline"') && form.includes('name="description"'));
ok('it says the custom link comes later', form.includes('joinfuria.com/yourname'));
const gone = await authed('/onboarding/athlete/generate', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ description: 'x' }) });
ok('the old generate endpoint is gone', gone.status === 404);
const cre = await authed('/onboarding/athlete', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ name: 'The Hawk', tagline: 'Berlin southpaw', description: 'Fights out of Kreuzberg. Trains at Boxstall 12.' }) });
ok('Save creates the page + redirects to it', cre.status === 303 && (cre.headers.get('location') || '').startsWith('/athlete/'));
const aid = (cre.headers.get('location') || '').split('/').pop()!;
const acc = (await app.db.query<{ id: string }>(`SELECT id FROM account WHERE email='a@x.com'`)).rows[0].id;
ok('creator owns the new page instantly (persons self-create)', await owns(app.db, acc, 'athlete', aid));
const row = (await app.db.query<{ handle: string | null; tagline: string; description: string }>(`SELECT handle, tagline, description FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('it starts on a non-custom URL (no handle yet)', row.handle === null);
ok('the one-line about is saved', row.tagline === 'Berlin southpaw');
ok('the longer description is saved separately', row.description.includes('Boxstall 12'));
const pub = await (await fetch(base + `/athlete/${aid}?guest=1`)).text();
ok('the athlete page drops the provenance explainer strip', !pub.includes('Athlete-owned profile ·'));

console.log('\n[onboarding · fan + claim paths]');
const cookieF = (sf.headers.get('set-cookie') || '').split(';')[0];
ok('fan onboarding = multi-select follow picker (save to persist)', (await (await fetch(base + '/onboarding/fan', { headers: { cookie: cookieF } })).text()).includes('action="/onboarding/follow"'));
const cookieC = (sc.headers.get('set-cookie') || '').split(';')[0];
const cs = await (await fetch(base + '/onboarding/claim?q=Beispiel', { headers: { cookie: cookieC } })).text();
// search surfaces the existing club (with its logo/name); claimable → Claim button,
// already on Furia → an "On Furia" marker. Either way it's found and a create form exists.
ok('claim search finds the club + shows claim-or-exists', cs.includes('FC Beispiel') && (cs.includes('/claim/club/') || cs.includes('On Furia')));
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
ok('/about/pricing: Luma-style two-tier (Free 5% + Furia Plus 0% fee), config-driven', pr.includes('Furia Free') && pr.includes('Furia Plus') && pr.includes('5% platform fee') && pr.includes('0% platform fee') && !pr.includes('Clubhouse'));
ok('about header is logo-only (no marketing nav bar), logo links back to the app', cr.includes('class="mnav"') && !cr.includes('class="navitem') && /class="mark" href="\/"/.test(cr));
ok('old /athletes + /clubs redirect into /about/creators', (await fetch(base + '/athletes', { redirect: 'manual' })).headers.get('location') === '/about/creators' && (await fetch(base + '/clubs', { redirect: 'manual' })).headers.get('location') === '/about/creators');

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
