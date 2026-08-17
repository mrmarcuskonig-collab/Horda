// createpage.test.ts — "find or create your club/federation/organiser".
//   * live search surfaces existing pages, claimable vs. already-on-Horda
//   * creating from scratch makes a claimed page you own (the bug that was missing)
//   * the page ships live search + claim buttons + a create form + same-name notice
// Run: node tests/createpage.test.ts
import { startServer } from '../src/web/server.ts';
import { searchClaimTargets, createOwnedEntity } from '../src/db/entity_repo.ts';
import { owns } from '../src/db/auth_repo.ts';
import { renderOnboardClaim } from '../src/web/pages.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const acct = app.ids.demoAccountId;

console.log('\n[createpage · find or create an org page]');

// --- an UNCLAIMED club (e.g. seeded / imported) is claimable ---
const uc = (await db.query<{ id: string }>(`INSERT INTO club (name,source,claim_status) VALUES ('Rivertown Rovers','ingested','unclaimed') RETURNING id`, [])).rows[0].id;
const found = await searchClaimTargets(db, 'rivertown');
ok('search finds the club by partial name', found.some(f => f.id === uc));
ok('an unclaimed, unowned club is claimable', found.find(f => f.id === uc)?.claimable === true);

// --- a CLAIMED club is shown but not claimable ---
const cc = (await db.query<{ id: string }>(`INSERT INTO club (name,source,claim_status) VALUES ('Downtown FC','native','claimed') RETURNING id`, [])).rows[0].id;
const f2 = await searchClaimTargets(db, 'downtown');
ok('a claimed club is surfaced but NOT claimable', f2.find(f => f.id === cc)?.claimable === false);

// --- CREATE FROM SCRATCH: the path that was missing ---
const id = await createOwnedEntity(db, acct, 'club', 'Test Wanderers');
const st = (await db.query<{ claim_status: string }>(`SELECT claim_status::text FROM club WHERE id=$1`, [id])).rows[0].claim_status;
ok('createOwnedEntity makes a claimed page', st === 'claimed');
ok('the creator owns it instantly (owner tools, no verification)', await owns(db, acct, 'club', id));

// --- the live-search JSON endpoint ---
const j = await (await fetch(base + '/onboarding/claim/search?q=rivertown')).json();
ok('the search endpoint returns matching items as JSON', Array.isArray(j.items) && j.items.some((i: any) => i.id === uc));
ok('the endpoint flags exact-name matches', (await (await fetch(base + '/onboarding/claim/search?q=' + encodeURIComponent('Downtown FC'))).json()).exact === true);

// --- the create POST actually creates a page (demo fallback account) ---
const r = await fetch(base + '/onboarding/create', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ kind: 'club', name: 'Posted United' }) });
ok('POST /onboarding/create lands in the editor (the AI setup screen is gone)', r.status === 303 && /^\/club\/[^/]+\/customize$/.test(r.headers.get('location') || ''));
ok('POST /onboarding/create inserted the club', (await db.query<{ n: number }>(`SELECT count(*)::int n FROM club WHERE name='Posted United'`, [])).rows[0].n === 1);
const withProse = await fetch(base + '/onboarding/create', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ kind: 'club', name: 'Prose Athletic', tagline: 'One line about us', description: 'The longer version of who we are.' }) });
const proseId = (withProse.headers.get('location') || '').split('/')[2];
const prose = (await db.query<{ tagline: string; description: string }>(`SELECT tagline, description FROM entity_branding WHERE entity_type='club' AND entity_id=$1`, [proseId])).rows[0];
ok('the one-liner and description posted at creation are stored separately', prose?.tagline === 'One line about us' && prose?.description === 'The longer version of who we are.');
ok('a new page starts with NO custom URL', (await db.query<{ handle: string | null }>(`SELECT handle FROM club WHERE id=$1`, [proseId])).rows[0].handle === null);
// event organiser normalises to a club-type page
const ro = await fetch(base + '/onboarding/create', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ kind: 'organizer', name: 'Ring Nights Promotions' }) });
ok('an event organiser is created as a club-type page', /^\/club\/[^/]+\/customize$/.test(ro.headers.get('location') || ''));
// a federation normalises to an association page
const rf = await fetch(base + '/onboarding/create', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ kind: 'federation', name: 'Regional League Board' }) });
ok('a federation is created as an association page', /^\/association\/[^/]+\/customize$/.test(rf.headers.get('location') || ''));

// --- the page markup: live search + claim + create + notice ---
const pg = renderOnboardClaim({ q: 'Rivertown', kind: 'club', results: found, exact: false });
ok('page wires the live-search field to the search endpoint', pg.includes('id="q"') && pg.includes('/onboarding/claim/search'));
ok('page offers a Claim button for a claimable result', pg.includes(`href="/claim/club/${uc}"`));
ok('page offers a create-from-scratch form', pg.includes('action="/onboarding/create"') && pg.includes('name="name"'));
ok('the create form is finished with Save, and carries the page prose', pg.includes('>Save</button>') && pg.includes('name="tagline"') && pg.includes('name="description"'));
ok('the create form does not ask for a custom URL up front', !pg.includes('name="handle"'));
const pgX = renderOnboardClaim({ q: 'Downtown FC', kind: 'club', results: f2, exact: true });
ok('same-name notice shows on an exact match', pgX.includes('already exists on Horda') && !pgX.includes('id="notice" hidden'));
ok('a claimed result shows "On Horda", not a Claim button', pgX.includes('On Horda'));

await app.close();
console.log(`\n──────── createpage: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
