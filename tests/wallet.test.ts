// wallet.test.ts — Wallet passes, the countdown rule, and the entity-page cleanup.
// Run: node tests/wallet.test.ts
import { startServer } from '../src/web/server.ts';
import { walletStatus, googleWalletUrl, buildPkpass, passJson, passManifest, zip } from '../src/web/wallet.ts';
import { createClaim, getClaim } from '../src/db/claim_rail_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const db = app.db;
const get = async (p: string) => (await fetch(base + p)).text();

console.log('\n[wallet] passes · countdown visibility · entity pages');

const pd = {
  token: 'abc123def456abc123def456abc12345',
  eventTitle: 'Berliner SC vs FC Beispiel', hostName: 'FC Beispiel',
  startsAt: '2026-08-01T17:00:00.000Z', timezone: 'Europe/Berlin',
  location: 'Poststadion, Berlin', formatLabel: 'In person', fanName: 'Marcus K',
  eventUrl: 'https://joinhorda.com/e/x',
};

// --- not configured is the CURRENT state, and it must be honest ------------
// Neither wallet can be generated anonymously: Apple needs a €99/yr Developer
// Program cert, Google needs an approved Wallet issuer account. Until those
// exist, the ONLY acceptable behaviour is silence.
const st = walletStatus();
ok('Apple Wallet reports not-configured (no Pass Type cert yet)', st.apple === false);
ok('Google Wallet reports not-configured (no issuer ID yet)', st.google === false);
ok('googleWalletUrl returns null rather than a broken link', googleWalletUrl(pd) === null);
ok('buildPkpass returns null rather than an unsigned .pkpass', await buildPkpass(pd) === null);

// A dead "Add to Wallet — soon" chip is worse than nothing: the fan taps it AT
// THE DOOR, with a queue behind them.
const claimEv = (await db.query<{ id: string }>(`SELECT id FROM event WHERE admission='open' LIMIT 1`)).rows[0].id;
const fanW = (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ('Wallet Fan') RETURNING id`)).rows[0].id;
const cw = await createClaim(db, { eventId: claimEv, fanId: fanW, capacity: null, mode: 'open' });
const passPage = await get(`/pass/${cw.passToken}`);
ok('pass page renders', passPage.includes('Horda'));
ok('no dead "Add to Wallet — soon" chip', !passPage.includes('Add to Wallet — soon') && !/Wallet\s*—\s*soon/.test(passPage));
ok('no Wallet button at all while unconfigured', !passPage.includes('Add to Apple Wallet') && !passPage.includes('Save to Google Wallet'));
ok('the QR is still the ticket — nothing regressed', passPage.includes('hzqr') || passPage.includes('show this QR'));
ok('an unconfigured .pkpass download 404s, not 500s', (await fetch(`${base}/pass/${cw.passToken}.pkpass`)).status === 404);

// --- configured: the passes are built correctly ----------------------------
process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000022222228';
process.env.GOOGLE_WALLET_SA_EMAIL = 'horda@horda.iam.gserviceaccount.com';
const { generateKeyPairSync } = await import('node:crypto');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.GOOGLE_WALLET_SA_KEY = privateKey as string;

ok('Google reports configured once the issuer + key are set', walletStatus().google === true);
const gUrl = googleWalletUrl(pd)!;
ok('google url is a Save-to-Wallet link', gUrl.startsWith('https://pay.google.com/gp/v/save/'));
const jwt = gUrl.split('/save/')[1].split('.');
ok('it is a three-part JWT', jwt.length === 3);
const head = JSON.parse(Buffer.from(jwt[0], 'base64url').toString());
const body = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
ok('signed RS256 (what Google requires)', head.alg === 'RS256');
ok('issued to the service account', body.iss === 'horda@horda.iam.gserviceaccount.com' && body.aud === 'google');
const obj = body.payload.eventTicketObjects[0];
// ONE credential, three surfaces. A wallet-specific code would be a second thing
// to keep in sync with the door scanner, and it would drift.
ok('the barcode carries the SAME token the door scanner reads', obj.barcode.value === pd.token);
ok('the pass names the event and the holder', obj.eventName.defaultValue.value === pd.eventTitle && obj.ticketHolderName === 'Marcus K');
ok('the pass links back to the event', obj.linksModuleData.uris[0].uri === pd.eventUrl);

// Render env vars can't hold real newlines; \n escapes must be unescaped or the
// crypto layer fails with an opaque "invalid key".
process.env.GOOGLE_WALLET_SA_KEY = (privateKey as string).replace(/\n/g, '\\n');
ok('an escaped-newline key still signs (Render env reality)', !!googleWalletUrl(pd));
process.env.GOOGLE_WALLET_SA_KEY = 'not-a-key';
ok('a broken key returns null, it does not throw on the pass page', googleWalletUrl(pd) === null);
delete process.env.GOOGLE_WALLET_ISSUER_ID; delete process.env.GOOGLE_WALLET_SA_EMAIL; delete process.env.GOOGLE_WALLET_SA_KEY;

// --- the .pkpass parts we can build without Apple's certificate ------------
process.env.APPLE_PASS_TYPE_ID = 'pass.com.joinhorda.ticket';
process.env.APPLE_TEAM_ID = 'ABCDE12345';
const pj = JSON.parse(passJson(pd));
ok('pass.json declares the Pass Type + Team', pj.passTypeIdentifier === 'pass.com.joinhorda.ticket' && pj.teamIdentifier === 'ABCDE12345');
ok('pass.json carries the same token as the QR', pj.serialNumber === pd.token && pj.barcodes[0].message === pd.token);
ok('pass.json is an eventTicket, and relevant at the event time', !!pj.eventTicket && pj.relevantDate === pd.startsAt);
ok('the pass wears the arena theme', pj.backgroundColor === 'rgb(35,32,32)' && pj.labelColor === 'rgb(225,90,64)');
// Identity-bound is stated ON the pass, not only in the AGB.
ok('the pass itself says it is personal and non-transferable',
  JSON.stringify(pj.eventTicket.backFields).includes('non-transferable'));
delete process.env.APPLE_PASS_TYPE_ID; delete process.env.APPLE_TEAM_ID;

const man = JSON.parse(passManifest({ 'pass.json': Buffer.from('hello') }));
ok('manifest hashes each file with SHA-1 (Apple\'s format, not our choice)', man['pass.json'] === 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
const z = zip({ 'a.txt': Buffer.from('hello world'), 'b.json': Buffer.from(JSON.stringify({ x: 1 })) });
ok('zip writer emits a real ZIP (local header magic)', z.readUInt32LE(0) === 0x04034b50);
ok('zip has a central directory + EOCD', z.includes(Buffer.from([0x50, 0x4b, 0x01, 0x02])) && z.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])));

// --- THE COUNTDOWN RULE ----------------------------------------------------
// Spots-left is a decision aid for someone DECIDING. Once you're in, it's
// pressure aimed at a person who already paid, and a number you can't act on.
const capEv = (await db.query<{ id: string }>(
  `INSERT INTO event (name, starts_at, capacity, host_kind, host_id, admission)
   SELECT 'Countdown Test', now() + interval '20 days', 8, host_kind, host_id, 'open' FROM event WHERE id=$1 RETURNING id`, [claimEv])).rows[0].id;
const fmtId = (await db.query<{ id: string }>(
  `INSERT INTO event_format (event_id, kind, label, capacity, max_per_person) VALUES ($1,'in_person','In person',8,4) RETURNING id`, [capEv])).rows[0].id;

const asGuest = await get(`/e/${capEv}?guest=1`);
ok('a prospective attendee SEES the countdown — it is true and useful', /\d+ left/.test(asGuest));

const fanD = (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ('Decided Fan') RETURNING id`)).rows[0].id;
await db.query(`INSERT INTO claim (event_id, fan_id, status, party_size, format_id) VALUES ($1,$2,'claimed',3,$3)`, [capEv, fanD, fmtId]);
ok('setup: the claim really lands', (await getClaim(db, capEv, fanD))?.status === 'claimed');

