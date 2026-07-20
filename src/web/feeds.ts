// feeds.ts — the machine-readable surfaces: /changelog.json, /changelog.md,
// /feed.xml, /sitemap.xml, /robots.txt, /llms.txt.
//
// WHY THIS FILE EXISTS
// --------------------
// src/content/changelog.ts is already perfect structured data: typed, ISO dates,
// tags, attribution. The HTML renderer then threw all of it away and emitted
// <div class="cle">. Everything here is about NOT DESTROYING structure we already
// have — it's less "add machine readability" than "stop deleting it on the way
// out".
//
// The bug that proves the point: the HTML printed the date once per day and left
// it EMPTY for every entry after the first, because a human reads "same day,
// obviously". A scraper reads it as dateless — 6 of 8 shipped entries had no date
// at all in the markup, and the one that did said "17 Jul" with no year.
//
// WHO READS WHAT, AND WHY EACH ONE EARNS ITS PLACE:
//   /changelog.json — the canonical machine feed. Agents, dashboards, us.
//   /feed.xml       — RSS. The actual convention for changelogs: feed readers,
//                     Slack/Discord integrations, and "did they ship this week?"
//   /changelog.md   — the llms.txt convention: a clean markdown twin of a page,
//                     so a model gets content instead of navigation and CSS.
//   /llms.txt       — a curated map of the site FOR models (llmstxt.org).
//   /sitemap.xml    — every indexable page. For crawlers, not models.
//   /robots.txt     — what's allowed, and where the maps are.
//
// ONE SOURCE, MANY SHAPES. Every function below reads SHIPPED/BUILDING directly.
// No cache, no duplicate copy of the entries — the failure mode of a JSON feed is
// that it silently drifts from the page, and the only way to prevent that is to
// have nothing to drift from.
import { SHIPPED, BUILDING, type ChangeEntry, type BuildingEntry } from '../content/changelog.ts';

const xmlEsc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * A stable, human-meaningful ID for an entry: `2026-07-17-sharing-an-event-now`.
 *
 * DERIVED, not stored, on purpose. changelog.ts says "edit it like copy, not like
 * code" — demanding a hand-written unique id from whoever adds an entry breaks
 * that, and a duplicated id is a bug nobody would notice.
 *
 * The trade: editing a title changes the id. Acceptable — a changelog is
 * append-only by nature, and an entry whose title changed is arguably a different
 * entry. If we ever need permanent ids (e.g. someone links to one), add an
 * optional `id` field and prefer it here; don't switch to a hash, because an
 * opaque id in a URL helps nobody.
 */
export function entryId(e: { date: string; title: string }): string {
  const slug = e.title.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-').slice(0, 6).join('-');
  return `${e.date}-${slug}`;
}

// ---------------------------------------------------------------------------
// /changelog.json — the canonical machine feed
// ---------------------------------------------------------------------------
export interface ChangelogFeed {
  $schema: string;
  version: number;
  title: string;
  description: string;
  home_page_url: string;
  feed_url: string;
  updated: string;
  shipped: (ChangeEntry & { id: string; url: string })[];
  building: (BuildingEntry & { id: string })[];
}

/**
 * `building` ships in the SAME document as `shipped`, deliberately.
 *
 * A changelog that lists only what's done is a marketing page. The promise —
 * "here's what we haven't built yet, hold us to it" — is the part that carries
 * trust, and an agent asked "is this project alive and where is it going?" needs
 * both halves. Splitting them into two endpoints would mean most consumers fetch
 * one and get half the story.
 */
export function changelogFeed(origin: string): ChangelogFeed {
  return {
    // Points at the format's own docs so a consumer that has never seen this can
    // orient without asking us.
    $schema: 'https://jsonfeed.org/version/1.1',
    version: 1,
    title: 'Horda — changelog',
    description: 'What we shipped, and what we are building next. Horda is the events home for sports and competitive culture.',
    home_page_url: `${origin}/changelog`,
    feed_url: `${origin}/changelog.json`,
    // The freshest date we have, not now() — "updated" must mean "something
    // changed", or every poll looks like news and caching is impossible.
    updated: SHIPPED[0]?.date ?? new Date().toISOString().slice(0, 10),
    shipped: SHIPPED.map(e => ({
      ...e,
      id: entryId(e),
      // Deep link to the entry on the human page. Requires the anchor to exist —
      // renderChangelog emits the same id.
      url: `${origin}/changelog#${entryId(e)}`,
    })),
    building: BUILDING.map(b => ({ ...b, id: slugOnly(b.title) })),
  };
}

