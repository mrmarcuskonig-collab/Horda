// machine.test.ts — can a machine actually read this site?
//
// These tests CONSUME our output the way an outside agent would: fetch the URL,
// parse the bytes, believe nothing. That's the only way to catch this class of
// bug, because every failure here is silent — a wrong xmlns, a missing date, a
// feed that drifted from its page. Nothing throws. Nobody notices. The answer an
// agent gives about Horda is just quietly wrong.
//
// The bug this suite exists for: the changelog printed the date once per DAY and
// left it empty for every entry after the first. A human reads "same day,
// obviously". A parser reads "no date" — 6 of 8 entries had none, and the one
// that did said "17 Jul" with no year.
//
// Run: node tests/machine.test.ts
import { startServer } from '../src/web/server.ts';
import { SHIPPED, BUILDING } from '../src/content/changelog.ts';
import { entryId, changelogFeed, rssFeed, llmsTxt, sitemapXml, robotsTxt, changelogMarkdown } from '../src/web/feeds.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = async (p: string) => (await fetch(base + p)).text();
const head = async (p: string) => await fetch(base + p);

console.log('\n[machine] changelog.json · feed.xml · llms.txt · sitemap · robots');

// --- every surface exists, uncredentialed, correctly typed ------------------
// A machine surface behind auth is a machine surface nobody reads: a crawler has
// no cookie.
const SURFACES: [string, RegExp][] = [
  ['/changelog.json', /application\/json/],
  ['/changelog.md', /text\/markdown/],
  ['/feed.xml', /application\/rss\+xml/],
  ['/rss.xml', /application\/rss\+xml/],
  ['/sitemap.xml', /application\/xml/],
  ['/robots.txt', /text\/plain/],
  ['/llms.txt', /text\/plain/],
];
for (const [p, type] of SURFACES) {
  const r = await head(p);
  ok(`${p} is public (200)`, r.status === 200);
  ok(`${p} declares the right content-type`, type.test(r.headers.get('content-type') || ''));
}

// --- THE DATE BUG ----------------------------------------------------------
const clHtml = await get('/changelog');
const times = [...clHtml.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);
ok('EVERY shipped entry carries a machine date (the regression)', times.length === SHIPPED.length);
ok('…and they are full ISO dates, not "17 Jul"', times.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t)));
ok('…and they match the source data exactly', times.join(',') === SHIPPED.map(e => e.date).join(','));
ok('no entry has an empty date element any more', !/<div class="when"><\/div>/.test(clHtml));
// The human still sees the grouped layout — the fix must not have cost the design.
ok('the human still sees one date per day (grouped, not repeated)',
  (clHtml.match(/visibility:hidden/g) || []).length === SHIPPED.length - new Set(SHIPPED.map(e => e.date)).size);

// --- semantic structure ----------------------------------------------------
ok('shipped entries are <article>, not anonymous divs', (clHtml.match(/<article class="cle"/g) || []).length === SHIPPED.length);
ok('every entry has a stable id to deep-link to', SHIPPED.every(e => clHtml.includes(`id="${entryId(e)}"`)));
ok('the change type is machine-readable, not just a coloured pill', SHIPPED.every(e => clHtml.includes(`data-tag="${e.tag}"`)));
// Without this a parser cannot tell "we built it" from "we said we would" — and
// publishing the second as the first is the trust failure this page exists to avoid.
ok('"now building" is marked as a promise, not as shipped work',
  (clHtml.match(/data-status="building"/g) || []).length === BUILDING.length);
ok('the page advertises its machine twins (autodiscovery)',
  clHtml.includes('type="application/rss+xml"') && clHtml.includes('href="/changelog.json"'));

// --- /changelog.json -------------------------------------------------------
const feed = JSON.parse(await get('/changelog.json'));
ok('changelog.json is valid JSON', typeof feed === 'object');
ok('it names its own format so a stranger can orient', typeof feed.$schema === 'string');
ok('it carries both halves: shipped AND building', Array.isArray(feed.shipped) && Array.isArray(feed.building));
ok('shipped count matches the source', feed.shipped.length === SHIPPED.length);
ok('building count matches the source', feed.building.length === BUILDING.length);
ok('every entry has id, ISO date, tag, body', feed.shipped.every((e: any) =>
  e.id && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && ['new', 'better', 'fixed'].includes(e.tag) && e.body));
ok('ids are unique — a duplicate id silently merges two entries',
  new Set(feed.shipped.map((e: any) => e.id)).size === feed.shipped.length);
ok('newest first, so "what shipped lately" is the first read',
  feed.shipped.map((e: any) => e.date).join() === [...feed.shipped.map((e: any) => e.date)].sort().reverse().join());
ok('"updated" is the newest change, not now() — polling must not look like news', feed.updated === SHIPPED[0].date);
ok('attribution survives into the feed', feed.shipped.some((e: any) => 'asked' in e) || !SHIPPED.some(e => e.asked));

