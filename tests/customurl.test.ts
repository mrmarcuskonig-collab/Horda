// customurl.test.ts — custom event URLs, the first real Horda Plus feature.
//   * gated by hasEntitlement(plan,'custom_url') — Plus sees the field, Free an upsell
//   * a slug set by a Plus organiser resolves the public event page
//   * slugs are validated + unique; a Free organiser's slug is ignored
// Run: node tests/customurl.test.ts
import { startServer } from '../src/web/server.ts';
import { createSession, setAccountPlan } from '../src/db/auth_repo.ts';
import { createScheduledEvent, resolveEventId, setEventSlug } from '../src/db/events_repo.ts';
import { hasEntitlement } from '../src/web/pricing.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, body: string, cookie: string) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie } as any, body });
const get = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } as any : undefined }).then(r => r.text());

console.log('\n[customurl] custom event URLs — Horda Plus feature');

ok('config: Plus includes custom_url, Free does not', hasEntitlement('plus', 'custom_url') && !hasEntitlement('free', 'custom_url'));

const ath = app.ids.athletes[0].id;
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [ath])).rows[0].account_id;
const cookie = `hz_session=${await createSession(app.db, acct)}`;
const ev = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'Derby Night', startsAt: new Date(Date.now() + 864e5).toISOString(), location: 'Berlin', admission: 'open' });

// --- Free organiser: sees an upsell, and any slug they post is ignored ---
const editFree = await get(`/e/${ev}/edit`, cookie);
ok('Free organiser edit page shows the Plus upsell, not the field', editFree.includes('Custom URL') && editFree.includes('Horda Plus') && !editFree.includes('name="slug"'));
await post(`/e/${ev}/edit`, 'title=Derby Night&slug=derby-free', cookie);
ok('a Free organiser’s slug is ignored (not saved)', (await resolveEventId(app.db, 'derby-free')) === null);

// --- upgrade to Plus, then the field appears and the slug works ---
await setAccountPlan(app.db, acct, 'plus', 'sub_cu');
const editPlus = await get(`/e/${ev}/edit`, cookie);
ok('Plus organiser edit page shows the custom-URL field', editPlus.includes('name="slug"') && editPlus.includes('/e/'));
const saved = await post(`/e/${ev}/edit`, 'title=Derby Night&slug=Derby-2026', cookie);
ok('saving a custom URL redirects to manage', saved.status === 303);
ok('the slug is stored (slugified to lowercase)', (await resolveEventId(app.db, 'derby-2026')) === ev);

// --- the custom URL resolves the public event page ---
const bySlug = await get('/e/derby-2026?guest=1');
ok('/e/<slug> renders the event page', bySlug.includes('Derby Night'));
ok('the uuid URL still works too', (await get(`/e/${ev}?guest=1`)).includes('Derby Night'));

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
