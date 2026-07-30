// profileedit.test.ts — editing your pages with real depth, and a clear "which
// profile am I editing" switcher.
//   * the athlete page editor edits name / @handle / about (not personal settings)
//   * clicking edit on your athlete page goes to the page editor, not /settings
//   * personal settings is labelled "Personal account" and shows the switcher
//   * a club page has its own editor (name / about / photos / links)
//   * @handle uniqueness is enforced
// Run: node tests/profileedit.test.ts
import { startServer } from '../src/web/server.ts';
import { getAthleteProfile, updateAthleteIdentity, createAthlete } from '../src/db/engagement_repo.ts';
import { getBranding, getClub } from '../src/db/entity_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, b: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b).toString() });
const get = (p: string) => fetch(base + p).then(r => r.text());
const rico = app.ids.athletes[0].id;   // owned by the cookieless demo viewer
const club = app.ids.clubs[0].id;

console.log('\n[profileedit] edit your pages with depth + a clear profile switcher');

// --- the athlete page editor ---
const cz = await get(`/athlete/${rico}/customize`);
ok('the switcher shows "You\'re editing" with a Personal account chip', cz.includes("You're editing") && cz.includes('Personal account'));
ok('the athlete editor has name, @handle and about fields', cz.includes('name="name"') && cz.includes('name="handle"') && cz.includes('name="tagline"'));
ok('it clearly says you\'re editing the athlete page (not settings)', cz.includes('Edit your athlete page') && !cz.includes('Personal account settings'));

// --- the athlete page owner button goes to the page editor, not /settings ---
const pub = await get(`/athlete/${rico}`);
ok('the athlete page\'s primary owner button edits the page', pub.includes(`href="/athlete/${rico}/customize"`) && pub.includes('Edit this page'));
ok('personal account settings is a separate, clearly-labelled link', pub.includes('href="/settings"') && pub.includes('Account settings'));

// --- saving athlete identity ---
await post(`/athlete/${rico}/identity`, { name: 'Rico Renamed', handle: 'ricorenamed', tagline: 'Southpaw from Wedding.' });
const prof = await getAthleteProfile(app.db, rico);
ok('name, @handle and about all save on the athlete page', prof.name === 'Rico Renamed' && prof.handle === 'ricorenamed' && prof.tagline === 'Southpaw from Wedding.');

// --- @handle uniqueness across athletes ---
const other = await createAthlete(app.db, 'Other', 'takenhandle');
const dupe = await updateAthleteIdentity(app.db, rico, { handle: 'takenhandle' });
ok('a taken @handle is refused', !dupe.ok && !!dupe.error && (await getAthleteProfile(app.db, rico)).handle === 'ricorenamed');
ok('a bad @handle is refused', !(await updateAthleteIdentity(app.db, rico, { handle: 'a b!' })).ok);

// --- personal settings is labelled + carries the switcher ---
const set = await get('/settings');
ok('settings is titled "Personal account" and shows the switcher', set.includes('Personal account') && set.includes("You're editing"));
ok('the switcher on settings lists the athlete page as another editor', set.includes(`/athlete/${rico}/customize`));

// --- the club page has its own editor ---
const ce = await get(`/club/${club}/customize`);
ok('the club editor exists with name / about / links', ce.includes('Edit your club page') && ce.includes('name="name"') && ce.includes('name="tagline"') && ce.includes('name="instagram"'));
await post(`/club/${club}/identity`, { name: 'Club Renamed', tagline: 'Pride of the Kreisliga.', instagram: 'https://instagram.com/club' });
ok('club name saves', (await getClub(app.db, club)).name === 'Club Renamed');
const b = await getBranding(app.db, 'club', club);
ok('club about + social save', b.tagline === 'Pride of the Kreisliga.' && b.links.instagram === 'https://instagram.com/club');
ok('the club page shows an "Edit this page" button to the owner', (await get(`/club/${club}`)).includes(`/club/${club}/customize`));

// --- a non-owner cannot edit ---
await post(`/club/${club}/identity?guest=1`, { name: 'HACKED' });
ok('a non-owner cannot rename a club', (await getClub(app.db, club)).name === 'Club Renamed');

await app.close();
console.log(`\n──────── profileedit: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
