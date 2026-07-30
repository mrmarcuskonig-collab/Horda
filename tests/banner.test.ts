// banner.test.ts — the dynamic event banner (the "background picture").
//   * default banner = a designed treatment of the host's own picture/logo
//   * versus event → the banner splits (VS) into host + opponent; unclaimed side B
//     is a placeholder half; multi-party reads as a single host
//   * the create form offers a design picker + a live preview + easy upload override
//   * banner style is saved; a custom cover always wins over the generated banner
// Run: node tests/banner.test.ts
import { startServer } from '../src/web/server.ts';
import { eventBannerSvg, BANNER_STYLES } from '../src/web/banner.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, b: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(b).toString() });
const get = (p: string) => fetch(base + p).then(async r => ({ s: r.status, ct: r.headers.get('content-type') || '', t: await r.text() }));
const rico = app.ids.athletes[0].id;
await app.db.query(`UPDATE athlete SET avatar_url='https://cdn.example.com/rico.jpg' WHERE id=$1`, [rico]);

console.log('\n[banner] dynamic, avatar-derived event banners');

// --- pure generator ---
ok('single-host banner embeds the host picture, no VS split', eventBannerSvg({ host: { name: 'Rico', avatarUrl: 'https://x/r.jpg' } }).includes('r.jpg') && !eventBannerSvg({ host: { name: 'Rico', avatarUrl: 'https://x/r.jpg' } }).includes('>VS<'));
const vs = eventBannerSvg({ host: { name: 'A', avatarUrl: 'https://x/a.jpg' }, opponent: { name: 'B', avatarUrl: 'https://x/b.jpg' }, versus: true });
ok('versus banner splits into two pictures with a VS badge', vs.includes('a.jpg') && vs.includes('b.jpg') && vs.includes('>VS<') && vs.includes('half1'));
const ph = eventBannerSvg({ host: { name: 'A', avatarUrl: 'https://x/a.jpg' }, opponent: null, versus: true });
ok('an unclaimed side B is a placeholder half (no opponent image, still a VS)', ph.includes('a.jpg') && ph.includes('>VS<') && !/b\.jpg/.test(ph));
ok('a missing picture falls back to a monogram, not a broken image', eventBannerSvg({ host: { name: 'Rico Ravens', avatarUrl: null } }).includes('>RR<'));

// --- create + endpoint ---
const single = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Run', starts_at: '2027-12-01T09:00', location_kind: 'in_person', location: 'Berlin', archetype: 'single', banner_style: 'cool' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
ok('the chosen banner style is saved on the event', (await app.db.query<{ b: string }>(`SELECT banner_style b FROM event WHERE id=$1`, [single])).rows[0].b === 'cool');
const b1 = await get(`/e/${single}/banner.svg`);
ok('/e/:id/banner.svg serves an SVG built from the host picture', b1.s === 200 && b1.ct.includes('svg') && b1.t.includes('rico.jpg') && !b1.t.includes('>VS<'));

const versus = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Bout', starts_at: '2027-12-02T20:00', location_kind: 'in_person', location: 'Berlin', archetype: 'versus' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
const b2 = await get(`/e/${versus}/banner.svg`);
ok('a versus event renders a split banner (VS + a placeholder side B)', b2.t.includes('>VS<') && b2.t.includes('half1'));

const multi = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Meet', starts_at: '2027-12-03T10:00', location_kind: 'in_person', location: 'Berlin', archetype: 'multi' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
ok('a multi-party event reads as a single host (no split)', !(await get(`/e/${multi}/banner.svg`)).t.includes('>VS<'));

// --- create form: picker + preview + preview endpoint ---
const form = await get(`/host/athlete/${rico}/new`);
ok('the create form offers a Banner design picker + a live preview', form.t.includes('Banner design') && form.t.includes('/banner/preview.svg') && BANNER_STYLES.every(s => form.t.includes(`data-style="${s}"`)));
ok('a custom photo upload is still offered (overrides the banner)', form.t.includes('Add a photo') && form.t.includes('name="cover"'));
const preview = await get(`/banner/preview.svg?host_kind=athlete&host_id=${rico}&style=ember&versus=1`);
ok('the preview endpoint renders (with a versus split) before the event exists', preview.s === 200 && preview.ct.includes('svg') && preview.t.includes('>VS<'));

// --- fallback wiring: event page uses the banner when there's no cover ---
ok('the event page uses the dynamic banner as the cover fallback', (await get(`/e/${single}?guest=1`)).t.includes(`/e/${single}/banner.svg`));

// --- a custom cover wins over the generated banner ---
await app.db.query(`UPDATE event SET cover_url='https://cdn.example.com/custom.jpg' WHERE id=$1`, [single]);
const withCover = await get(`/e/${single}?guest=1`);
ok('an uploaded cover replaces the generated banner', withCover.t.includes('custom.jpg') && !withCover.t.includes(`/e/${single}/banner.svg`));

await app.close();
console.log(`\n──────── banner: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
