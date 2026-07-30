// customurl.test.ts — custom event URLs, now FREE for every organiser.
//   * the create + edit forms always show the slug field (no Horda Plus gate)
//   * a slug set by any organiser resolves the public event page
//   * slugs are validated + unique
// Run: node tests/customurl.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession } from '../src/db/auth_repo.ts';
import { createScheduledEvent, resolveEventId, setEventSlug } from '../src/db/events_repo.ts';
import { renderCreateEvent } from '../src/web/events.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, body: string, cookie: string) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie } as any, body });
const get = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } as any : undefined }).then(r => r.text());

console.log('\n[customurl] custom event URLs — free for everyone');

// --- the custom-URL field is no longer offered in the UI (we use promo links) ---
const create = renderCreateEvent('athlete', 'a', 'Rico', undefined, null, 'f', { origin: 'https://joinhorda.com' });
ok('the create form no longer shows a custom-URL field', !create.includes('name="slug"'));
ok('the create form no longer upsells Horda Plus for the URL', !create.includes('Horda Plus'));

const ath = app.ids.athletes[0].id;
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [ath])).rows[0].account_id;
const cookie = `hz_session=${await createSession(app.db, acct)}`;
const ev = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'Derby Night', startsAt: new Date(Date.now() + 864e5).toISOString(), location: 'Berlin', admission: 'open' });

// --- the edit form no longer shows the field, but the backend still resolves a
//     slug if one is ever set (kept for later) ---
const edit = await get(`/e/${ev}/edit`, cookie);
ok('the edit form no longer shows a custom-URL field', !edit.includes('name="slug"'));
const saved = await post(`/e/${ev}/edit`, 'title=Derby Night&slug=Derby-2026', cookie);
ok('the backend still applies a posted slug and redirects', saved.status === 303);
ok('the slug is stored (slugified to lowercase)', (await resolveEventId(app.db, 'derby-2026')) === ev);

// --- the custom URL resolves the public event page ---
const bySlug = await get('/e/derby-2026?guest=1');
ok('/e/<slug> renders the event page', bySlug.includes('Derby Night'));
ok('the uuid URL still works too', (await get(`/e/${ev}?guest=1`)).includes('Derby Night'));

// --- set a slug at creation via POST (free) ---
const created = await post('/events', 'host_kind=athlete&host_id=' + ath + '&title=Open+Night&starts_at=2027-11-01T09:00&location_kind=in_person&location=Berlin&archetype=single&slug=open-night', cookie);
const newId = (created.headers.get('location') || '').match(/\/e\/([^/?]+)/)?.[1] || '';
ok('a slug set at creation is applied for a free organiser', !!newId && (await resolveEventId(app.db, 'open-night')) !== null);

// --- validation + uniqueness ---
const ev2 = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'Other', startsAt: new Date(Date.now() + 2 * 864e5).toISOString(), location: 'Berlin', admission: 'open' });
const dup = await setEventSlug(app.db, ev2, 'derby-2026');
ok('a taken slug is refused', !dup.ok && !!dup.error);
const short = await setEventSlug(app.db, ev2, 'ab');
ok('a too-short slug is refused', !short.ok);
const cleared = await setEventSlug(app.db, ev, '');
ok('an empty slug clears the custom URL', cleared.ok && cleared.slug === null && (await resolveEventId(app.db, 'derby-2026')) === null);

await app.close();
console.log(`\n──────── customurl: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
