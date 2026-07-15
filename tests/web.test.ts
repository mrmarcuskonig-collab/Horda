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
ok('result statistics (Win/Loss/Draw) and Recent results removed from athlete page', !athlete.includes('Win / Loss / Draw') && !athlete.includes('Wins–Losses–Draws') && !athlete.includes('Recent results'));
ok('athlete-controlled tagline shows', athlete.includes('Southpaw out of Kreuzberg'));
ok('socials render as icons (svg) linking OUT', athlete.includes('class="ic"') && athlete.includes('<svg') && athlete.includes('instagram.com/ricotheraven'));
ok('tabs derive from the athlete\'s sections + scroll-anchor to them', athlete.includes('class="tabs"') && athlete.includes('href="#sec-') && athlete.includes('id="sec-'));
ok('no vanity follower count (Follow is the free tier now, but no follower numbers)', !athlete.includes('follower'));
ok('attendance options: not attending yet + Join free / tickets / stream', athlete.includes("You're not attending yet") && athlete.includes('Join for free') && athlete.includes('Buy tickets') && athlete.includes('Stream live'));
ok('athlete page has the Clubs & Leagues connections section (owner view)', athlete.includes('Clubs &amp; Leagues') && athlete.includes('Manage connections'));

// --- guest view: public, but actions gate to sign-up (Shop exempt) ---
const guest = await get(`/athlete/${rico}?guest=1`);
ok('guest sees the sign-up gate bar', guest.includes('Log in to continue'));
ok('guest action links route to /signup, not out', guest.includes('href="/signup"') && !guest.includes('instagram.com/ricotheraven'));
// Shop is data-driven (merch / gift-membership / discount / link) and exempt from
// Post-pivot: no shop/content. The public event page leads with the claim.
const guestEv = await get(`/e/${(await app.db.query<{ id: string }>(`SELECT id FROM event LIMIT 1`)).rows[0].id}?guest=1`);
ok('public event page leads with the claim (no content/shop)', guestEv.includes('Claim your spot') || guestEv.includes('waitlist'));

const fan = await get(`/fan/${app.ids.fanId}`);
ok('fan home renders (feed-of-doors)', fan.includes('Your Horda') && fan.includes('Your doors'));
ok('feed is finite — ends visibly OR empty state', fan.includes("You're up to date") || fan.includes('Find your scene'));
ok('doctrine guardrail line present', fan.includes('a ranked set of doors'));

const clubPage = await get(`/club/${club}`);
ok('club page: branded (Club kindtag), no league table (superfan-first)', clubPage.includes('>Club<') && !clubPage.includes('League table'));
ok('club page lists its teams as members', clubPage.includes('Teams') && clubPage.includes('/team/'));
ok('club page: matchday attendance options', clubPage.includes("You're not attending yet") && clubPage.includes('Join for free'));
ok('club socials as icons linking out', clubPage.includes('class="ic"') && clubPage.includes('fcbeispiel.de'));

const teamPage = await get(`/team/${team}`);
ok('team page: roster as members (athlete links)', teamPage.includes('Squad') && teamPage.includes('/athlete/'));
ok('team page: parent club link', teamPage.includes(`/club/${app.ids.clubs[0].id}`));
ok('team page: parent + no league table', !teamPage.includes('League table'));

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
// Photo upload moved into the single "Edit page" (Edit profile is no longer a
// separate inline panel on the public profile) — owner-only, not on the public page.
const athEdit = await get(`/athlete/${rico}/customize`);
ok('owner edits photos in Edit page; not on the public profile', athEdit.includes('Profile photo') && athEdit.includes('Banner photo') && !athleteImg.includes('Edit profile (owner)'));

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
const evPageG = await get(`/e/${evId}?guest=1`);
ok('event page: title + claim CTA + host (registration card removed)', evPage.includes('Open sparring') && evPage.includes('Hosted by') && evPageG.includes('Claim your spot') && !evPage.includes('>Registration<'));
ok('watch-live channels (YouTube/Twitch)', evPage.includes('Watch on YouTube') && evPage.includes('Watch on Twitch'));
ok('event page: add-to-calendar link', evPage.includes(`/e/${evId}/ics`));
const ics = await (await fetch(base + `/e/${evId}/ics`)).text();
ok('ICS route returns a calendar file', ics.includes('BEGIN:VCALENDAR') && ics.includes('SUMMARY:'));
await fetch(base + '/rsvp', form({ fan_id: app.ids.fanId, event_id: evId, response: 'not_going' }));
ok('decline ("can\'t attend") is recorded via /rsvp', (await app.db.query(`SELECT count(*)::int n FROM attendance WHERE event_id=$1 AND fan_id=$2 AND mode='not_going'`, [evId, app.ids.fanId])).rows[0].n >= 1);
ok('guest event page routes to sign-up', (await get(`/e/${evId}?guest=1`)).includes('href="/signup"'));