// THE DRIFT TEST. A JSON feed's characteristic failure is quietly disagreeing
// with the page it describes. They read the same module, so they can't — but
// assert it, because the day someone "optimises" the feed with a cache is the
// day it starts lying.
ok('the feed does not drift from the page', feed.shipped.every((e: any) => clHtml.includes(e.title.slice(0, 30).replace(/&/g, '&amp;'))));
// A deep link that 404s inside the page is worse than no link.
ok('every feed url anchors at an id that exists in the HTML',
  feed.shipped.every((e: any) => clHtml.includes(`id="${e.url.split('#')[1]}"`)));
ok('feed urls are absolute — a relative url in a feed is unusable',
  feed.shipped.every((e: any) => /^https?:\/\//.test(e.url)));

// --- /feed.xml -------------------------------------------------------------
const rss = await get('/feed.xml');
ok('RSS declares itself', rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && rss.includes('<rss version="2.0"'));
ok('one item per shipped entry', (rss.match(/<item>/g) || []).length === SHIPPED.length);
ok('it links to itself (atom:link rel=self) — required for well-formed RSS', rss.includes('rel="self"'));
const pubDates = [...rss.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(m => m[1]);
ok('every pubDate is a date a reader can actually parse', pubDates.every(d => !isNaN(new Date(d).getTime())));
// Noon UTC, not midnight: a changelog date has day precision, and midnight puts
// half the planet a day behind.
ok('dates land at noon UTC so every timezone reads the right DAY', pubDates.every(d => d.includes('12:00:00')));
ok('guids are unique and stable (not permalinks)',
  new Set([...rss.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(m => m[1])).size === SHIPPED.length);

// XML ESCAPING. One ampersand in a title breaks the entire feed for every reader
// — not that entry, the whole document.
const nasty = { date: '2026-01-01', title: 'Fish & Chips <script>alert(1)</script>', body: 'A "quoted" & <angled> body', tag: 'new' as const };
const nastyRss = rssFeed('https://x.test').replace('</channel>', `<item><title>${nasty.title}</title></item></channel>`);
ok('the escaper handles & and < (asserted directly)',
  rssFeed('https://x.test').includes('&amp;') || !SHIPPED.some(e => /[&<>]/.test(e.title + e.body)));
{
  // Round-trip a hostile entry through the real escaper.
  const { SHIPPED: real } = await import('../src/content/changelog.ts');
  real.unshift(nasty);
  const out = rssFeed('https://x.test');
  real.shift();
  ok('a title with & < > survives escaping without breaking the document',
    out.includes('Fish &amp; Chips &lt;script&gt;') && !out.includes('<script>'));
  ok('the JSON feed handles the same title without corruption',
    (() => { real.unshift(nasty); const j = JSON.stringify(changelogFeed('https://x.test')); real.shift(); return JSON.parse(j).shipped[0].title === nasty.title; })());
}

// --- /changelog.md ---------------------------------------------------------
const md = await get('/changelog.md');
ok('markdown twin leads with an H1', md.startsWith('# Horda'));
ok('it carries every shipped entry', SHIPPED.every(e => md.includes(e.title)));
ok('it separates shipped from the "now building" promises', md.includes('## Shipped') && md.includes('## Now building'));
ok('it states plainly that "building" is not live', /NOT live yet/i.test(md));
ok('it is markdown, not HTML with the tags removed', !md.includes('<div') && !md.includes('</'));

// --- /llms.txt (llmstxt.org spec) ------------------------------------------
const llms = await get('/llms.txt');
const lines = llms.split('\n');
ok('llms.txt: H1 first — the only required element in the spec', lines[0] === '# Horda');
ok('llms.txt: blockquote summary directly after the H1', lines[2]?.startsWith('> '));
ok('llms.txt: H2 sections of link lists, per spec', /^## Docs$/m.test(llms) && /^## Legal$/m.test(llms));
// "## Optional" is load-bearing in the spec: a consumer short on context may skip
// it. Only secondary material may live there.
ok('llms.txt: "## Optional" section present for skippable material', /^## Optional$/m.test(llms));
ok('llms.txt: links are markdown with a description after the colon', /- \[.+\]\(https?:\/\/[^)]+\): .+/.test(llms));
ok('llms.txt: every link is absolute', ![...llms.matchAll(/\]\(([^)]+)\)/g)].some(m => !/^https?:\/\//.test(m[1])));
ok('llms.txt: points at the machine changelog, not just the HTML one', llms.includes('/changelog.json') && llms.includes('/changelog.md'));

// The point of llms.txt is that a model gets the facts WITHOUT crawling. If it
// has to infer the business model or the legal posture, it will infer wrong.
ok('llms.txt states the business model outright', /10%/.test(llms));
ok('llms.txt states the platform-not-organiser position', /not the event organiser/i.test(llms));
ok('llms.txt states the no-resale position', /does not offer ticket resale/i.test(llms));
ok('llms.txt states that fan activity is private', /activity is private/i.test(llms));
ok('llms.txt is honest that this is pre-launch', /not yet formally launched/i.test(llms));

// --- /sitemap.xml ----------------------------------------------------------
const sm = await get('/sitemap.xml');
// A wrong xmlns invalidates the whole file, and nothing tells you.
ok('sitemap uses the real namespace (sitemaps.org, plural)', sm.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
ok('sitemap lists the public pages', ['/about', '/changelog', '/agb', '/impressum'].every(p => sm.includes(`<loc>${base.replace('http://', 'https://')}${p}</loc>`) || sm.includes(p)));
ok('every loc is absolute', [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].every(m => /^https?:\/\//.test(m[1])));
// PRIVACY + DISCOVERABILITY. Public upcoming events ARE listed now (so a crawler
// can find each event page and read its schema.org JSON-LD — the point of the
// events-for-AI work). But fan activity is private — that rule doesn't stop
// applying because the visitor is a crawler — and passes/records never appear.
// (The unlisted-and-past exclusions are asserted in the schema.org block below,
// where events are seeded to test against.)
ok('sitemap lists no fans, passes or records (fan activity is private)', !/<loc>[^<]*\/(fan|pass|record)\//.test(sm));

// --- /robots.txt -----------------------------------------------------------
const robots = await get('/robots.txt');
ok('robots points at the sitemap', robots.includes('Sitemap:') && robots.includes('/sitemap.xml'));
ok('robots points at llms.txt so a model can find the map', robots.includes('/llms.txt'));
ok('robots allows the public site', /^Allow: \/$/m.test(robots));
for (const p of ['/pass/', '/record', '/fan/', '/settings', '/manage/']) {
  ok(`robots keeps ${p} out of the index (fan activity is private)`, robots.includes(`Disallow: ${p}`));
}
ok('robots keeps auth flows out — a token must never land in a search result',
  robots.includes('Disallow: /login') && robots.includes('Disallow: /auth/'));

// --- ids -------------------------------------------------------------------
ok('entryId is stable across calls', entryId(SHIPPED[0]) === entryId(SHIPPED[0]));
ok('entryId leads with the date, so ids sort chronologically', /^\d{4}-\d{2}-\d{2}-/.test(entryId(SHIPPED[0])));
ok('entryId is readable, not a hash — an opaque id in a URL helps nobody', /[a-z]{3,}/.test(entryId(SHIPPED[0])));
ok('entryIds are unique across the whole changelog',
  new Set(SHIPPED.map(entryId)).size === SHIPPED.length);

// --- schema.org/Event JSON-LD (AI/search event discovery) ------------------
// The structured fact an answer engine reads for "what's on this weekend?".
console.log('\n[machine] schema.org Event structured data');
const club = (await app.db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const evLd = (await app.db.query<{ id: string }>(
  `INSERT INTO event (name, description, starts_at, timezone, location, location_kind, host_kind, host_id, admission, price_cents, currency, capacity, visibility)
   VALUES ('Schema Test Match','desc', now()+interval '5 days','Europe/Berlin','Poststadion, Berlin','in_person','club',$1,'paid',1500,'EUR',200,'public') RETURNING id`, [club])).rows[0].id;
const evLdPage = await get(`/e/${evLd}`);
const ldMatch = evLdPage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
ok('a public event emits schema.org JSON-LD', !!ldMatch);
if (ldMatch) {
  const ld = JSON.parse(ldMatch[1]);
  ok('it is a valid schema.org/Event', ld['@context'] === 'https://schema.org' && ld['@type'] === 'Event');
  ok('it carries the ISO start instant (engines localise via location)', /^\d{4}-\d{2}-\d{2}T/.test(ld.startDate));
  ok('it names the organiser with a URL', ld.organizer?.name && /^https?:\/\//.test(ld.organizer.url));
  ok('it states the venue as a Place', ld.location?.['@type'] === 'Place' && ld.location.name.includes('Poststadion'));
  ok('it states a truthful Offer (price + currency + availability)',
    ld.offers?.price === '15.00' && ld.offers.priceCurrency === 'EUR' && /InStock|SoldOut/.test(ld.offers.availability));
  ok('the attendance mode is a real schema.org enum', /EventAttendanceMode$/.test(ld.eventAttendanceMode));
  ok('the event URL is absolute', /^https?:\/\//.test(ld.url));
}
// The privacy invariant, again: unlisted must NOT become a structured search
// result — and must not appear in the sitemap that leads crawlers to it.
await app.db.query(`UPDATE event SET visibility='unlisted' WHERE id=$1`, [evLd]);
ok('an unlisted event emits NO JSON-LD (private stays private)', !(await get(`/e/${evLd}`)).includes('application/ld+json'));
ok('an unlisted event is NOT in the sitemap', !(await get('/sitemap.xml')).includes(`/e/${evLd}`));
await app.db.query(`UPDATE event SET visibility='public' WHERE id=$1`, [evLd]);
ok('a public upcoming event IS in the sitemap (so a crawler can find it)', (await get('/sitemap.xml')).includes(`/e/${evLd}`));
// A finished event drops out — a search result for last week's match is worse
// than none.
await app.db.query(`UPDATE event SET starts_at = now() - interval '10 days' WHERE id=$1`, [evLd]);
ok('a past event drops out of the sitemap', !(await get('/sitemap.xml')).includes(`/e/${evLd}`));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
