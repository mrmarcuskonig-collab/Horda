// web.test.ts — boots the real SSR app, drives the routes + the predict/follow
// actions over HTTP, and snapshots the three screens to HTML for viewing.
// Run: node tests/web.test.ts
import { writeFileSync } from 'node:fs';
import { startServer } from '../src/web/server.ts';
import { getUpcomingBout, getAttendance } from '../src/db/engagement_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, cond: boolean) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${n}`); cond ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = async (p: string) => (await fetch(base + p)).text();
const rico = app.ids.athletes[0].id;
const max = app.ids.athletes[1].id;
const club = app.ids.clubs[0].id;
const team = app.ids.teams[0].id;
const assoc = app.ids.association.id;

console.log(`\n[web] server up on ${base}`);

const home = await get('/');
ok('home leads with the face rail (no marketing hero)', home.includes('class="rail"') && !home.includes('Get closer to the athletes'));
ok('home links the idol', home.includes(`/athlete/${rico}`));

const athlete = await get(`/athlete/${rico}`);
ok('record is labeled (Wins–Losses–Draws), not bare 2–0–0', athlete.includes('2–0–0') && athlete.includes('Wins–Losses–Draws'));
ok('athlete-controlled tagline shows', athlete.includes('Southpaw out of Kreuzberg'));
ok('socials render as icons (svg) linking OUT', athlete.includes('class="ic"') && athlete.includes('<svg') && athlete.includes('instagram.com/ricotheraven'));
ok('Weverse-style tabs incl. Shop', athlete.includes('Highlight') && athlete.includes('Shop'));
ok('no follow/followers control', !athlete.includes('>Follow</button>') && !athlete.includes('follower'));
ok('attendance options: not attending yet + Join free / tickets / stream', athlete.includes("You're not attending yet") && athlete.includes('Join for free') && athlete.includes('Buy tickets') && athlete.includes('Stream live'));
ok('athlete-chosen affiliations (gym/league) shown', athlete.includes('Kreuzberg Boxing Club') && athlete.includes('WBO Welterweight'));

// --- guest view: public, but actions gate to sign-up (Shop exempt) ---
const guest = await get(`/athlete/${rico}?guest=1`);
ok('guest sees the sign-up gate bar', guest.includes('Log in to continue'));
ok('guest action links route to /signup, not out', guest.includes('href="/signup"') && !guest.includes('instagram.com/ricotheraven'));
ok('guest still sees Shop (exempt)', guest.includes('#shop'));

const fan = await get(`/fan/${app.ids.fanId}`);
ok('fan home renders', fan.includes('Your Horda'));
ok('feed carries the idol’s callout', fan.includes('take the belt'));
ok('feed carries followed club coverage', fan.includes('FC Beispiel'));
ok('guardrail line present', fan.includes('not a stream of other fans'));

const clubPage = await get(`/club/${club}`);
ok('club page: branded (Club kindtag + crest) with league table', clubPage.includes('>Club<') && clubPage.includes('League table'));
ok('club page lists its teams as members', clubPage.includes('Teams') && clubPage.includes('/team/'));
ok('club page: matchday attendance options', clubPage.includes("You're not attending yet") && clubPage.includes('Join for free'));
ok('club socials as icons linking out', clubPage.includes('class="ic"') && clubPage.includes('fcbeispiel.de'));

const teamPage = await get(`/team/${team}`);
ok('team page: roster as members (athlete links)', teamPage.includes('Squad') && teamPage.includes('/athlete/'));
ok('team page: parent club link', teamPage.includes(`/club/${app.ids.clubs[0].id}`));
ok('team page: league table present', teamPage.includes('League table'));

const assocPage = await get(`/association/${assoc}`);
ok('association page: member clubs + competitions', assocPage.includes('Member clubs') && assocPage.includes('Competitions'));
ok('association lists FC Beispiel as a member', assocPage.includes('FC Beispiel'));
ok('association: Association kindtag', assocPage.includes('>Association<'));

const clubGuest = await get(`/club/${club}?guest=1`);
ok('club guest view gated', clubGuest.includes('Log in to continue') && clubGuest.includes('href="/signup"'));

// --- exercise the attend action over HTTP ---
const upcoming = (await getUpcomingBout(app.db, rico))!;
await fetch(base + '/attend', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ fan_id: app.ids.fanId, event_id: upcoming.eventId, mode: 'going' }) });
const att = await getAttendance(app.db, app.ids.fanId, upcoming.eventId);
ok('POST /attend recorded the fan as going', att?.mode === 'going');
const athleteAfter = await get(`/athlete/${rico}`);
ok('athlete page now shows attendance confirmed', athleteAfter.includes("You're going"));