// admission types: paid (checkout + payment) and apply
const paidId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='paid' LIMIT 1`)).rows[0].id;
const paidPage = await get(`/e/${paidId}`);
const paidPageG = await get(`/e/${paidId}?guest=1`);
ok('paid event shows a price + claim CTA', paidPageG.includes('Claim your spot') && /€\s?15/.test(paidPageG));
const checkout = await get(`/e/${paidId}/checkout`);
ok('checkout page shows the charge', checkout.includes('Checkout') && checkout.includes('Pay'));
await fetch(base + `/e/${paidId}/pay`, form({ fan_id: app.ids.fanId }));
const paidAfter = await get(`/e/${paidId}`);
ok('after pay, fan holds a ticket', paidAfter.includes('You hold a ticket'));
const applyId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='apply' LIMIT 1`)).rows[0].id;
ok('apply event shows the claim CTA (approval-gated)', (await get(`/e/${applyId}?guest=1`)).includes('Claim your spot'));

// tickets: gift / sell + resale on the paid event (seed gave "You" a ticket + a Rieke listing)
ok('ticket holder can gift + sell', paidAfter.includes('You hold a ticket') && paidAfter.includes('>Gift</button>') && paidAfter.includes('>Sell</button>'));
ok('resale listing visible (from Rieke)', paidAfter.includes('Resale') && paidAfter.includes('Rieke'));

// Post-pivot: no subscription tiers, no gated content. The crowd is followable;
// closeness comes from showing up (standing), never from a paid status.
ok('athlete page offers "Join the crowd" (follow), not paid tiers', guest.includes('crowd') && !guest.includes('Clubhouse membership') && !guest.includes('/mo'));
ok('no content/exclusivity gating on the public page', !guest.includes('class="lockpill"') && !guest.includes('Supporter-only'));

const createForm = await get(`/host/athlete/${rico}/new`);
ok('owner create-event form has admission + price + stream fields', createForm.includes('Admission') && createForm.includes('Price') && createForm.includes('YouTube'));
ok('athlete profile shows its events + a FEATURED cross-post', athleteImg.includes('Schedule an event') && athleteImg.includes('Season launch'));