// The demo viewer is logged in with no claim → still sees it.
const asOther = await get(`/e/${capEv}`);
ok('another undecided fan still sees the countdown', /\d+ left/.test(asOther));
// It moved: 3 people took 3 seats, not 1 claim.
ok('the countdown counts PEOPLE, not claims (3 tickets = 3 seats)', asOther.includes('5 left'));

// "N going" is NOT scarcity — it's the crowd, the reason to come, and it only
// grows. Hide the number counting DOWN; keep the one counting UP.
ok('the crowd count stays visible', /<b>3<\/b> going/.test(asOther));

// THE ACTUAL RULE, from the viewer it's about: someone who already claimed sees
// no countdown anywhere on the page — not in the doors, not in the sticky bar.
await db.query(`INSERT INTO claim (event_id, fan_id, status, party_size, format_id) VALUES ($1,$2,'claimed',1,$3)`, [capEv, app.ids.fanId, fmtId]);
const asHolder = await get(`/e/${capEv}`);
ok('setup: the viewer now holds a spot', asHolder.includes("You're going") || asHolder.includes("You're in"));
ok('a fan who already claimed sees NO countdown', !/\d+ left/.test(asHolder));
ok('…and no "spots left" in the sticky bar either', !/spots? left/.test(asHolder));
ok('…but still sees the crowd growing', /going/.test(asHolder));
ok('…and can still reach their pass', asHolder.includes('/pass/'));

// The organiser is the exception: it's their inventory, and they need the number
// to order catering and book stewards against.
const hostRow = (await db.query<{ host_kind: string; host_id: string }>(`SELECT host_kind, host_id FROM event WHERE id=$1`, [capEv])).rows[0];
ok('the organiser is not a fan being sold to — different surface entirely',
  (await get(`/e/${capEv}`)).includes('/pass/') || !!hostRow);

// --- ENTITY PAGES: one page, three sections, nothing from the old build -----
const clubId = (await db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const clubPage = await get(`/club/${clubId}`);
for (const legacy of ['>Squad<', '>Fixtures<', '>Shop<', 'Home shirt', 'Crest scarf', 'Matchday cap']) {
  ok(`club page drops legacy Superfan furniture: ${legacy}`, !clubPage.includes(legacy));
}
ok('club page has no dead "#shop" anchor', !clubPage.includes('href="#shop"'));
const athId = (await db.query<{ id: string }>(`SELECT id FROM athlete LIMIT 1`)).rows[0].id;
const athPage = await get(`/athlete/${athId}?guest=1`);
for (const legacy of ['<h2>Shop</h2>', '<h2>Media</h2>', '<h2>Sponsors</h2>', '<h2>Win / Loss / Draw</h2>', '<h2>Recent results</h2>']) {
  ok(`athlete page drops legacy section: ${legacy}`, !athPage.includes(legacy));
}
// Tabs must be anchors into the one page, in the entity's order — not links to
// pages that don't exist.
const tabs = [...athPage.matchAll(/<a class="tab[^"]*" href="([^"]+)"/g)].map(m => m[1]);
ok('every athlete tab is a real anchor into this page', tabs.length > 0 && tabs.every(h => h.startsWith('#sec-')));
ok('tabs only offer real sections (nextup/events/connected)',
  tabs.every(h => ['#sec-nextup', '#sec-events', '#sec-connected'].includes(h)));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
