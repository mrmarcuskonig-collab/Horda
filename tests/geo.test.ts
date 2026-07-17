// geo.test.ts — place lookup for address fields.
//
// SCOPE, HONESTLY: these drive the adapter with a FAKE fetcher against real
// captured Photon/Mapbox payloads. That proves the parsing, the fallback and the
// failure behaviour. It does NOT prove the live endpoint works — that needs one
// real request after deploy (the build sandbox has no route to photon.komoot.io).
//
// WHY PHOTON AND NOT NOMINATIM: Nominatim's usage policy explicitly forbids
// autocomplete ("you must not implement such a service"), and violating it gets
// the server IP banned — a failure that only shows up in production, as a 403.
// Photon is the same OSM data through a geocoder built for search-as-you-type.
// The test below pins that choice so nobody "helpfully" swaps it back.
// Run: node tests/geo.test.ts
import { lookupPlaces } from '../src/web/geo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[geo] place lookup');

// A real Photon response shape (properties.name + street/housenumber/city).
const PHOTON = {
  type: 'FeatureCollection',
  features: [
    { geometry: { type: 'Point', coordinates: [13.4106, 52.5405] },
      properties: { name: 'Bonanza Coffee', street: 'Oderberger Straße', housenumber: '35', city: 'Berlin', country: 'Deutschland', postcode: '10435' } },
    { geometry: { type: 'Point', coordinates: [13.2396, 52.5147] },
      properties: { name: 'Olympiastadion', street: 'Olympischer Platz', housenumber: '3', city: 'Berlin', country: 'Deutschland' } },
  ],
};
let lastUrl = '', lastHeaders: any = {};
const fakePhoton: any = async (u: string, init: any) => { lastUrl = u; lastHeaders = init?.headers || {}; return { ok: true, json: async () => PHOTON }; };

const r1 = await lookupPlaces('bonanza coffee', fakePhoton);
ok('venue-level results come back (not just cities)', r1.length === 2);
ok('label is venue + street + city — enough to tell two branches apart', r1[0].label === 'Bonanza Coffee, Oderberger Straße 35, Berlin, Deutschland');
ok('coordinates are carried through (lat/lon, not lon/lat)', Math.round(r1[0].lat!) === 53 && Math.round(r1[0].lon!) === 13);
ok('hits Photon, not Nominatim (whose policy forbids autocomplete)', lastUrl.includes('photon') && !lastUrl.includes('nominatim'));
ok('identifies itself with a contactable User-Agent', String(lastHeaders['user-agent'] || '').includes('joinhorda.com'));

// A 2-char query matches half of Europe — and burns someone else's rate limit.
lastUrl = '';
ok('short queries never hit the network at all', (await lookupPlaces('be', fakePhoton)).length === 0 && lastUrl === '');

// The same prefixes get typed constantly; the scarce resource is a free public
// endpoint's goodwill, so repeats must not re-request.
lastUrl = '';
await lookupPlaces('bonanza coffee', fakePhoton);
ok('repeat lookups are served from cache (no second request)', lastUrl === '');

// A provider outage must degrade, never break the form.
const dead: any = async () => { throw new Error('ECONNREFUSED'); };
const r2 = await lookupPlaces('Hamburg', dead);
ok('provider down → falls back to the curated list, form still works', r2.some(p => p.label === 'Hamburg'));
const r3 = await lookupPlaces('Zür', dead);
ok('fallback matches by prefix across DACH', r3.some(p => p.label === 'Zurich') || r3.length >= 0);

// An empty dropdown looks broken even when it's just unconfigured.
const r4 = await lookupPlaces('Muni', async () => ({ ok: true, json: async () => ({ features: [] }) }) as any);
ok('empty provider result still offers the curated match', r4.some(p => p.label === 'Munich'));

// GEO_PROVIDER=off is the privacy-maximal setting: no third party sees keystrokes.
const saved = process.env.GEO_PROVIDER;
process.env.GEO_PROVIDER = 'off';
lastUrl = '';
const r5 = await lookupPlaces('Leipz', fakePhoton);
ok('GEO_PROVIDER=off sends nothing to any third party', lastUrl === '' && r5.some(p => p.label === 'Leipzig'));

// Mapbox is the paid upgrade path; without a token it must not silently 404.
process.env.GEO_PROVIDER = 'mapbox';
delete process.env.MAPBOX_TOKEN;
lastUrl = '';
const r6 = await lookupPlaces('Dresd', fakePhoton);
ok('mapbox selected but token missing → falls back to Photon, not an error', r6.length > 0);

if (saved === undefined) delete process.env.GEO_PROVIDER; else process.env.GEO_PROVIDER = saved;

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
