// profilecreate.test.ts — creating a page is a plain form you finish with Save,
// every new page starts on a non-custom URL, and the custom link is claimed
// afterwards with a live availability check.
//
// The three things this file exists to stop regressing:
//   1. removing the AI onboarding removed the ONLY athlete signup path — if this
//      form breaks, nobody can create a page at all
//   2. a page must not be born with a handle chosen up front
//   3. once a handle IS set, every emitted URL must use it (og:url included) —
//      the old code showed the uuid link forever
// Run: node tests/profilecreate.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession } from '../src/db/auth_repo.ts';
import { owns } from '../src/db/auth_repo.ts';
import { setEntityHandle, publicPathFor, publicUrlFor } from '../src/db/handles_repo.ts';
import { updateAthleteIdentity } from '../src/db/engagement_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const enc = (o: Record<string, string>) => new URLSearchParams(o).toString();
const get = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } as any : undefined }).then(r => r.text());
const post = (p: string, body: Record<string, string>, cookie: string) =>
  fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie } as any, body: enc(body) });

// an account that owns nothing yet — the cold-start case that matters
const acct = (await app.db.query<{ id: string }>(`INSERT INTO account (email,display_name) VALUES ('creator@x.com','Creator') RETURNING id`)).rows[0].id;
const cookie = `hz_session=${await createSession(app.db, acct)}`;

console.log('\n[profilecreate · the create form]');
// The athlete form is its own page; the club/federation one lives on v149's
// find-or-create screen. Both must behave the same way.
for (const [kind, path] of [['athlete', '/onboarding/athlete'], ['club', '/onboarding/claim?kind=club'], ['federation', '/onboarding/claim?kind=association']] as const) {
  const form = await get(path, cookie);
  ok(`${kind}: the form is finished with a Save button`, form.includes('>Save</button>'));
  ok(`${kind}: no handle is chosen at creation`, !form.includes('name="handle"'));
  ok(`${kind}: no event slug is chosen at creation either`, !form.includes('name="slug"'));
  ok(`${kind}: asks for a one-line about and a longer description`, form.includes('name="tagline"') && form.includes('name="description"'));
  ok(`${kind}: no AI mood/energy/voice direction survives`, !form.includes('name="mood"') && !form.includes('name="energy"') && !form.includes('name="voice"'));
}

console.log('\n[profilecreate · Save actually creates the page]');
const clubRes = await post('/onboarding/create', { kind: 'club', name: 'FC Neu', tagline: 'Kreuzberg, since 1924', description: 'A grassroots club with four teams and a very loud clubhouse.' }, cookie);
const clubId = (clubRes.headers.get('location') || '').split('/')[2];
ok('club: Save creates it and lands in the editor', clubRes.status === 303 && /^\/club\/[^/]+\/customize$/.test(clubRes.headers.get('location') || ''));
ok('club: the creator owns it instantly', await owns(app.db, acct, 'club', clubId));
ok('club: it starts with NO custom URL', (await app.db.query<{ handle: string | null }>(`SELECT handle FROM club WHERE id=$1`, [clubId])).rows[0].handle === null);
const cb = (await app.db.query<{ tagline: string; description: string }>(`SELECT tagline, description FROM entity_branding WHERE entity_type='club' AND entity_id=$1`, [clubId])).rows[0];
ok('club: the one-liner and the description are stored separately', cb.tagline === 'Kreuzberg, since 1924' && cb.description.includes('clubhouse'));
const clubPage = await get(`/club/${clubId}?guest=1`);
ok('club: both lines render on the public page', clubPage.includes('Kreuzberg, since 1924') && clubPage.includes('clubhouse'));
ok('club: the provenance explainer strip is gone', !clubPage.includes('owner-controlled identity'));

