// _crawl.ts — the QA a test suite can't do: walk the site like a person.
//
// Every suite we have asserts something SOMEBODY THOUGHT OF. This does the
// opposite: it follows every link from every reachable page, in each viewer
// state, and reports anything that breaks. It finds the bugs nobody predicted —
// dead anchors, 500s on a page we forgot, links that only appear for a host.
//
// This is exactly the shape of the last P0: `esc is not defined` 500'd every
// real user's event page while every seeded event passed, because the tests only
// ever visited seeded events. A crawler doesn't know what's supposed to work.
//
// Run: node _crawl.ts
import { startServer } from './src/web/server.ts';

const app = await startServer(0);
const base = `http://localhost:${app.port}`;

// Real user-generated data — the crawl must not only see the seed. Everything
// below is created THROUGH the app, the way a person would.
const form = (o: Record<string, string>) => ({
  method: 'POST' as const,
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(o).toString(),
  redirect: 'manual' as const,
});

const hostId = (await app.db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const mk = await fetch(`${base}/events`, form({
  host_kind: 'club', host_id: hostId,
  title: 'Crawl Test — Hybrid Paid Event',
  starts_at: '2027-03-01T19:30', timezone: 'Europe/Berlin',
  location_kind: 'hybrid', location: 'Poststadion, Berlin',
  description: 'Created through the form, like a person would.',
  fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '15', fmt_inperson_cap: '40',
  fmt_stream: '1', fmt_stream1_url: 'https://twitch.tv/x', st_cost: 'open',
  access_mode: 'ticket', room_enabled: '1',
}));
// Creating an event redirects to /e/<id>/room (straight into the event room),
// not /e/<id> — so pull the UUID out rather than assuming the shape of the path.
const mkLoc = mk.headers.get('location') || '';
const newEvent = (mkLoc.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [''])[0];
if (!newEvent) { console.error(`FATAL: event creation did not redirect to an event (got "${mkLoc}")`); process.exit(1); }
console.log(`created a real event via the form → ${mkLoc}\n`);

type Result = { url: string; status: number; from: string; error?: string };
const seen = new Set<string>();
const results: Result[] = [];
const problems: Result[] = [];

// Signatures of a page that rendered "successfully" while being broken. A 200
// with a stack trace in it is the worst kind of failure: nothing alerts.
const ERROR_MARKS = [
  'is not defined', 'ReferenceError', 'TypeError', 'undefined is not',
  'Cannot read propert', '[object Object]', 'NaN', 'null</', '>undefined<',
  'Internal error', 'ECONNREFUSED',
];

/**
 * `guest` is decided PER REQUEST (`!account || ?guest=1`), so crawling as a guest
 * means carrying ?guest=1 onto every hop. The first version only put it on the
 * entry URL — so 95 of 96 "guest" pages were actually the demo fan, and the two
 * crawls were the same crawl twice. A QA tool that quietly tests the wrong thing
 * is worse than none: it reports success.
 */
async function crawl(start: string, label: string, asGuest: boolean, maxPages = 140) {
  const withGuest = (p: string) => !asGuest ? p : p + (p.includes('?') ? '&' : '?') + 'guest=1';
  // Track WHERE each link came from — "dead anchor #join" is unactionable until
  // you know which page rendered it.
  const queue: [string, string][] = [[start, '(entry)']];
  seen.clear();
  let pages = 0;
  while (queue.length && pages < maxPages) {
    const [path, from] = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    pages++;

    let r: Response;
    try {
      r = await fetch(base + withGuest(path), { redirect: 'manual' });
    } catch (e: any) {
      problems.push({ url: path, status: 0, from: `${label} ← ${from}`, error: `fetch failed: ${e?.message}` });
      continue;
    }
    const rec: Result = { url: path, status: r.status, from: `${label} ← ${from}` };
    results.push(rec);

    // 3xx is fine (auth gates, canonical redirects). 4xx/5xx from a link WE
    // rendered is not: we linked to it, so we said it exists.
    if (r.status >= 400) {
      rec.error = `HTTP ${r.status}`;
      problems.push(rec);
      continue;
    }
    if (r.status >= 300) continue;

    const type = r.headers.get('content-type') || '';
    if (!type.includes('text/html')) continue;
    const body = await r.text();

    for (const mark of ERROR_MARKS) {
      // Skip legitimate uses: "undefined" inside a <script> is often fine, and
      // "NaN" appears in minified libs. Only flag it in rendered TEXT.
      const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
      if (text.includes(mark)) {
        problems.push({ url: path, status: r.status, from: `${label} ← ${from}`, error: `rendered "${mark}"` });
        break;
      }
    }
    if (body.length < 400) {
      problems.push({ url: path, status: r.status, from: `${label} ← ${from}`, error: `suspiciously empty (${body.length} bytes)` });
    }

    // Follow same-origin links. Skip logout (ends the session mid-crawl) and
    // anything destructive.
    for (const m of body.matchAll(/href="(\/[^"#?][^"]*)"/g)) {
      const href = m[1];
      if (/^\/(logout|auth\/|set-lang)/.test(href)) continue;
      if (!seen.has(href)) queue.push([href, path]);
    }
    // Dead anchors: a link to #foo where no id="foo" exists. This is how the
    // club page's fake "#shop" shelf survived for months.
    for (const m of body.matchAll(/href="#([^"]+)"/g)) {
      const id = m[1];
      if (id && id !== 'ask' && !body.includes(`id="${id}"`)) {
        problems.push({ url: path, status: 200, from: `${label} ← ${from}`, error: `dead anchor #${id}` });
      }
    }
  }
  return pages;
}

console.log('\n════════ CRAWL: following every link, as each kind of viewer ════════\n');

// GUEST — the state most visitors are actually in, and the one most likely to
// hit a page that assumes a logged-in viewer.
const guestPages = await crawl('/', 'guest', true);
console.log(`guest        ${guestPages} pages crawled`);

// LOGGED-IN FAN (the demo viewer).
const fanPages = await crawl('/', 'fan', false);
console.log(`fan          ${fanPages} pages crawled`);

// The surfaces that only exist for real, user-created data.
console.log('\n──────── user-created event (not the seed) ────────');
const targeted: [string, string][] = [
  ['/e/' + newEvent, 'the event page, created through the form'],
  ['/e/' + newEvent + '/card.png', 'its share card'],
  ['/e/' + newEvent + '/card.svg', 'card svg'],
  ['/e/' + newEvent + '/ics', 'calendar export'],
  ['/e/' + newEvent + '/room', 'the event room (the esc-is-not-defined trap)'],
  ['/manage/' + newEvent, 'organiser manage view'],
  ['/e/' + newEvent + '/check-in', 'door check-in'],
  ['/changelog', 'changelog'],
  ['/changelog.json', 'machine feed'],
  ['/changelog.md', 'markdown twin'],
  ['/feed.xml', 'rss'],
  ['/llms.txt', 'llms.txt'],
  ['/sitemap.xml', 'sitemap'],
  ['/robots.txt', 'robots'],
  ['/agb', 'terms'], ['/widerruf', 'withdrawal'],
  ['/impressum', 'impressum'], ['/datenschutz', 'privacy'],
  ['/about', 'about'], ['/pros', 'pros door'],
];
for (const [path, what] of targeted) {
  const r = await fetch(base + path, { redirect: 'manual' });
  const okish = r.status < 400;
  if (!okish) problems.push({ url: path, status: r.status, from: 'targeted', error: `HTTP ${r.status}` });
  console.log(`  ${okish ? 'ok  ' : 'FAIL'} ${String(r.status).padEnd(3)} ${path.padEnd(42)} ${what}`);
}

// The claim flow end to end, on the event we just made — the money path.
console.log('\n──────── the claim flow, on real data ────────');
const fmt = (await app.db.query<{ id: string; kind: string }>(`SELECT id, kind FROM event_format WHERE event_id=$1 ORDER BY sort`, [newEvent])).rows;
console.log(`  ok   ${fmt.length} doors created: ${fmt.map(f => f.kind).join(', ')}`);
const claimRes = await fetch(`${base}/claim/${newEvent}`, form({ name: 'Crawl Fan', contact: `crawl${Date.now()}@x.co`, format_id: fmt[0]?.id ?? '', [`party_size_${fmt[0]?.id}`]: '2' }));
const passUrl = claimRes.headers.get('location') || '';
console.log(`  ${passUrl.startsWith('/pass/') ? 'ok  ' : 'FAIL'} claim → ${passUrl}`);
if (passUrl) {
  const p = await fetch(base + passUrl);
  const pb = await p.text();
  console.log(`  ${p.status === 200 ? 'ok  ' : 'FAIL'} pass renders (${p.status})`);
  console.log(`  ${pb.includes('hzqr') ? 'ok  ' : 'FAIL'} QR present on the pass`);
  console.log(`  ${!pb.includes('Wallet — soon') ? 'ok  ' : 'FAIL'} no dead Wallet chip`);
}

await app.close();

// ---------------------------------------------------------------------------
console.log('\n════════ RESULT ════════');
console.log(`${results.length} pages fetched · ${problems.length} problems\n`);
const byUrl = new Map<string, Result>();
for (const p of problems) if (!byUrl.has(p.url + p.error)) byUrl.set(p.url + p.error, p);
for (const p of [...byUrl.values()]) console.log(`  ✗ ${p.error}\n      at ${p.url}\n      linked from ${p.from}`);
if (!byUrl.size) console.log('  Nothing broken.');
console.log('');
process.exit(byUrl.size ? 1 : 0);
