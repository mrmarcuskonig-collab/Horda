// community.test.ts — the "engineering as GTM" surfaces: the public changelog
// and the env-gated Discord invite.
//
// Two things are actually worth testing here:
//   1. The changelog DATA is honest and well-formed. A changelog that lies
//      (bad dates, empty bodies, a duplicate entry) is worse than none.
//   2. Discord is genuinely env-gated. A dead invite link on a live marketing
//      page is a trust bug, which is the exact opposite of the point.
// Run: node tests/community.test.ts
import { SHIPPED, BUILDING } from '../src/content/changelog.ts';
import { discordUrl, hasDiscord, discordBtn, discordModule, discordFootLink } from '../src/web/community.ts';
import { renderChangelog } from '../src/web/pitch.ts';

let pass = 0, fail = 0;
const ok = (n: string, cond: boolean) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${n}`); cond ? pass++ : fail++; };

console.log('\n[community] changelog data + Discord gating');

// --- 1. the changelog data is honest -------------------------------------
ok('there is something shipped to show', SHIPPED.length > 0);
ok('there is something building to promise', BUILDING.length > 0);
ok('"now building" stays short enough to read as focus, not a wishlist', BUILDING.length <= 6);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
ok('every shipped entry has a valid ISO date', SHIPPED.every(e => ISO.test(e.date) && !Number.isNaN(Date.parse(e.date))));
ok('every shipped entry has a real title and body', SHIPPED.every(e => e.title.trim().length > 3 && e.body.trim().length > 10));
ok('every tag is one we can render', SHIPPED.every(e => ['new', 'better', 'fixed'].includes(e.tag)));

// Newest-first ordering: the page renders in array order, so a mis-sorted array
// silently renders a wrong timeline rather than throwing.
const dates = SHIPPED.map(e => Date.parse(e.date));
ok('shipped entries are ordered newest-first', dates.every((d, i) => i === 0 || d <= dates[i - 1]));

// Nothing may be dated in the future: "shipped" must mean shipped.
const todayEnd = Date.now() + 24 * 3600 * 1000;
ok('nothing is listed as shipped before it shipped (no future dates)', dates.every(d => d <= todayEnd));

// Duplicate titles usually mean someone pasted an entry twice.
const titles = SHIPPED.map(e => e.title.toLowerCase());
ok('no duplicate shipped entries', new Set(titles).size === titles.length);

// A thing cannot be both shipped and still "now building" — that's the single
// most damaging inconsistency this page can have.
const buildingTitles = new Set(BUILDING.map(b => b.title.toLowerCase()));
ok('nothing is listed as both shipped and still building', !titles.some(t => buildingTitles.has(t)));

// Credits are handles, not emails/real names — we promised handle-only.
const asked = [...SHIPPED, ...BUILDING].map(e => e.asked).filter(Boolean) as string[];
ok('credits are bare handles (no @, no emails)', asked.every(a => !a.includes('@') && !a.includes(' ')));

// --- 2. Discord wiring ----------------------------------------------------
// The server now exists, so the invite ships as a code default and env only
// OVERRIDES it. The contract this locks down:
//   - default on, no env needed
//   - every user-facing link goes through /discord (never the raw invite), so
//     the invite can be rotated without editing links
//   - a /channels/ deep link is refused (it 404s for non-members)
//   - an explicit empty env var is the kill switch
const saved = process.env.DISCORD_INVITE_URL;

delete process.env.DISCORD_INVITE_URL;
ok('no env needed → Discord is live by default', hasDiscord() === true);
ok('default is a real discord.gg invite, not a channel link', discordUrl().includes('discord.gg/') && !discordUrl().includes('/channels/'));

// Every surface must publish /discord, never the raw invite — that indirection
// is the whole point (rotate the invite in env, links keep working).
ok('footer link points at /discord, not the raw invite', discordFootLink().includes('href="/discord"') && !discordFootLink().includes('discord.gg'));
ok('button points at /discord', discordBtn().includes('href="/discord"') && !discordBtn().includes('discord.gg'));
ok('module points at /discord', discordModule().includes('href="/discord"') && !discordModule().includes('discord.gg'));
const on = renderChangelog(true);
ok('changelog links Discord via /discord', on.includes('/discord') && !on.includes('discord.gg'));

// A channel URL is not an invite. This is the exact mistake that was nearly
// shipped — it silently fails for everyone who isn't already a member.
process.env.DISCORD_INVITE_URL = 'https://discord.com/channels/1527306633506721873/1527306634601168958';
ok('a /channels/ deep link is refused as not-an-invite', hasDiscord() === false && discordUrl() === '');
ok('refused invite → no Discord link renders anywhere', [discordBtn(), discordModule(), discordFootLink()].every(s => s === ''));
const off = renderChangelog(true);
ok('refused invite → changelog still offers a way to ask', off.includes('Tell us what to build'));

// Kill switch: an explicit empty value turns everything off without a deploy.
process.env.DISCORD_INVITE_URL = '';
ok('explicit empty env var is the kill switch', hasDiscord() === false && discordBtn() === '');
process.env.DISCORD_INVITE_URL = '   ';
ok('whitespace-only env var also counts as off', hasDiscord() === false);

process.env.DISCORD_INVITE_URL = 'https://discord.gg/rotated';
ok('env overrides the default invite', discordUrl() === 'https://discord.gg/rotated');

if (saved === undefined) delete process.env.DISCORD_INVITE_URL; else process.env.DISCORD_INVITE_URL = saved;

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