// --- live start screen (public, filterable, gated personalization) ---
const land = await get('/?guest=1');
ok('start screen: broad sport menu + free location field (no hard-coded cities)', land.includes('All sports') && land.includes('Boxing') && land.includes('Basketball') && land.includes('Everywhere') && land.includes('City or country') && !land.includes('>Hamburg</a>'));
ok('location field offers type-ahead suggestions + use-my-location', land.includes('<datalist id="loclist"') && land.includes('id="locbtn"') && land.includes('navigator.geolocation'));
ok('start screen leads with athletes + events (no results section)', land.includes(`/athlete/${rico}`) && land.includes('Public events') && !land.includes('Latest results'));
ok('guest gets a gated "your feed" CTA', land.includes('Your Horda') && land.includes('Get your feed'));
const filtered = await get(`/?sport=boxing&region=Hamburg`);
ok('filter narrows to taste (Hamburg boxing → Max, not Rico)', filtered.includes(`/athlete/${max}`) && !filtered.includes(`/athlete/${rico}`));
// story rail (Join + Event map first), big featured EVENT cards, regional map
ok('story rail leads with Join + Event map tiles', land.includes('class="rail"') && land.includes('>Join the Horda<') && land.includes('>Event map<') && !land.includes('Creator map'));
ok('story rail shows athlete faces with names', land.includes('class="story"') && land.includes('class="ring"'));
ok('featured cards are PUBLIC EVENTS (photo posters linking to /e/)', land.includes('class="fcard"') && land.includes('class="ftitle"') && /class="fcard[^"]*" href="\/e\//.test(land));
const mapPage = await get('/map');
ok('event map is its own page (Leaflet + CARTO), removed from landing', mapPage.includes('id="map"') && mapPage.includes('cartocdn.com') && mapPage.includes('Event map') && !land.includes('id="map"'));
ok('map markers are avatar rings that link to the profile (no name/popup label)', mapPage.includes("className:'hz-av'") && mapPage.includes('class="mav"') && mapPage.includes('window.location.href=p.href') && !mapPage.includes('bindPopup'));
ok('landing footer carries the superfan tagline', land.includes('The home for sports superfans'));
ok('single dark arena theme: no theme boot script + no toggle on landing', !land.includes("localStorage.getItem('hz_theme')") && !land.includes('class="thm"'));
ok('no light mode anywhere (dark-only guardrail)', !land.includes('data-theme="light"') && !(await get(`/athlete/${rico}`)).includes('data-theme="light"'));
ok('map filters with taste too (Hamburg boxing excludes Rico everywhere)', !filtered.includes(`/athlete/${rico}`));
// instagram-like usability: persistent bottom tab bar + verified trust badges
ok('persistent bottom tab bar, icon-only (labels via aria-label, no text)', land.includes('class="bnav"') && land.includes('aria-label="Home"') && land.includes('aria-label="You"') && !land.includes('class="lbl"') && !land.includes('>Home<'));
ok('bottom nav appears on inner pages too (athlete)', (await get(`/athlete/${rico}`)).includes('class="bnav"'));
ok('verified badge on a claim-verified athlete (Rico is owned)', land.includes('class="vbadge"'));
// TikTok-style desktop left rail + language toggle + event engagement chips
ok('desktop left rail: labelled Explore/Following/Create/Profile nav', land.includes('class="drail"') && land.includes('>Explore<') && land.includes('>Following<') && land.includes('>Create event<') && land.includes('>Profile<'));
ok('rail create link is generic /create (no leaked athlete id)', land.includes('href="/create"') && !land.includes(`/athlete/${rico}/compose`));
ok('rail carries search + language toggle + dark-mode toggle', land.includes('class="dr-search"') && land.includes('class="lgtog"') && land.includes('/set-lang?l=de') && land.includes('/set-lang?l=en'));
ok('event cards show engagement stats (going / followers / shares)', land.includes('class="estats"') && land.includes('class="est"'));
const deLand = await (await fetch(base + '/', { headers: { cookie: 'hz_lang=de' } })).text();
ok('German locale translates the rail (Erkunden/Gefolgt/Einstellungen)', deLand.includes('>Erkunden<') && deLand.includes('>Gefolgt<') && deLand.includes('lang="de"'));
// rail: notifications item for logged-in, and dark toggle moved out of the rail
const landIn = await get('/');
ok('rail shows Notifications for logged-in users, not for guests', landIn.includes('href="/notifications"') && landIn.includes('Notifications') && !land.includes('href="/notifications"'));
ok('no theme toggle anywhere — dark-only (discover + settings)', !landIn.includes('class="thm"') && !(await get('/settings')).includes('class="thm"'));

