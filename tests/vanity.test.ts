// vanity.test.ts — joinfuria.com/<handle> → a public entity page, URL preserved.
//   * a club/team/federation can claim a vanity handle (globally unique, validated)
//   * /<handle> renders that page (with its events) — no redirect, URL stays pretty
//   * athletes resolve too (they already have @handle)
//   * reserved app routes (/about …) are never hijacked; taken handles are refused
// Run: node tests/vanity.test.ts
import { startServer } from '../src/web/server.ts';
import { updateAthleteIdentity } from '../src/db/engagement_repo.ts';
import { setEntityHandle, resolveEntityHandle } from '../src/db/handles_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string) => fetch(base + p, { redirect: 'manual' }).then(async r => ({ s: r.status, loc: r.headers.get('location'), t: await r.text() }));

console.log('\n[vanity] joinfuria.com/<handle> → the page with all its events');

const clubs = (await app.db.query<{ id: string; name: string }>(`SELECT id, name FROM club ORDER BY created_at LIMIT 2`)).rows;
const c0 = clubs[0], c1 = clubs[1];
const ath = app.ids.athletes[0].id;
const athName = (await app.db.query<{ n: string }>(`SELECT display_name n FROM athlete WHERE id=$1`, [ath])).rows[0].n;

// --- a club claims a vanity handle ---
const set = await setEntityHandle(app.db, 'club', c0.id, 'FC-Rival');
ok('a club can set a vanity handle (normalised to lowercase)', set.ok && (set as any).handle === 'fc-rival');
ok('it resolves to that club', (await resolveEntityHandle(app.db, 'fc-rival'))?.id === c0.id);

// --- the vanity URL renders the club page WITHOUT redirecting (URL stays) ---
const page = await get('/fc-rival?guest=1');
ok('joinfuria.com/<handle> renders the club page (200, no redirect)', page.s === 200 && !page.loc && page.t.includes(c0.name));

// --- an athlete handle resolves too (athletes already have @handle) ---
await updateAthleteIdentity(app.db, ath, { handle: 'ricovale' });
ok('an athlete vanity handle resolves', (await resolveEntityHandle(app.db, 'ricovale'))?.kind === 'athlete');
const ap = await get('/ricovale?guest=1');
ok('joinfuria.com/<athlete> renders the athlete page', ap.s === 200 && !ap.loc && ap.t.includes(athName));

// --- reserved app routes are never hijacked by a handle ---
ok('reserved paths (e.g. /about) still render the app route, not a page', (await get('/about')).t.includes('Furia') && !(await get('/about')).t.includes(c0.name));
const bogus = await get('/definitely-not-a-real-handle-xyz');
ok('an unknown handle is a normal 404, not a crash', bogus.s === 404);

// --- global uniqueness + validation ---
ok('a second club cannot take a handle already in use', !(await setEntityHandle(app.db, 'club', c1.id, 'fcrival'.replace('fcrival', 'fc-rival'))).ok);
ok('a reserved word cannot be used as a handle', !(await setEntityHandle(app.db, 'club', c1.id, 'settings')).ok);
ok('an invalid handle is refused', !(await setEntityHandle(app.db, 'club', c1.id, 'a b!')).ok);
const cleared = await setEntityHandle(app.db, 'club', c0.id, '');
ok('clearing the handle removes the vanity URL', cleared.ok && (cleared as any).handle === null && (await resolveEntityHandle(app.db, 'fc-rival')) === null);

// --- the club edit page offers the vanity-link field ---
// (owner-gated; rendered from renderEntityEdit — just check the field + prefix ship)
import { renderEntityEdit } from '../src/web/pages.ts';
const editForm = renderEntityEdit({ kind: 'club', id: c0.id, fanId: 'f', name: c0.name, origin: 'https://joinfuria.com', handle: null });
ok('the club editor shows the "your link" field with the joinfuria.com/ prefix', editForm.includes('name="handle"') && editForm.includes('joinfuria.com/'));

await app.close();
console.log(`\n──────── vanity: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
