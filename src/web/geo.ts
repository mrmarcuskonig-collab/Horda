// geo.ts — place lookup for every address field on Furia.
//
// THE HONEST CONSTRAINT: "start typing a coffee shop and the address pops up"
// is venue-level geocoding, and that needs a geocoding provider. We know about
// clubs and events, not about every café in Berlin.
//
// WHY PHOTON AND NOT NOMINATIM. Nominatim is the OSM geocoder everyone reaches
// for first, and it is the wrong choice here — its usage policy explicitly
// FORBIDS this exact feature: "Auto-complete search ... you must not implement
// such a service on the client side using the API." Doing it anyway gets the
// server's IP banned, and the failure arrives as a silent 403 in production.
// See https://operations.osmfoundation.org/policies/nominatim/
//
// Photon (by komoot) is the same OSM data through a geocoder *built* for
// search-as-you-type. No key, no card, and using it for typeahead is the point
// of it rather than a violation of it.
//
//   GEO_PROVIDER unset/photon → Photon public API. The default: it works today
//                               with no setup. Caveat, and it's a real one: the
//                               public endpoint is komoot's demo server. They
//                               offer no availability guarantee and will throttle
//                               or ban excessive use. Fine now; self-host (two
//                               files, Apache-2.0) or move to Mapbox when Furia
//                               is busy enough for that to matter.
//   GEO_PROVIDER=photon + PHOTON_URL → your own Photon instance. The upgrade
//                               path that keeps everything else identical.
//   GEO_PROVIDER=mapbox       → needs MAPBOX_TOKEN. Commercial SLA, generous
//                               free tier. The grown-up option.
//   GEO_PROVIDER=off          → curated city list only. No third party sees any
//                               keystrokes. The privacy-maximal choice.
//
// Requests are proxied SERVER-SIDE on purpose: it keeps any API key off the
// client, and the user's typing goes to us, not straight to a third party from
// their browser. Results are cached in-process — the same handful of prefixes
// get typed constantly, and someone else's rate limit is the scarce resource.

export interface Place { label: string; lat?: number; lon?: number }

// Curated fallback. Deliberately city-level: pretending to know venues without a
// provider would be worse than plainly not knowing them.
const CURATED = [
  'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig',
  'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hannover', 'Nuremberg', 'Duisburg', 'Bochum',
  'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden',
  'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck',
  'Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne',
  'Amsterdam', 'Rotterdam', 'Brussels', 'Antwerp', 'Paris', 'Lyon', 'Marseille',
  'London', 'Manchester', 'Birmingham', 'Dublin', 'Madrid', 'Barcelona', 'Lisbon',
  'Milan', 'Rome', 'Turin', 'Warsaw', 'Kraków', 'Prague', 'Budapest',
  'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'New York', 'Los Angeles', 'Chicago',
];

const cache = new Map<string, { at: number; places: Place[] }>();
const TTL_MS = 10 * 60 * 1000;

function curated(q: string): Place[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const pre = CURATED.filter(c => c.toLowerCase().startsWith(t));
  const sub = CURATED.filter(c => !pre.includes(c) && c.toLowerCase().includes(t));
  return [...pre, ...sub].slice(0, 6).map(label => ({ label }));
}

// Photon returns GeoJSON. We build a human label from the parts rather than
// dumping the raw name, so "Bonanza Coffee" reads as
// "Bonanza Coffee, Oderberger Str. 35, Berlin" — the venue AND enough address to
// tell two branches apart, which is the whole reason someone is typing.
async function photon(q: string, fetcher: typeof fetch): Promise<Place[]> {
  const base = process.env.PHOTON_URL || 'https://photon.komoot.io';
  const u = `${base}/api?limit=6&lang=de&q=${encodeURIComponent(q)}`;
  const r = await fetcher(u, { headers: { 'user-agent': 'Furia/1.0 (joinfuria.com; marcus@spaghetti.ventures)' } });
  if (!r.ok) return [];
  const j = await r.json() as any;
  return (j.features || []).map((f: any) => {
    const p = f.properties || {};
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const label = [p.name, street, p.city || p.county, p.country].filter(Boolean).join(', ');
    return { label, lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0] };
  }).filter((p: Place) => p.label);
}

async function mapbox(q: string, token: string, fetcher: typeof fetch): Promise<Place[]> {
  const u = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=6&types=poi,address,place&access_token=${encodeURIComponent(token)}`;
  const r = await fetcher(u);
  if (!r.ok) return [];
  const j = await r.json() as any;
  return (j.features || []).map((f: any) => ({ label: String(f.place_name || ''), lon: f.center?.[0], lat: f.center?.[1] })).filter((p: Place) => p.label);
}

export async function lookupPlaces(q: string, fetcher: typeof fetch = fetch): Promise<Place[]> {
  const term = (q || '').trim();
  if (term.length < 3) return [];                 // 2 chars matches half of Europe
  const key = term.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;

  // Photon by default: venue search works out of the box, no key, no signup.
  const provider = (process.env.GEO_PROVIDER || 'photon').toLowerCase();
  let places: Place[] = [];
  try {
    if (provider === 'mapbox' && process.env.MAPBOX_TOKEN) places = await mapbox(term, process.env.MAPBOX_TOKEN, fetcher);
    else if (provider !== 'off') places = await photon(term, fetcher);
  } catch {
    places = [];   // a provider outage must never break the form — fall through
  }
  // Always fall back rather than showing an empty dropdown: an address field
  // that suggests nothing looks broken, even when it's just unconfigured.
  if (!places.length) places = curated(term);

  cache.set(key, { at: Date.now(), places });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return places;
}