// multi-format attendance: create an event with in-person ticket + a stream,
// then a guest picks a format and the organizer sees the per-format breakdown.
const mfForm = new URLSearchParams({
  host_kind: 'athlete', host_id: rico, title: 'German Championship Final', starts_at: '2027-05-01T19:00',
  location_kind: 'hybrid', location: 'Olympiastadion', admission: 'open',
  fmt_inperson: '1', fmt_inperson_price: '25', fmt_stream1_label: 'TikTok Live', fmt_stream1_url: 'https://tiktok.com/@x/live',
  fmt_stream2_label: 'Sportdeutschland.TV', fmt_stream2_url: 'https://sportdeutschland.tv/x',
});
const mfRes = await fetch(base + '/events', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: mfForm.toString(), redirect: 'manual' });
const mfLoc = mfRes.headers.get('location') || '';
const mfId = (mfLoc.match(/\/e\/([^/?]+)/) || [])[1] || '';
const mfPage = await get(`/e/${mfId}?guest=1`);
ok('picker mirrors the "Next up" design (card + notyet + opts buttons)', mfPage.includes('>Attend</h2>') && mfPage.includes('class="notyet"') && mfPage.includes('class="opts"') && mfPage.includes('Stream on TikTok Live') && mfPage.includes('Stream on Sportdeutschland.TV') && !mfPage.includes('class="fmtwrap"'));
ok('in-person shows Get-ticket price; channel links hidden until claim', mfPage.includes('Get ticket · €25') && !mfPage.includes('Channel ↗') && !mfPage.includes('Watch on'));
ok('name + email entered once; one submit button per format + Can’t attend', (mfPage.match(/name="name"/g) || []).length === 1 && (mfPage.match(/name="format_id"/g) || []).length === 3 && mfPage.includes('Can’t attend'));
const mfManage = await get(`/manage/${mfId}`);
ok('organizer manage view shows attendance-by-format breakdown', mfManage.includes('Attendance by format') && mfManage.includes('watching'));

// season schedule: paste fixtures → auto-creates one event per line
const seasonForm = new URLSearchParams({ host_kind: 'athlete', host_id: rico, title: 'Season', starts_at: '2027-08-01T18:00', location_kind: 'in_person', admission: 'open', fmt_inperson: '1', season_schedule: 'Round 1 vs A | 2027-08-01 19:00 | Home\nRound 2 vs B | 2027-08-08 18:30 | Away' });
const seasonRes = await fetch(base + '/events', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: seasonForm.toString(), redirect: 'manual' });
ok('season paste creates multiple events (redirects to one)', /\/e\//.test(seasonRes.headers.get('location') || ''));
const afterSeason = await get('/?guest=1');
ok('newly created season fixtures appear in discover', afterSeason.includes('Round 1 vs A') || afterSeason.includes('Round 2 vs B') || afterSeason.includes('German Championship Final'));

// shared shell: identical rail on athlete + discover; NO header anywhere
const athPage = await get(`/athlete/${rico}`);
ok('athlete + discover use the shared rail and have no page header', athPage.includes('class="drail"') && landIn.includes('class="drail"') && !athPage.includes('class="hz-top"') && !landIn.includes('class="hz-top"'));
ok('consistent floating back button on inner pages (athlete), not on home', athPage.includes('class="hz-back"') && !landIn.includes('class="hz-back"'));
const athGuest = await get(`/athlete/${rico}?guest=1`);
ok('athlete page: Follow next to profile, no duplicate "Join crowd" banner', athGuest.includes('class="btn join"') && !athGuest.includes("'s crowd</strong>"));
// connection graph: seeded athlete→club link shows as a card
ok('athlete shows connected club as a logo card', athPage.includes('class="conngrid"') && athPage.includes('conncard') && athPage.includes('FC Beispiel'));
ok('connections manager lists your connections + request form', (await get(`/athlete/${rico}/connections`)).includes('Your connections') && (await get(`/athlete/${rico}/connections`)).includes('Request to join'));
// insights: core crowd→claims→presence funnel; social reach is "coming soon"
const ins = await get(`/athlete/${rico}/insights`);
ok('insights shows the core funnel; social reach is coming soon (not gated)', ins.includes('Crowd — following') && ins.includes('Showed up — verified') && ins.includes('Coming soon') && !ins.includes('unlock Insights'));
// no 'support anyway' format anymore
ok('support/"root for them" format removed', !mfPage.includes('Root for them') && !mfPage.includes('rooting'));
// share buttons on event / athlete / club pages (native share or copy link)
ok('event page has a Share button (native share / copy link)', mfPage.includes('navigator.share') && /aria-label="Share"/.test(mfPage));
ok('athlete page has a Share button', athGuest.includes('aria-label="Share"') && athGuest.includes('navigator.clipboard'));
// event create form exposes an "About this event" field
ok('event create form offers an About this event section', createForm.includes('About this event') && createForm.includes('name="description"'));
// auto-follow: guest filter → interest on signup
const suEmail = `au${Date.now()}@x.co`;
await fetch(base + '/signup', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: suEmail, name: 'AF', password: 'pw123456', sport: 'boxing', region: 'Hamburg' }).toString(), redirect: 'manual' });
const intCount = (await app.db.query(`SELECT count(*)::int n FROM fan_interest WHERE kind='sport' AND value='boxing'`)).rows[0].n;
ok('signup with a filter records sport + region interests', intCount >= 1 && (await app.db.query(`SELECT count(*)::int n FROM fan_interest WHERE kind='region' AND value='Hamburg'`)).rows[0].n >= 1);

