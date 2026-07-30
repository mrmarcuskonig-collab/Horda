// banner.test.ts — the dynamic event banner (the "background picture").
//   * default banner = the host's own picture/logo embedded into the field (no ring)
//   * versus event → the banner splits (VS) into host + opponent; unclaimed side B
//     falls back to that side's initials; multi-party reads as a single host
//   * no picture at all → the name's initials (e.g. RV)
//   * the create form shows a live preview + an easy upload override
//   * a custom cover always wins over the generated banner
// Run: node tests/banner.test.ts
import { startServer } from '../src/web/server.ts';
import { eventBannerSvg } from '../src/web/banner.ts';

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
ok('versus banner integrates both pictures with a minimal VS', vs.includes('a.jpg') && vs.includes('b.jpg') && vs.includes('>VS<'));
ok('the picture is embedded (feather-masked), never a ring/disc badge', (() => { const s = eventBannerSvg({ host: { name: 'Rico', avatarUrl: 'https://x/r.jpg' } }); return s.includes('r.jpg') && s.includes('mask="url(#') && !s.includes('<circle') && !s.includes('clip-path'); })());
const ph = eventBannerSvg({ host: { name: 'A', avatarUrl: 'https://x/a.jpg' }, opponent: { name: 'Tariq Bey', avatarUrl: null }, versus: true });
ok('an unclaimed side B falls back to its initials (no image, still a VS)', ph.includes('a.jpg') && ph.includes('>VS<') && ph.includes('>TB<') && !/b\.jpg/.test(ph));
ok('no picture at all falls back to initials (e.g. RV), not a broken image', eventBannerSvg({ host: { name: 'Rico Vale', avatarUrl: null } }).includes('>RV<'));

// --- create + endpoint ---
const single = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Run', starts_at: '2027-12-01T09:00', location_kind: 'in_person', location: 'Berlin', archetype: 'single' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
const b1 = await get(`/e/${single}/banner.svg`);
ok('/e/:id/banner.svg serves an SVG built from the host picture', b1.s === 200 && b1.ct.includes('svg') && b1.t.includes('rico.jpg') && !b1.t.includes('>VS<'));

const versus = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Bout', starts_at: '2027-12-02T20:00', location_kind: 'in_person', location: 'Berlin', archetype: 'versus' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
const b2 = await get(`/e/${versus}/banner.svg`);
ok('a versus event renders a split banner (VS + a placeholder side B)', b2.t.includes('>VS<'));

const multi = ((await post('/events', { host_kind: 'athlete', host_id: rico, title: 'Meet', starts_at: '2027-12-03T10:00', location_kind: 'in_person', location: 'Berlin', archetype: 'multi' })).headers.get('location') || '').match(/\/e\/([^/?]+)/)![1];
ok('a multi-party event reads as a single host (no split)', !(await get(`/e/${multi}/banner.svg`)).t.includes('>VS<'));

// --- create form: live preview + upload override, no design picker ---
const form = await get(`/host/athlete/${rico}/new`);
ok('the create form shows the auto-made banner preview and no design picker', form.t.includes('Event banner') && form.t.includes('/banner/preview.svg') && !form.t.includes('data-style='));
ok('an optional "use your own image" upload is offered (overrides the banner)', form.t.includes('Use your own image') && form.t.includes('name="cover"') && form.t.includes('data-target="cover"'));
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