const assocRes = await post('/onboarding/create', { kind: 'federation', name: 'Berliner Verband', tagline: 'Sanctioning Berlin football' }, cookie);
const assocId = (assocRes.headers.get('location') || '').split('/')[2];
ok('federation: Save creates it and lands in the editor', assocRes.status === 303 && /^\/association\/[^/]+\/customize$/.test(assocRes.headers.get('location') || ''));
ok('the editor it lands in is the one that claims the custom URL', (await get(`/association/${assocId}/customize`, cookie)).includes('/link-available?scope=profile'));

console.log('\n[profilecreate · claiming the custom URL afterwards]');
const edit = await get(`/club/${clubId}/customize`, cookie);
ok('the edit page shows the link the page is live on right now', edit.includes(`/club/${clubId}`));
ok('the edit page offers the custom-link field with a live check', edit.includes('name="handle"') && edit.includes('/link-available?scope=profile'));
ok('the live check is debounced and guards against a stale response', edit.includes('setTimeout(check,280)') && edit.includes('if(v!==val())return'));

const avail = (q: string) => fetch(base + q, { headers: { cookie, accept: 'application/json' } as any }).then(r => r.json() as any);
ok('a free handle reads as available', (await avail(`/link-available?scope=profile&kind=club&id=${clubId}&v=fcneu`)).available === true);
ok('a badly-written handle is invalid', (await avail(`/link-available?scope=profile&kind=club&id=${clubId}&v=A%20b!`)).valid === false);
ok('a reserved app route is refused', (await avail(`/link-available?scope=profile&kind=club&id=${clubId}&v=settings`)).reserved === true);
ok('a guest cannot probe the namespace', (await fetch(base + `/link-available?scope=profile&kind=club&id=${clubId}&v=fcneu&guest=1`).then(r => r.json()) as any).valid === false);

await setEntityHandle(app.db, 'club', clubId, 'FC-Neu');
ok('setting a handle normalises it to lowercase', (await app.db.query<{ handle: string }>(`SELECT handle FROM club WHERE id=$1`, [clubId])).rows[0].handle === 'fc-neu');
ok('a taken handle is then unavailable to another page', (await avail(`/link-available?scope=profile&kind=association&id=${assocId}&v=fc-neu`)).available === false);
ok('the page keeps reading as available to ITSELF', (await avail(`/link-available?scope=profile&kind=club&id=${clubId}&v=fc-neu`)).current === true);

console.log('\n[profilecreate · the custom URL is the one we then show]');
ok('publicPathFor prefers the handle', publicPathFor('club', clubId, 'fc-neu') === '/fc-neu');
ok('publicPathFor falls back to the uuid path', publicPathFor('club', clubId, null) === `/club/${clubId}`);
ok('publicUrlFor is absolute', publicUrlFor('https://joinfuria.com', 'club', clubId, 'fc-neu') === 'https://joinfuria.com/fc-neu');
const withHandle = await get(`/club/${clubId}?guest=1`);
const ogUrl = (withHandle.match(/og:url" content="([^"]+)"/) || [])[1] || '';
ok('og:url uses the custom link, not the old uuid one', ogUrl.endsWith('/fc-neu') && !ogUrl.includes(`/club/${clubId}`));
ok('the edit page now shows the custom link back to the owner', (await get(`/club/${clubId}/customize`, cookie)).includes('/fc-neu'));

console.log('\n[profilecreate · athletes obey the same handle rules as clubs]');
const ath = (await app.db.query<{ id: string }>(`INSERT INTO athlete (display_name) VALUES ('Handle Test') RETURNING id`)).rows[0].id;
ok('an athlete can no longer take a reserved app route', !(await updateAthleteIdentity(app.db, ath, { handle: 'settings' })).ok);
ok('an athlete can now use dots and dashes, like a club', (await updateAthleteIdentity(app.db, ath, { handle: 'rico.vargas-jr' })).ok);
ok('an athlete cannot take a handle a club already holds', !(await updateAthleteIdentity(app.db, ath, { handle: 'fc-neu' })).ok);

await app.close();
console.log(`\n──────── profilecreate: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