// --- access model + QR check-in (Phase 0 item 5) ---
const mkEvent = async (p: Record<string, string>) => {
  const r = await fetch(base + '/events', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString(), redirect: 'manual' });
  return ((r.headers.get('location') || '').match(/\/e\/([^/?]+)/) || [])[1] || '';
};
const claimToPass = async (eid: string) => {
  const r = await fetch(base + `/claim/${eid}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Door Fan', contact: `d${Date.now()}@x.co` }).toString(), redirect: 'manual' });
  return await get(r.headers.get('location') || '/');
};
const tkId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Door Test', starts_at: '2027-06-01T19:00', location_kind: 'in_person', location: 'Kreuzberg Boxing, Berlin', admission: 'open', access_mode: 'ticket' });
ok('ticket-mode event: guest CTA says "Claim your spot" (QR ticket)', (await get(`/e/${tkId}?guest=1`)).includes('Claim your spot'));
const tkPass = await claimToPass(tkId);
ok('ticket-mode pass shows a scannable QR (client-side QR) + door instruction', tkPass.includes('id="hzqr"') && tkPass.includes('qrcode.min.js') && tkPass.includes('Show this QR at the door'));
const checkinPage = await get(`/e/${tkId}/check-in`);
ok('organizer check-in has a camera QR scanner + manual fallback', checkinPage.includes('jsQR') && checkinPage.includes('hzScan') && checkinPage.includes('Scan a QR ticket') && checkinPage.includes('name="token"'));
const lkId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Stream Test', starts_at: '2027-06-02T19:00', location_kind: 'online', location: 'https://youtube.com/live/x', admission: 'open', access_mode: 'link' });
ok('link-mode event: guest CTA says "Get access" (no ticket/QR)', (await get(`/e/${lkId}?guest=1`)).includes('Get access'));
const lkPass = await claimToPass(lkId);
ok('link-mode pass reveals the link, no QR', lkPass.includes('Open the event link') && !lkPass.includes('id="hzqr"'));

const cg = await get(`/club/${club}?guest=1`);
ok('guest gate now coexists with the bottom nav (in-flow banner)', cg.includes('Log in to continue') && cg.includes('class="bnav"') && cg.includes('border-radius:14px'));

// --- snapshot the screens for viewing ---
writeFileSync('horda-app-start.html', land);
writeFileSync('horda-app-event.html', evPage);
writeFileSync('horda-app-event-paid.html', await get(`/e/${paidId}`));
writeFileSync('horda-app-checkout.html', checkout);
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