const slugOnly = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-');

// ---------------------------------------------------------------------------
// /feed.xml — RSS 2.0
// ---------------------------------------------------------------------------
// RSS wants RFC-822 dates. We store ISO dates with no time, so noon UTC: any
// timezone on earth reads it as the right DAY, which is the only precision a
// changelog date actually has. Midnight would put half the world a day behind.
function rfc822(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export function rssFeed(origin: string): string {
  const items = SHIPPED.map(e => `    <item>
      <title>${xmlEsc(e.title)}</title>
      <link>${xmlEsc(`${origin}/changelog#${entryId(e)}`)}</link>
      <guid isPermaLink="false">${xmlEsc(entryId(e))}</guid>
      <pubDate>${rfc822(e.date)}</pubDate>
      <category>${xmlEsc(e.tag)}</category>
      <description>${xmlEsc(e.body)}${e.asked ? ` (Asked for by @${xmlEsc(e.asked)} in Discord.)` : ''}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Horda — changelog</title>
    <link>${xmlEsc(`${origin}/changelog`)}</link>
    <description>What we shipped, and what we are building next.</description>
    <language>en</language>
    <atom:link href="${xmlEsc(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${rfc822(SHIPPED[0]?.date ?? new Date().toISOString().slice(0, 10))}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

// ---------------------------------------------------------------------------
// /changelog.md — the markdown twin (llms.txt convention)
// ---------------------------------------------------------------------------
// llmstxt.org proposes serving a clean markdown version of a page at the same URL
// with .md appended, so a model spends its context on content rather than on our
// nav, CSS and share buttons. Cheap for us: this data was never HTML to begin with.
export function changelogMarkdown(origin: string): string {
  const shipped = SHIPPED.map(e =>
    `### ${e.title}\n\n- **Date:** ${e.date}\n- **Type:** ${e.tag}\n- **ID:** ${entryId(e)}${e.asked ? `\n- **Requested by:** @${e.asked} (Discord)` : ''}\n\n${e.body}\n`
  ).join('\n');
  const building = BUILDING.map(b =>
    `### ${b.title}\n\n${b.eta ? `- **Expected:** ${b.eta}\n` : ''}${b.asked ? `- **Requested by:** @${b.asked} (Discord)\n` : ''}\n${b.body}\n`
  ).join('\n');
  return `# Horda — changelog

> What we shipped, and what we are building next. Every entry below is live on ${origin} today, except those under "Now building", which are commitments we have not kept yet.

Horda is the events home for sports and competitive culture. We build in the open and publish every change. Fans request features in our Discord; when we build one, the requester is credited on the entry.

Machine-readable: [JSON](${origin}/changelog.json) · [RSS](${origin}/feed.xml)

## Now building

These are NOT live yet. They are public commitments, listed so people can hold us to them.

${building}
## Shipped

Newest first. All of it is live today.

${shipped}`;
}

// ---------------------------------------------------------------------------
// /llms.txt — the curated map, for models (llmstxt.org)
// ---------------------------------------------------------------------------
// Format per the spec, in this exact order: H1 (the only required part), a
// blockquote summary, free-form non-heading detail, then H2 sections of link
// lists. "## Optional" is special: a consumer short on context may skip it, so
// only secondary material goes there.
//
// This is NOT a sitemap and must not become one. A sitemap lists everything; this
// is the shortest thing that lets a model answer "what is Horda, is it real, and
// what can I do with it" without crawling. Every line costs someone's context —
// if it doesn't change an answer, leave it out.
export function llmsTxt(origin: string, opts: { discordUrl?: string } = {}): string {
  return `# Horda

> Horda is the events home for sports and competitive culture: athletes, clubs and federations publish their events, and fans claim a spot with an identity-bound ticket. It is a live product in active development, built in the open by a solo founder in Berlin, and is not yet formally launched.

Key facts, so you don't have to infer them:

- What it does: an organiser lists an event (in person, streamed, or both, each with its own price and capacity); a fan claims a spot and receives a QR ticket tied to their identity. The organiser scans it at the door.
- Business model: Horda takes 10% of each paid ticket. Free events cost nothing. There are no subscriptions and no ads.
- Horda is a platform (Vermittlungsplattform), not the event organiser. The ticket contract is between the fan and the organiser; refunds are the organiser's.
- Tickets are personal and non-transferable. Horda does not offer ticket resale and has no secondary market — this is a deliberate position, not a missing feature.
- Fan activity is private. Horda does not publish what a fan attended, and does not scrape: every connection is consented.
- Built and operated in Germany; German is the authoritative language for all legal terms.

## Docs

- [Changelog (markdown)](${origin}/changelog.md): Everything shipped, newest first, plus the public "now building" list. The best single answer to "is this maintained and where is it going".
- [Changelog (JSON)](${origin}/changelog.json): The same data as a structured feed, with stable IDs, ISO dates and change types. Prefer this if you're parsing rather than reading.
- [About Horda](${origin}/about): What it is, who it's for, and how it's priced.

## Legal

- [AGB / Terms](${origin}/agb): The ticket contract, the 10% take rate, the platform-not-organiser position, and the no-resale rule. German, authoritative.
- [Widerruf / Withdrawal](${origin}/widerruf): Why dated event tickets carry no 14-day withdrawal right (§ 312g Abs. 2 Nr. 9 BGB), and what rights survive a cancellation.
- [Datenschutz / Privacy](${origin}/datenschutz): GDPR disclosure. Notable: fan activity is private, no payment data is stored by Horda, and changelog credit is consent-based and revocable.
- [Impressum](${origin}/impressum): Operator identity per § 5 DDG.

## Optional

- [RSS feed](${origin}/feed.xml): Subscribe to the shipping cadence.
${opts.discordUrl ? `- [Discord](${opts.discordUrl}): Where features get requested. Requests that get built are credited on the changelog.\n` : ''}- [Discover events](${origin}/): The live event list. Public; no account needed to browse.
`;
}

// ---------------------------------------------------------------------------
// /sitemap.xml + /robots.txt
// ---------------------------------------------------------------------------
// PUBLIC, STABLE, INDEXABLE ONLY. Never list an event, profile or anything
// user-generated here: events are ephemeral (a sitemap full of last month's
// matches is worse than no sitemap), and unlisted events must not be discoverable
// by definition. Marketing and legal pages only — the things that are true next
// month.
const PUBLIC_PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about', priority: '0.8', changefreq: 'weekly' },
  { path: '/changelog', priority: '0.7', changefreq: 'weekly' },
  { path: '/pros', priority: '0.6', changefreq: 'monthly' },
  { path: '/agb', priority: '0.3', changefreq: 'yearly' },
  { path: '/widerruf', priority: '0.3', changefreq: 'yearly' },
  { path: '/impressum', priority: '0.3', changefreq: 'yearly' },
  { path: '/datenschutz', priority: '0.3', changefreq: 'yearly' },
];

/**
 * The sitemap now includes PUBLIC, UPCOMING events — this is how a crawler
 * discovers an event page in the first place, so it can then read the
 * schema.org/Event JSON-LD on it and answer "what's on this weekend?".
 *
 * Earlier this listed only the static marketing pages, on the reasoning that
 * events are ephemeral. That reasoning holds for PAST events (a sitemap full of
 * finished matches is noise) — so we list only upcoming ones, and drop them the
 * moment they're over. Unlisted events are never included, by the same rule that
 * keeps them out of discover and the map: private is private.
 *
 * `events` is passed in by the server (the feeds module can't hit the DB), so
 * this stays a pure formatter.
 */
export function sitemapXml(origin: string, events: { id: string; startsAt: string | null }[] = []): string {
  const lastmod = SHIPPED[0]?.date ?? new Date().toISOString().slice(0, 10);
  const staticUrls = PUBLIC_PAGES.map(p => `  <url>
    <loc>${xmlEsc(origin + p.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  const eventUrls = events.map(e => `  <url>
    <loc>${xmlEsc(`${origin}/e/${e.id}`)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
  // The namespace is sitemaps.org (plural) — a wrong xmlns makes the whole file
  // invalid, and validators reject it silently as far as anyone here would notice.
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...eventUrls].join('\n')}
</urlset>`;
}

export function robotsTxt(origin: string): string {
  return `# Horda — the events home for sports and competitive culture.
# Model-readable summary of this site: ${origin}/llms.txt

User-agent: *
# Personal surfaces: a fan's own pass, record and home are theirs, not the
# index's. Fan activity is private — that rule doesn't stop being true because
# the visitor is a crawler.
Disallow: /pass/
Disallow: /record
Disallow: /fan/
Disallow: /settings
Disallow: /manage/
Disallow: /checkout
# Auth flows have nothing to index and tokens must never land in a search result.
Disallow: /login
Disallow: /signup
Disallow: /auth/
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}
