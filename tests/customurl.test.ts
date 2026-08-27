// customurl.test.ts — custom event URLs: offered in the UI again, free on every
// plan, with the same live availability check the profile handle field uses.
//
// This file previously asserted the OPPOSITE — that the slug field was absent
// from both forms, because it had been pulled in favour of attributable promo
// links. That call is reversed: a slug is the URL you put on a poster, promo
// links are what measures who brought people, and they don't compete. Promo
// links and `attribution` (a Free entitlement) are untouched.
//
// The packaging change this locks in: `custom_url` is no longer a Furia Plus
// entitlement. It was sold on the pricing page while the backend applied a
// posted slug for anyone and the form showed it to nobody.
// Run: node tests/customurl.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession } from '../src/db/auth_repo.ts';
import { createScheduledEvent, resolveEventId, setEventSlug } from '../src/db/events_repo.ts';
import { renderCreateEvent } from '../src/web/events.ts';
import { ENTITLEMENT_LABEL, getPlan } from '../src/web/pricing.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, body: string, cookie: string) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie } as any, body });
const get = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } as any : undefined }).then(r => r.text());

console.log('\n[customurl] custom event URLs — offered, and free for everyone');

const ath = app.ids.athletes[0].id;
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [ath])).rows[0].account_id;
const cookie = `hz_session=${await createSession(app.db, acct)}`;
const ev = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'Derby Night', startsAt: new Date(Date.now() + 864e5).toISOString(), location: 'Berlin', admission: 'open' });

// --- creation still starts on the uuid link, like a new page does ---------
const create = renderCreateEvent('athlete', 'a', 'Rico', undefined, null, 'f', { origin: 'https://joinfuria.com' });
ok('a new event does NOT pick its URL up front', !create.includes('name="slug"'));
ok('no Furia Plus upsell anywhere near it', !create.includes('Furia Plus'));

// --- the edit form offers it, ungated, to a Free organiser ----------------
const edit = await get(`/e/${ev}/edit`, cookie);
ok('the edit form offers the custom-URL field', edit.includes('name="slug"'));
ok('it is offered to a FREE organiser with no upsell', !edit.includes('Furia Plus'));
ok('it shows the link prefix so the organiser sees the whole URL', edit.includes('/e/'));
ok('it wires the same live availability check as profile handles', edit.includes('/link-available?scope=event'));
ok('the check is debounced and guards against a stale response', edit.includes('setTimeout(check,280)') && edit.includes('if(v!==val())return'));

// --- the live check ------------------------------------------------------
const avail = (q: string) => fetch(base + q, { headers: { cookie, accept: 'application/json' } as any }).then(r => r.json() as any);
ok('a free slug reads as available', (await avail(`/link-available?scope=event&id=${ev}&v=derby-2026`)).available === true);
ok('a badly-written slug is invalid', (await avail(`/link-available?scope=event&id=${ev}&v=Derby%202026!`)).valid === false);
ok('a too-short slug is invalid', (await avail(`/link-available?scope=event&id=${ev}&v=ab`)).valid === false);
ok('a guest cannot probe event slugs', (await fetch(base + `/link-available?scope=event&id=${ev}&v=derby-2026&guest=1`).then(r => r.json()) as any).valid === false);

// --- saving, resolving, clearing -----------------------------------------
const saved = await post(`/e/${ev}/edit`, 'title=Derby Night&slug=Derby-2026', cookie);
ok('the edit form saves a slug and redirects', saved.status === 303);
ok('the slug is stored lowercased', (await resolveEventId(app.db, 'derby-2026')) === ev);
ok('/e/<slug> renders the event page', (await get('/e/derby-2026?guest=1')).includes('Derby Night'));
ok('the uuid URL still works too', (await get(`/e/${ev}?guest=1`)).includes('Derby Night'));
ok('the event reads its own slug back as current', (await avail(`/link-available?scope=event&id=${ev}&v=derby-2026`)).current === true);

const created = await post('/events', 'host_kind=athlete&host_id=' + ath + '&title=Open+Night&starts_at=2027-11-01T09:00&location_kind=in_person&location=Berlin&archetype=single&slug=open-night', cookie);
const newId = (created.headers.get('location') || '').match(/\/e\/([^/?]+)/)?.[1] || '';
ok('a slug posted at creation is applied for a free organiser', !!newId && (await resolveEventId(app.db, 'open-night')) !== null);

const ev2 = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'Other', startsAt: new Date(Date.now() + 2 * 864e5).toISOString(), location: 'Berlin', admission: 'open' });
ok('a taken slug is refused', !(await setEventSlug(app.db, ev2, 'derby-2026')).ok);
ok('a too-short slug is refused', !(await setEventSlug(app.db, ev2, 'ab')).ok);
const cleared = await setEventSlug(app.db, ev, '');
ok('an empty slug clears the custom URL', cleared.ok && cleared.slug === null && (await resolveEventId(app.db, 'derby-2026')) === null);

// --- packaging: it is no longer a Plus feature ---------------------------
ok('custom_url is gone from the entitlement labels', !('custom_url' in ENTITLEMENT_LABEL));
ok('Furia Plus no longer lists it as a paid feature', !(getPlan('plus').entitlements as string[]).includes('custom_url'));
ok('the pricing page no longer sells "Custom event URL"', !(await get('/about/pricing')).includes('Custom event URL'));
ok('Plus still has its other paid entitlements', (getPlan('plus').entitlements as string[]).includes('zero_fee'));

await app.close();
console.log(`\n──────── customurl: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
