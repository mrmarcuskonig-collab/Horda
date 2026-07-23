// home.test.ts — the logged-in home: "Your events" = ones you organise;
// "Events · live & upcoming" includes the ones you've claimed, marked in orange.
// Run: node tests/home.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { createClaim } from '../src/db/claim_rail_repo.ts';
import { createAthlete } from '../src/db/engagement_repo.ts';
import { grantOwnership } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string) => fetch(base + p).then(r => r.text());   // no cookie = demo viewer (owns seed clubs)

console.log('\n[home] your events = organised; claimed shown in Events · live & upcoming');

const home = await get('/');
ok('the band is "Your events that you organize" (not "from who you follow")',
  home.includes('that you organize') && !home.includes('from who you follow'));
ok('the organized band is a horizontal rail (peek for more)', home.includes('class="orow"'));
ok('the demo owner sees an event they organise in the band', /class="orow">[\s\S]*You organise/.test(home));
ok('the old "Public events" wording is gone', !home.includes('Public events'));

// A future event hosted by someone the demo does NOT own → public to the demo.
// The demo fan claims it → it must appear under Events · live & upcoming, marked.
const otherId = await createAthlete(app.db, 'Other Host');
const otherAccount = (await app.db.query<{ id: string }>(`INSERT INTO account (email) VALUES ('other@x.io') RETURNING id`)).rows[0].id;
await app.db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [otherAccount, otherId]);
await grantOwnership(app.db, otherAccount, 'athlete', otherId);
const soon = new Date(Date.now() + 36e5).toISOString();
const evId = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: otherId, title: 'CLAIMED_HOME_EVENT', startsAt: soon, admission: 'open' });
await createClaim(app.db, { eventId: evId, fanId: app.ids.fanId, capacity: 100, mode: 'open', priceCents: 0 });

const home2 = await get('/');
ok('the public band is titled "Events · live & upcoming" (not "Public events")',
  home2.includes('Events · live &amp; upcoming') && !home2.includes('Public events'));
ok('a claimed public event appears on the home page', home2.includes('CLAIMED_HOME_EVENT'));
ok('the claimed event is marked (orange "You\'re in" + accent card)',
  /class="fcard[^"]*claimed[^"]*"[\s\S]*CLAIMED_HOME_EVENT/.test(home2) || (home2.includes('claimedpill') && home2.includes('CLAIMED_HOME_EVENT')));
ok('the claimed event is NOT in the organise band (it is not organised by the viewer)',
  !/class="orow">[\s\S]*CLAIMED_HOME_EVENT[\s\S]*<\/div>\s*<h2/.test(home2));

console.log(`\n──────── home: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
