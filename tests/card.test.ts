// card.test.ts — the matchday card, the countdown rule, and the maps chooser.
//
// The card's failure modes are all SILENT: a blank picture, a shifted time, an
// SVG no crawler renders, a relative og:image every scraper drops. Nothing here
// throws in production — it just quietly doesn't work in someone else's chat,
// where we never see it. So these assert the picture, not the plumbing.
// Run: node tests/card.test.ts
import { startServer } from '../src/web/server.ts';
import { eventCardSvg } from '../src/web/card.ts';
import { svgToPng, rasterAvailable } from '../src/web/raster.ts';
import { googleMapsUrl, appleMapsUrl, mapsChooser } from '../src/web/maps.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = async (p: string) => (await fetch(base + p)).text();

console.log('\n[card] matchday card · countdown · maps');

const brief = {
  title: 'Berliner SC vs FC Beispiel', hostName: 'FC Beispiel',
  startsAt: '2026-08-01T17:00:00.000Z', timezone: 'Europe/Berlin',
  location: 'Poststadion, Berlin', locationKind: 'in_person',
  priceLabel: '€15', ways: ['In person', 'Stream'], remaining: 7, full: false,
};

// --- the card carries enough to decide on ---------------------------------
const svg = eventCardSvg(brief);
ok('card names the event', svg.includes('Berliner SC vs FC Beispiel'));
ok('card names the host', svg.includes('FC Beispiel'));
ok('card carries the price', svg.includes('€15'));
ok('card carries the doors', svg.includes('In person') && svg.includes('Stream'));
ok('card is OG-shaped (1200×630)', svg.includes('width="1200"') && svg.includes('height="630"'));

// THE TIMEZONE BUG, ON A NEW SURFACE. 17:00Z in Berlin is 19:00 CEST. A card that
// prints the server's idea of the time sends everyone who reads it an hour late —
// and unlike the event page, a card in a WhatsApp thread can't be corrected.
ok('card prints the time AT THE VENUE, not the server', svg.includes('19:00'));
ok('card spells out the zone', svg.includes('CEST'));

// A long title must wrap, not run off the edge — there is no text layout engine
// here, so an unwrapped title silently paints past the canvas.
const titleLines = (s: string) => (s.match(/letter-spacing="-1"/g) || []).length;
ok('a short title is one line', titleLines(svg) === 1);
const longSvg = eventCardSvg({ ...brief, title: 'The Kreisliga A Season Opener Featuring Every Single Team In The Entire Division' });
ok('a long title wraps instead of overflowing', titleLines(longSvg) >= 2);

// Beyond the line budget, ellipsise. A title clipped mid-word reads as a bug;
// "…" reads as "there's more".
const hugeSvg = eventCardSvg({ ...brief, title: 'The Kreisliga A Season Opener Featuring Every Single Team In The Entire Division Plus The Reserves The Youth Sides And Several Neighbouring Districts Who Asked Nicely To Come Along Too' });
ok('an over-long title is capped at the line budget', titleLines(hugeSvg) <= 3);
ok('an over-long title is ellipsised, not clipped mid-word', hugeSvg.includes('…'));

// --- rasterising: the part that must not lie ------------------------------
const png = await svgToPng(svg);
if (await rasterAvailable()) {
  ok('rasterises to a real PNG', !!png && png.subarray(1, 4).toString() === 'PNG');
  ok('PNG is substantial (not an empty canvas)', !!png && png.length > 8000);

  // THE FONT TRAP. resvg renders text with whatever fonts it can find. With none
  // installed (a bare node:22-slim) every card comes back a valid, correctly
  // sized, COMPLETELY BLANK rectangle — no error, no warning. Two different
  // titles producing identical bytes is the cheapest possible proof that glyphs
  // are actually landing on the canvas.
  const other = await svgToPng(eventCardSvg({ ...brief, title: 'A Totally Different Event Name' }));
  ok('different titles → different pixels (fonts are really rendering)',
    !!png && !!other && !png.equals(other));
} else {
  ok('no rasteriser → svgToPng returns null rather than throwing', png === null);
}

// --- the routes -----------------------------------------------------------
const evId = (await app.db.query<{ id: string }>(`SELECT id FROM event LIMIT 1`)).rows[0].id;
const pngRes = await fetch(`${base}/e/${evId}/card.png`);
ok('/e/:id/card.png is public — a crawler has no cookie', pngRes.status === 200);
ok('card.png is served as an image', /^image\/(png|svg\+xml)/.test(pngRes.headers.get('content-type') || ''));
ok('card is cached, but not for so long that "7 left" becomes a lie',
  /max-age=(60|300)\b/.test(pngRes.headers.get('cache-control') || ''));
ok('/e/:id/card.svg renders for debugging', (await fetch(`${base}/e/${evId}/card.svg`)).status === 200);
ok('a card for a missing event 404s', (await fetch(`${base}/e/00000000-0000-0000-0000-000000000000/card.png`)).status === 404);

// Unlisted = a promise about where this event shows up. A card on a guessable
// URL would break it.
await app.db.query(`UPDATE event SET visibility='unlisted' WHERE id=$1`, [evId]);
ok('an unlisted event has no shareable card', (await fetch(`${base}/e/${evId}/card.png`)).status === 404);
await app.db.query(`UPDATE event SET visibility='public' WHERE id=$1`, [evId]);

// --- og: the whole reason the PNG exists ----------------------------------
const evPage = await get(`/e/${evId}`);
ok('event page emits og:image at all (it emitted NONE before)', evPage.includes('og:image'));
// Relative og:image is dropped by every crawler, silently.
ok('og:image is absolute', /og:image" content="https?:\/\/[^"]+\/card\.png"/.test(evPage));
ok('og:image points at the PNG, not the SVG — no unfurler renders SVG', !/og:image" content="[^"]+\.svg"/.test(evPage));
ok('twitter card is the large one (we have a real image now)', evPage.includes('summary_large_image'));

// --- share sends the file, not just a link --------------------------------
ok('share button carries the card image', evPage.includes(`data-img="/e/${evId}/card.png"`));
ok('share checks canShare({files}) before trying — Firefox/desktop throw', evPage.includes('navigator.canShare'));
ok('share degrades to a link', evPage.includes('navigator.share') && evPage.includes('navigator.clipboard'));

// --- maps: ask, do not guess ----------------------------------------------
ok('google url is the documented search endpoint', googleMapsUrl('Poststadion, Berlin').startsWith('https://www.google.com/maps/search/?api=1&query='));
ok('apple url is the documented endpoint', appleMapsUrl('Poststadion, Berlin').startsWith('https://maps.apple.com/?q='));
ok('the query is encoded (commas/spaces would break the URL)', googleMapsUrl('A, B').includes('A%2C%20B'));
const ch = mapsChooser({ query: 'Poststadion, Berlin' });
ok('chooser offers BOTH maps', ch.includes('Google Maps') && ch.includes('Apple Maps'));
ok('chooser works without JS (noscript links)', ch.includes('<noscript>'));
ok('event page asks which maps instead of hard-linking Google', evPage.includes('data-maps="apple"') && evPage.includes('data-maps="google"'));
ok('the choice is remembered so it only asks once', evPage.includes("localStorage.setItem(K, which)") || evPage.includes('hz_maps'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