// --- real image upload (owner edits crest/avatar + banner) ---
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
await fetch(base + `/athlete/${rico}/branding`, form({ avatar: png, banner: png }));
const athleteImg = await get(`/athlete/${rico}`);
ok('uploaded athlete avatar + banner render as <img>', (athleteImg.match(/data:image\/png/g) || []).length >= 2);
await fetch(base + `/entity/club/${club}/branding`, form({ avatar: png }));
const clubImg = await get(`/club/${club}`);
ok('uploaded club crest renders and tagline is preserved', clubImg.includes('data:image/png') && clubImg.includes('Kreuzberg'));
ok('owner sees an upload panel; guest does not', athleteImg.includes('Edit profile (owner)') && !guest.includes('Edit profile (owner)'));

// --- public share pages (the acquisition loop) ---
const shareFight = await get(`/share/fight/${upcoming.eventId}`);
ok('fight share: public, has card svg + join CTA', shareFight.includes('<svg') && shareFight.includes('This is the Horda') && shareFight.includes('Join free'));
const evWin = (await app.db.query<{ event_id: string }>(`SELECT event_id FROM result WHERE participant_id=$1 AND outcome='win' LIMIT 1`, [rico])).rows[0];
const shareResult = await get(`/share/result/${evWin.event_id}`);
ok('result share: recap + outbound share links', shareResult.includes('def.') && shareResult.includes('twitter.com/intent'));
const shareWeek = await get(`/share/week/${app.ids.fanId}`);
ok('week-drop share: public + join CTA', shareWeek.includes('week in the Horda') && shareWeek.includes('Join free'));

