// legal.test.ts — the Impressum/Datenschutz guardrails.
//
// These assert LEGAL invariants, not rendering. Each one maps to a way this
// page could quietly become a liability:
//   - unreachable/gated  → § 5 DDG requires "ständig verfügbar"
//   - missing mandatory field → Abmahnung
//   - OS-Plattform link present → the duty INVERTED on 20 July 2025; having it
//     is now the violation. Every generator still emits it, so this test is the
//     only thing standing between us and a copy-paste regression.
//
// LANGUAGE: as of 27 Jul 2026 the pages read in ENGLISH prose to match the
// English-only product, but German LAW governs, so the statutory CITATIONS stay
// in German form (§ 5 DDG, DSGVO articles, § 312g BGB). The assertions below
// check the German citations (the legal invariant) and the English headings
// (the prose), so a regression in either direction fails.
// Run: node tests/legal.test.ts
import { startServer } from '../src/web/server.ts';
import { renderImpressum, renderDatenschutz, OPERATOR } from '../src/web/legal.ts';
import { TAKE_RATE_PCT } from '../src/web/terms.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = async (p: string) => (await fetch(base + p)).text();
const raw = async (p: string) => await fetch(base + p, { redirect: 'manual' });

console.log('\n[legal] Impressum · Datenschutz · Discord');

const imp = await get('/impressum');
const dat = await get('/datenschutz');

// --- reachability ---------------------------------------------------------
ok('/impressum is public (200, no auth)', (await raw('/impressum')).status === 200);
ok('/datenschutz is public (200, no auth)', (await raw('/datenschutz')).status === 200);
ok('/privacy redirects to /datenschutz', (await raw('/privacy')).headers.get('location') === '/datenschutz');
ok('Impressum is linked from the app footer', (await get('/')).includes('/impressum'));
ok('Impressum is linked from the marketing footer', (await get('/about')).includes('/impressum'));
ok('Datenschutz is linked from the app footer', (await get('/')).includes('/datenschutz'));

// --- § 5 DDG mandatory content -------------------------------------------
ok('cites § 5 DDG explicitly', imp.includes('§ 5 Digitale-Dienste-Gesetz'));
ok('names the operator', imp.includes(OPERATOR.name));
ok('gives a ladungsfähige Anschrift (street + city, no Postfach)', imp.includes(OPERATOR.street) && imp.includes(OPERATOR.city) && !/postfach/i.test(imp));
ok('gives a contact email', imp.includes(OPERATOR.email));
ok('names the person responsible per § 18 Abs. 2 MStV', imp.includes('§ 18 Abs. 2 MStV'));
ok('states the VAT-ID position (§ 27a UStG)', imp.includes('§ 27a'));
ok('states the VSBG consumer-arbitration position', /Verbraucherschlichtungsstelle/.test(imp));
ok('has liability-for-content (§ 7/§§ 8-10 DDG)', imp.includes('Liability for content') && imp.includes('§ 7 Abs. 1 DDG') && imp.includes('§§ 8 bis 10 DDG'));
ok('has liability-for-links', imp.includes('Liability for links'));
ok('has copyright (Urheberrecht)', imp.includes('Copyright') && imp.includes('Urheberrecht'));
ok('links to the Datenschutzerklärung', imp.includes('/datenschutz'));

// --- the inverted OS-Plattform duty (post 20 July 2025) -------------------
const osMention = (s: string) => /os-plattform|online-streitbeilegung|ec\.europa\.eu\/consumers\/odr|webgate\.ec\.europa\.eu\/odr/i.test(s);
ok('Impressum does NOT link the dead EU OS-Plattform', !osMention(imp));
ok('Datenschutz does NOT link the dead EU OS-Plattform', !osMention(dat));

// --- DSGVO mandatory content ---------------------------------------------
ok('names the controller (Verantwortlicher)', dat.includes(OPERATOR.name) && dat.includes('Verantwortlicher'));
ok('states legal bases (Art. 6)', dat.includes('Art. 6 Abs. 1 lit. b') && dat.includes('Art. 6 Abs. 1 lit. f') && dat.includes('Art. 6 Abs. 1 lit. a'));
ok('lists data-subject rights (Art. 15-21)', dat.includes('Art. 15') && dat.includes('Art. 17') && dat.includes('Art. 20'));
ok('has the Art. 21 right to object spelled out', dat.includes('Widerspruchsrecht') && dat.includes('Art. 21'));
ok('names the competent supervisory authority (Berlin)', dat.includes('Berliner Beauftragte für Datenschutz'));
ok('states retention periods', dat.includes('Retention period'));
ok('covers third-country transfers', /third countries|Standardvertragsklauseln/.test(dat));
ok('declares changelog credit as consent-based + revocable', dat.includes('consent') && dat.includes('withdraw') && dat.includes('/changelog'));
ok('states the Art. 8 minors rule (16) and the 18+ payout limit', dat.includes('16 years') && dat.includes('Art. 8 DSGVO') && dat.includes('18 years'));
ok('declares cookies as strictly necessary (§ 25 Abs. 2 TDDDG)', dat.includes('TDDDG'));
ok('states that fan activity is private', dat.includes('Fan activity is private'));
ok('states we never store payment data', dat.includes('Payment data is not collected or stored by me'));

