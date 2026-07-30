// persona.test.ts — two create-form essentials:
//   1. "Creating as" — an account that runs several personas (an athlete page +
//      clubs) can pick WHICH one hosts the event, right on the form, and switch.
//   2. Side B — the versus rival typeahead is wired and /api/entities answers
//      (deduped), so choosing a rival stays smooth.
// Run: node tests/persona.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession, grantOwnership, ownedEntities } from '../src/db/auth_repo.ts';
import { renderCreateEvent } from '../src/web/events.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } as any : undefined }).then(async r => ({ s: r.status, t: await r.text() }));

const rico = app.ids.athletes[0].id;
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [rico])).rows[0].account_id;
const clubs = (await app.db.query<{ id: string; name: string }>(`SELECT id, name FROM club LIMIT 2`)).rows;
await grantOwnership(app.db, acct, 'club', clubs[0].id);
await grantOwnership(app.db, acct, 'club', clubs[1].id);
const cookie = `hz_session=${await createSession(app.db, acct)}`;

console.log('\n[persona] create-as switcher + side-B typeahead');

// --- ownedEntities now includes the self athlete (account_id) + the two clubs ---
const owned = await ownedEntities(app.db, acct);
ok('ownedEntities lists all personas (self athlete + the two clubs)', owned.some(o => o.kind === 'athlete' && o.id === rico) && owned.filter(o => o.kind === 'club').length >= 2);

// --- the "Creating as" bar always shows the hosting entity; others are switches ---
const asAth = await get(`/host/athlete/${rico}/new`, cookie);
ok('the form shows a prominent "Creating as" host bar', asAth.t.includes('Creating as') && asAth.t.includes('class="hostbar"'));
ok('the other personas are offered as one-tap switches', asAth.t.includes('Switch to') && asAth.t.includes(`/host/club/${clubs[0].id}/new`) && asAth.t.includes(`/host/club/${clubs[1].id}/new`) && asAth.t.includes(clubs[0].name));

const asClub = await get(`/host/club/${clubs[0].id}/new`, cookie);
ok('creating as a club shows that club in the host bar + a switch back to the athlete', asClub.t.includes('class="hostbar"') && asClub.t.includes(clubs[0].name) && asClub.t.includes(`/host/athlete/${rico}/new`));

// --- a single-persona account still names the host, but offers no switches ---
const soloForm = renderCreateEvent('athlete', 'x1', 'Solo Athlete', undefined, null, 'f', { personas: [{ kind: 'athlete', id: 'x1', name: 'Solo Athlete' }] });
ok('a one-persona account names the host but shows no "Switch to"', soloForm.includes('Creating as') && soloForm.includes('Solo Athlete') && !soloForm.includes('Switch to'));
const multiForm = renderCreateEvent('athlete', 'x1', 'A', undefined, null, 'f', { personas: [{ kind: 'athlete', id: 'x1', name: 'A' }, { kind: 'club', id: 'y2', name: 'B Club' }] });
ok('a multi-persona account offers a switch to the other page', multiForm.includes('Switch to') && multiForm.includes('/host/club/y2/new'));

// --- Side B: the versus block + typeahead are wired to /api/entities ---
ok('the create form still wires the smooth Side B typeahead', asAth.t.includes('id="ev_sideb"') && asAth.t.includes('id="ev_sideb_ac"') && asAth.t.includes("getElementById('ev_sideb')") && asAth.t.includes('/api/entities'));

// --- /api/entities answers for the logged-in organiser and de-dupes ---
const r = await fetch(`${base}/api/entities?q=${encodeURIComponent(clubs[0].name.slice(0, 3))}`, { headers: { cookie } as any });
const j = await r.json();
const keys = (j.results || []).map((e: any) => e.kind + ':' + e.id);
ok('/api/entities returns suggestions with no duplicates', r.status === 200 && keys.length === new Set(keys).size);

await app.close();
console.log(`\n──────── persona: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