// --- Luma-style scheduled events ---
const evId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE host_kind='athlete' AND admission='open' LIMIT 1`)).rows[0].id;
const evPage = await get(`/e/${evId}`);
ok('event page (Luma-style): title + registration card + going count + host', evPage.includes('Open sparring') && evPage.includes('Registration') && evPage.includes('going') && evPage.includes('Hosted by'));
ok('watch-live channels (YouTube/Twitch)', evPage.includes('Watch on YouTube') && evPage.includes('Watch on Twitch'));
ok('event page: add-to-calendar link', evPage.includes(`/e/${evId}/ics`));
const ics = await (await fetch(base + `/e/${evId}/ics`)).text();
ok('ICS route returns a calendar file', ics.includes('BEGIN:VCALENDAR') && ics.includes('SUMMARY:'));
await fetch(base + '/rsvp', form({ fan_id: app.ids.fanId, event_id: evId, response: 'interested' }));
ok('RSVP over HTTP is recorded', (await get(`/e/${evId}`)).includes('✓ Interested'));
ok('guest RSVP is gated to sign-up', (await get(`/e/${evId}?guest=1`)).includes('href="/signup"'));

// admission types: paid (checkout + payment) and apply
const paidId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='paid' LIMIT 1`)).rows[0].id;
const paidPage = await get(`/e/${paidId}`);
ok('paid event shows a price + Get ticket', paidPage.includes('Get ticket') && /€\s?15/.test(paidPage));
const checkout = await get(`/e/${paidId}/checkout`);
ok('checkout page shows the charge', checkout.includes('Checkout') && checkout.includes('Pay'));
await fetch(base + `/e/${paidId}/pay`, form({ fan_id: app.ids.fanId }));
const paidAfter = await get(`/e/${paidId}`);
ok('after pay, fan holds a ticket', paidAfter.includes("You're in"));
const applyId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='apply' LIMIT 1`)).rows[0].id;
ok('apply event shows Apply to attend', (await get(`/e/${applyId}`)).includes('Apply to attend'));

// tickets: gift / sell + resale on the paid event (seed gave "You" a ticket + a Rieke listing)
ok('ticket holder can gift + sell', paidAfter.includes('You hold a ticket') && paidAfter.includes('>Gift</button>') && paidAfter.includes('>Sell</button>'));
ok('resale listing visible (from Rieke)', paidAfter.includes('Resale') && paidAfter.includes('Rieke'));

// membership (closeness monetization) + members-only FOMO
ok('athlete tier card: price + perks + join', athlete.includes("Raven's Corner") && athlete.includes('Become a member'));
ok('members-only drop locked for non-members', athlete.includes('Members-only drop'));
await fetch(base + '/join', form({ fan_id: app.ids.fanId, owner_kind: 'athlete', owner_id: rico }));
const welcome = await get(`/member/athlete/${rico}`);
ok('join → shareable founding-member welcome', welcome.includes("You're in") && welcome.includes('Founding member') && welcome.includes('twitter.com/intent'));
const athleteMem = await get(`/athlete/${rico}`);
ok('member sees badge + unlocked drop', athleteMem.includes('Founding member #') && athleteMem.includes('Camp diary'));

const createForm = await get(`/host/athlete/${rico}/new`);
ok('owner create-event form has admission + price + stream fields', createForm.includes('Admission') && createForm.includes('Price') && createForm.includes('YouTube'));
ok('athlete profile shows its events + a FEATURED cross-post', athleteImg.includes('Schedule an event') && athleteImg.includes('Season launch'));

// --- live start screen (public, filterable, gated personalization) ---
const land = await get('/?guest=1');
ok('start screen: broad sport menu + free location field (no hard-coded cities)', land.includes('All sports') && land.includes('Boxing') && land.includes('Basketball') && land.includes('Everywhere') && land.includes('Enter your location') && !land.includes('>Hamburg</a>'));
ok('start screen shows live coverage (athlete + results)', land.includes(`/athlete/${rico}`) && land.includes('Latest results'));
ok('guest gets a gated "your feed" CTA', land.includes('Your Horda') && land.includes('Get your feed'));
const filtered = await get(`/?sport=boxing&region=Hamburg`);
ok('filter narrows to taste (Hamburg boxing → Max, not Rico)', filtered.includes(`/athlete/${max}`) && !filtered.includes(`/athlete/${rico}`));
// fyndafit-inspired surface: story rail (Join + Creator map first), big featured photos, regional map, theme toggle
ok('story rail leads with Join + Creator map tiles', land.includes('class="rail"') && land.includes('>Join<') && land.includes('Creator map'));
ok('story rail shows athlete faces with names', land.includes('class="story"') && land.includes('class="ring"'));
ok('featured photo cards with identity chip', land.includes('class="fcard"') && land.includes('class="fid"') && land.includes('class="fnm"'));
const mapPage = await get('/map');
ok('creator map is its own page (Leaflet + CARTO), removed from landing', mapPage.includes('id="map"') && mapPage.includes('cartocdn.com') && !land.includes('id="map"'));
ok('landing footer carries the superfan tagline', land.includes('The home for sports superfans'));
ok('theme toggle present + no-flash boot script', land.includes('class="thm"') && land.includes("localStorage.getItem('hz_theme')"));
ok('light theme variables defined app-wide', land.includes('data-theme="light"') && (await get(`/athlete/${rico}`)).includes('data-theme="light"'));
ok('map filters with taste too (Hamburg boxing excludes Rico everywhere)', !filtered.includes(`/athlete/${rico}`));
// instagram-like usability: persistent bottom tab bar + verified trust badges
ok('persistent bottom tab bar with familiar tabs', land.includes('class="bnav"') && land.includes('>Home<') && land.includes('>Explore<') && land.includes('>You<'));
ok('bottom nav appears on inner pages too (athlete)', (await get(`/athlete/${rico}`)).includes('class="bnav"'));
ok('verified badge on a claim-verified athlete (Rico is owned)', land.includes('class="vbadge"'));
const cg = await get(`/club/${club}?guest=1`);
ok('guest gate now coexists with the bottom nav (in-flow banner)', cg.includes('Log in to continue') && cg.includes('class="bnav"') && cg.includes('border-radius:14px'));

// --- snapshot the screens for viewing ---
writeFileSync('horda-app-start.html', land);
writeFileSync('horda-app-event.html', evPage);
writeFileSync('horda-app-event-paid.html', await get(`/e/${paidId}`));
writeFileSync('horda-app-checkout.html', checkout);
writeFileSync('horda-app-athlete-member.html', athleteMem);
writeFileSync('horda-app-member-welcome.html', welcome);
writeFileSync('horda-app-share.html', shareResult);
writeFileSync('horda-app-athlete.html', athleteImg);        // registered, attending, with uploaded art
writeFileSync('horda-app-athlete-guest.html', guest);       // public/guest view
writeFileSync('horda-app-fan.html', fan);
writeFileSync('horda-app-club.html', clubImg);
writeFileSync('horda-app-team.html', teamPage);
writeFileSync('horda-app-association.html', assocPage);
console.log('  wrote horda-app-{athlete,athlete-guest,fan,club,team,association}.html');

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