// --- English prose, German law -------------------------------------------
ok('legal pages are served as English documents', imp.includes('<html lang="en"') && dat.includes('<html lang="en"'));

// --- AGB + Widerruf (required now that we sell tickets) ---------------------
const agb = await get('/agb');
const wid = await get('/widerruf');
ok('/agb is public', (await raw('/agb')).status === 200);
ok('/widerruf is public', (await raw('/widerruf')).status === 200);
ok('/terms and /withdrawal are English aliases', (await raw('/terms')).status === 200 && (await raw('/withdrawal')).status === 200);
ok('AGB is linked from the app footer', (await get('/')).includes('/agb'));

// THE structural decision: Furia is a Vermittler, not the Veranstalter. If Furia
// were the seller it would owe every consumer duty for every event on the
// platform — a refund for a cancelled Kreisliga match would be OUR problem.
ok('AGB states Furia is a platform, NOT the organiser', agb.includes('intermediary platform, not the event organiser'));
ok('AGB states the ticket contract is fan ↔ organiser', agb.includes('concluded exclusively between you and the respective organiser'));
ok('AGB states refunds are the organiser\'s, not ours', agb.includes('Furia supports the reversal technically') && agb.includes('does not itself owe the refund'));
// The take rate is a contract term — it must never drift from the code.
ok('AGB names the take rate from the same constant the code uses', agb.includes(`${TAKE_RATE_PCT}%`) && TAKE_RATE_PCT === 5);
ok('AGB says card data never touches Furia', agb.includes('Payment data is not collected or stored by Furia'));
ok('AGB covers UGC: you keep your rights, we get a licence to display', agb.includes('simple, geographically and temporally unlimited right'));
ok('AGB states tickets are identity-bound and non-transferable', agb.includes('identity-bound and non-transferable'));
// DECIDED: no resale, ever (17 Jul 2026). The AGB has to state a position, not
// describe a temporary gap — "currently not offered" invited the reader to
// expect it later. See tests/resale.test.ts for the enforcement side.
ok('AGB states Furia offers no resale, as a decision', agb.includes('no resale of tickets') && agb.includes('deliberate decision'));
ok('AGB carries the 16/18 age rules', agb.includes('16 years') && agb.includes('18 years'));
ok('AGB has a real liability clause (Kardinalpflicht)', agb.includes('Kardinalpflicht'));

// The clause the whole ticketing model depends on: § 312g(2)(9) BGB exempts
// dated leisure events from the 14-day withdrawal right (BGH 13.07.2022).
// Without it every ticket could be cancelled within 14 days.
ok('Widerruf cites § 312g Abs. 2 Nr. 9 BGB — the dated-event exemption', wid.includes('§ 312g Abs. 2 Nr. 9 BGB'));
ok('Widerruf states plainly that dated tickets have no withdrawal right', wid.includes('no right of withdrawal'));
ok('Widerruf preserves rights on cancellation/postponement', wid.includes('cancellation or substantial postponement'));
ok('Widerruf explains free spots need no withdrawal (no paid contract)', wid.includes('Free spots'));
ok('Widerruf includes the model withdrawal form', wid.includes('Model withdrawal form'));
ok('Widerruf gives a ladungsfähige address to withdraw to', wid.includes(OPERATOR.street));
// Same inverted duty as the Impressum.
ok('neither AGB nor Widerruf links the dead OS-Plattform', !osMention(agb) && !osMention(wid));
ok('both are served as English documents', agb.includes('<html lang="en"') && wid.includes('<html lang="en"'));

// --- Discord vanity redirect ---------------------------------------------
const d = await raw('/discord');
ok('/discord redirects to a real discord.gg invite', d.status >= 300 && d.status < 400 && (d.headers.get('location') || '').includes('discord.gg/'));

// A /channels/ deep link is NOT an invite — it 404s for non-members. Rather than
// hide Discord, we fall back to the default discord.gg invite so a working link
// is always published.
const saved = process.env.DISCORD_INVITE_URL;
process.env.DISCORD_INVITE_URL = 'https://discord.com/channels/1527306633506721873/1527306634601168958';
const { discordUrl, hasDiscord } = await import('../src/web/community.ts?bust=1');
ok('a /channels/ URL falls back to a real discord.gg invite', hasDiscord() === true && discordUrl().includes('discord.gg/') && !discordUrl().includes('/channels/'));
if (saved === undefined) delete process.env.DISCORD_INVITE_URL; else process.env.DISCORD_INVITE_URL = saved;

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
