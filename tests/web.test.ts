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
ok('home is event-led, no IG-style round photo rail', !home.includes('class="rail"') && !home.includes('class="story"') && !home.includes('Get closer to the athletes'));
// The public-events band is for OTHER people's events; a logged-in owner's own
// events are excluded. The demo test-user owns nearly all the seed, so assert the
// public band on a guest view (a non-owner), where everyone's events show.
const homePub = await get('/?guest=1');
ok('home is event-led (links to events)', homePub.includes('href="/e/') && homePub.includes('class="fcard"'));

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
const guestEv = await get(`/e/${(await app.db.query<{ id: string }>(`SELECT id FROM event WHERE starts_at > now() ORDER BY starts_at LIMIT 1`)).rows[0].id}?guest=1`);
ok('public event page leads with the claim (no content/shop)', guestEv.includes('Claim your spot') || guestEv.includes('Get ticket') || guestEv.includes('Get access') || guestEv.includes('waitlist'));

const fan = await get(`/fan/${app.ids.fanId}`);
// "Your events": the profile page is your personal events dashboard — what you
// RUN, what you CO-RUN, what you're GOING TO, and your Hordas (follows). It is
// titled "Your events", carries the Settings/Log out selector on top, and does
// NOT carry the discovery feed or notifications (those live elsewhere).
ok('profile page is titled "Your events" (not "Your Horda")', fan.includes('>Your events</a>') && !fan.includes('<h1>Your Horda</h1>'));
ok('top selector offers Settings + Log out', fan.includes('href="/settings"') && fan.includes('href="/logout"'));
ok('the four bands are present (run / co-run / going / Hordas)', fan.includes("You're running") && fan.includes("My Hordas"));
ok('no discovery feed on the profile ("Might be for you" is gone)', !fan.includes('Might be for you'));
ok('no notifications on the profile (they live under the bell)', !fan.includes('<h2>Notifications'));

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
const ticketedId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='paid' LIMIT 1`)).rows[0].id;
const paidPage = await get(`/e/${ticketedId}`);
const paidPageG = await get(`/e/${ticketedId}?guest=1`);
ok('paid event shows a price + claim CTA', (paidPageG.includes('Get ticket') || paidPageG.includes('Claim your spot')) && /€\s?15/.test(paidPageG));
const checkout = await get(`/e/${ticketedId}/checkout`);
ok('checkout page shows the charge', checkout.includes('Checkout') && checkout.includes('Pay'));
await fetch(base + `/e/${ticketedId}/pay`, form({ fan_id: app.ids.fanId }));
const paidAfter = await get(`/e/${ticketedId}`);
// The bearer-ticket surface is gone: a paid claim gives you a PASS (identity-bound,
// QR at the door), never a transferable "ticket you hold".
ok('after pay, the fan gets a pass — not a bearer ticket', !paidAfter.includes('You hold a ticket'));
const applyId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE admission='apply' LIMIT 1`)).rows[0].id;
ok('apply event shows the claim CTA (approval-gated)', (await get(`/e/${applyId}?guest=1`)).includes('Claim your spot'));

// RESALE + GIFTING ARE NOT OFFERED. These used to assert the opposite, while the
// AGB said in writing that tickets are personengebunden and resale isn't offered.
// The page was wrong, so the test was too. Both directions are asserted now: no
// UI, AND no live endpoint (the routes existed unlinked, and never checked that
// the caller owned the ticket they were giving away).
ok('no Gift / Sell affordance on a ticket', !paidAfter.includes('>Gift</button>') && !paidAfter.includes('>Sell</button>'));
ok('no resale shelf on the event page', !paidAfter.includes('<div class="h3">Resale</div>'));
for (const r of ['gift', 'list', 'buy']) {
  const resp = await fetch(base + `/ticket/${r}`, form({ ticket_id: 'x', event_id: ticketedId, price: '5' }));
  ok(`/ticket/${r} is gone, not just unlinked (404)`, resp.status === 404);
}

// Post-pivot: no subscription tiers, no gated content. The crowd is followable;
// closeness comes from showing up (standing), never from a paid status.
ok('athlete page offers "Join the crowd" (follow), not paid tiers', guest.includes('crowd') && !guest.includes('Clubhouse membership') && !guest.includes('/mo'));
ok('no content/exclusivity gating on the public page', !guest.includes('class="lockpill"') && !guest.includes('Supporter-only'));

const createForm = await get(`/host/athlete/${rico}/new`);
// Rewritten for the reworked form: the old one asked "Admission" + "Price" +
// five stream URLs all at once. The new one asks where, then what that implies.
// The form asks WHERE, then offers a block per door that the place allows. It
// is NOT one get-in question with one answer — a hybrid event has two doors and
// the fan chooses. (v80's single `getin` radio couldn't express that; see
// tests/ways.test.ts for the full model.)
ok('create form asks where, then offers a block per door', createForm.includes('name="location_kind"') && createForm.includes('way_ip') && createForm.includes('way_st'));
ok('each door prices itself; price only surfaces when that door is paid', createForm.includes('fmt_inperson_price') && createForm.includes('ip_price_wrap') && createForm.includes('fmt_stream1_price'));
ok('the stream door carries the watch link', createForm.includes('fmt_stream1_url'));
ok('the organiser can let one person take several spots', createForm.includes('fmt_inperson_maxpp'));
ok('athlete profile shows its events + a FEATURED cross-post', athleteImg.includes('Schedule an event') && athleteImg.includes('Season launch'));

// --- live start screen (public, filterable, gated personalization) ---
const land = await get('/?guest=1');
ok('start screen: broad sport menu + free location field (no hard-coded cities)', land.includes('All sports') && land.includes('Boxing') && land.includes('Basketball') && land.includes('Everywhere') && land.includes('City or country') && !land.includes('>Hamburg</a>'));
ok('location field offers type-ahead suggestions + use-my-location', land.includes('<datalist id="loclist"') && land.includes('id="locbtn"') && land.includes('navigator.geolocation'));
ok('start screen leads with events + map (no results section)', land.includes('Events · live &amp; upcoming') && land.includes('class="fcard"') && land.includes('class="mapcard"') && !land.includes('Latest results'));
ok('no "create feed" activation banner (guest leads with events)', !land.includes('Get your feed') && land.includes('class="fcard"'));
// logged-in home leads with a personalized feed, not the activation banner
const homeIn = await get('/');
ok('logged-in home is the personalized feed (Your events / follow prompt, no create-feed CTA)', !homeIn.includes('Get your feed') && (homeIn.includes('Your events') || homeIn.includes('Your feed is empty')));
// filtering narrows the events (a nonsense region yields no event cards)
const noneFiltered = await get('/?region=Nowhereville');
ok('sport/city filter narrows the events list', !noneFiltered.includes('class="fcard"') || noneFiltered.length < land.length);
// the Following page: list + search + unfollow
const following = await get('/following');
ok('Following page lists follows + search + unfollow', following.includes('>Following<') && following.includes('action="/following"') && (following.includes('/unfollow') || following.includes('not following anyone')));
const filtered = await get(`/?sport=boxing&region=Hamburg`);
ok('filter is applied to the landing (region reflected)', filtered.includes('Hamburg'));

// --- REGRESSION: an event created THROUGH THE FORM must be viewable ---------
// v79 bug: /e/:id threw "esc is not defined" — esc() was used in the Event Room
// CTA but never imported into server.ts. It only fired when a room was enabled.
// Seed events have no rooms, so 138 tests passed while every real user-created
// event 500'd, because the create form ships "Open an Event Room" PRE-CHECKED.
// The lesson: test the artefact a user actually produces, not the fixture.
const hostA = app.ids.athletes[0].id;
const mk = await fetch(base + `/events`, {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    host_kind: 'athlete', host_id: hostA,
    title: 'Regression Night', starts_at: '2030-09-12T20:00', location: 'Kreuzberg',
    admission: 'open', room_enabled: '1', room_label: 'Fight <Night>',   // form default
  }).toString(),
});
const mkLoc = mk.headers.get('location') || '';
ok('creating an event through the form redirects to the event', mk.status === 303 && mkLoc.startsWith('/e/'));
const newEv = await fetch(base + mkLoc);
const newEvHtml = await newEv.text();
ok('a form-created event page LOADS (no esc/500 crash)', newEv.status === 200);
ok('event page has no server error leaking into the HTML', !newEvHtml.includes('is not defined') && !newEvHtml.includes('ReferenceError'));
ok('the room label is HTML-escaped, not injected raw', !newEvHtml.includes('<Night>'));

// --- create-event: the parts NOT about doors ---------------------------------
// The "ways to get in" model (doors, per-door price/capacity, party size, the
// admission/access derivation) now lives in tests/ways.test.ts — it outgrew a
// few lines here. v80's single `getin` radio, and the assertions that pinned it,
// are deliberately gone: that model could not express a hybrid event.
const ev = async (o: Record<string, string>) => {
  const r = await fetch(base + '/events', {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ host_kind: 'athlete', host_id: hostA, title: 'T', starts_at: '2030-05-05T19:00', ...o }).toString(),
  });
  const id = (r.headers.get('location') || '').replace('/e/', '');
  return (await app.db.query<any>(`SELECT admission, access_mode, price_cents, capacity, waitlist_enabled, approval_required, visibility, (SELECT key FROM sport WHERE id=sport_id) sport FROM event WHERE id=$1`, [id])).rows[0];
};
// Approval used to be a fourth admission VALUE, so "paid AND approved" couldn't
// be expressed. As a flag it composes with anything.
const a6 = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '10', approval_required: '1' });
ok('approval composes with paid (was impossible as a 4th admission value)', a6.approval_required === true && a6.price_cents === 1000);
// Capacity: unlimited unless explicitly opted into. A stray number must not
// silently cap an event.
const a7 = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', capacity_limited: '0', capacity: '50' });
ok('unticking the limit means unlimited, even with a stale number in the box', a7.capacity === null && a7.waitlist_enabled === false);
const a7b = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', capacity: '50' });
ok('a caller predating the toggle still gets its capacity honoured', a7b.capacity === 50);
const a8 = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', capacity_limited: '1', capacity: '50', waitlist_enabled: '1' });
ok('opting into a limit sets capacity + waitlist', a8.capacity === 50 && a8.waitlist_enabled === true);
// Sport: the `sport` TABLE is a registry that only had seeded sports, so HYROX
// resolved to null and no filter could ever find the event. Now self-populating.
const a9 = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', visibility: 'unlisted', sport: 'hyrox' });
ok('a sport new to the registry (HYROX) registers itself on first use', a9.sport === 'hyrox');
ok('private events are stored unlisted', a9.visibility === 'unlisted');
const a10 = await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', sport: 'other' });
ok('"Other / not a sport" means no sport, not a fake one', a10.sport === null);

// "Private" has to MEAN private. Two events, same sport, same everything —
// only the public one may be discoverable. Enforced in the query, not by hoping
// no UI links to it.
const { getDiscover } = await import('../src/db/discover_repo.ts');
await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', sport: 'climbing', title: 'PUBLIC_SESSION', visibility: 'public' });
await ev({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', sport: 'climbing', title: 'SECRET_SESSION', visibility: 'unlisted' });
const climb = await getDiscover(app.db, { sport: 'climbing' });
const titles = climb.upcoming.map((e: any) => e.title);
ok('a public event IS discoverable by its sport', titles.includes('PUBLIC_SESSION'));
ok('an unlisted event is NOT discoverable, even by the filter that matches it', !titles.includes('SECRET_SESSION'));
ok('an unlisted event is still reachable by direct link', (await fetch(base + '/e/' + (await app.db.query<any>(`SELECT id FROM event WHERE name='SECRET_SESSION'`)).rows[0].id)).status === 200);

const cform = await get(`/host/athlete/${hostA}/new`);
ok('form says "Event name", not "Title"', cform.includes('Event name') && !cform.includes('>Title<'));
ok('public/private is the first choice, at the top', cform.includes('ev_vis') && cform.includes('only people with the link'));
ok('sport sits at the top, defaulted to the host\'s own', cform.includes('name="sport"'));
ok('optional detail is collapsed so the first screen is the decision', cform.includes('<details class="more"'));
ok('capacity is per-door (Spots), not a duplicate global limit', cform.includes('Spots') && !cform.includes('Limit how many people can come') && !cform.includes('ev_cap_on'));
ok('approval is asked in English (no German), once', cform.includes('Approval required') && !cform.includes('Genehmigung'));
ok('the 5 always-visible stream URL fields are gone', !cform.includes('name="youtube"') && !cform.includes('name="twitch"'));
// The language toggle is a full navigation; without this the form was wiped.
ok('form state survives a language switch (sessionStorage snapshot/restore)', cform.includes('sessionStorage') && cform.includes('hz_evform_'));
ok('address field is autofilled from the place lookup', cform.includes('/api/geo'));

// --- event image: create → event page → home card ---------------------------
// The plumbing existed (cover_url, event hero, feed card) but the upload was
// buried in a collapsed fold, so in practice nobody added a picture — and the
// picture is what makes a card get clicked. These walk the whole chain.
// Dated SOON on purpose: the home screen shows the nearest 8 events, so a 2030
// date would be a real event that simply isn't in the visible window — which
// would make this test fail for a reason that has nothing to do with images.
const soonISO = new Date(Date.now() + 36e5).toISOString().slice(0, 16);
const evImg = await ev({ location_kind: 'in_person', getin: 'free_open', sport: 'boxing', title: 'IMG_EVENT', cover: png, starts_at: soonISO });
const imgRow = (await app.db.query<any>(`SELECT id, cover_url FROM event WHERE name='IMG_EVENT'`)).rows[0];
ok('an uploaded event image is stored on the event', !!imgRow.cover_url);
ok('the image renders on the event page', (await get('/e/' + imgRow.id)).includes(imgRow.cover_url.slice(0, 40)));
const homeImg = await get('/?guest=1');   // guest = non-owner, sees all public events
ok('the image renders on the event card on the home screen', homeImg.includes('IMG_EVENT') && homeImg.includes(imgRow.cover_url.slice(0, 40)));
// A feed of empty rectangles is worse than generated art, so there's always art.
await ev({ location_kind: 'in_person', getin: 'free_open', sport: 'boxing', title: 'NOIMG_EVENT', starts_at: soonISO });
const homeNo = await get('/?guest=1');   // guest = non-owner, sees all public events
ok('an event with no image still gets a dynamic banner, never an empty card', homeNo.includes('NOIMG_EVENT') && /class="fimg" src="\/e\/[^"]+\/banner\.svg"/.test(homeNo));
const cform2 = await get(`/host/athlete/${hostA}/new`);
ok('the image upload sits up top, not buried in the details fold', cform2.includes('ev_cover_drop') && cform2.indexOf('ev_cover_drop') < cform2.indexOf('<details class="more"'));
ok('exactly one input writes the cover field (two would race)', (cform2.match(/data-target="cover"/g) || []).length === 1);
ok('the upload previews the actual card art before publishing', cform2.includes('ev_banner_prev'));

// --- rival / roster typeahead ---------------------------------------------
// Naming a rival as free text mints an UNCLAIMED placeholder. If that rival is
// already on Horda and you type their name slightly differently, you get a
// duplicate ghost and that side's attribution accrues to nobody — which is the
// one number the product sells. So: picked entity → linked; typed → placeholder
// (the growth loop); forged id → refused, never trusted from the client.
const apiRes = await fetch(base + '/api/entities?q=ric');
const apiJson = await apiRes.json() as any;
ok('entity typeahead returns matches as JSON', apiRes.status === 200 && Array.isArray(apiJson.results) && apiJson.results.length > 0);
ok('typeahead suggestions carry what a human needs to disambiguate', apiJson.results.every((r: any) => 'kind' in r && 'name' in r && 'region' in r && 'verified' in r));
ok('typeahead ignores 1-char noise (everything would match)', ((await (await fetch(base + '/api/entities?q=r')).json()) as any).results.length === 0);
// Fan-privacy doctrine: this is an authoring aid, not a browsable people index.
// A logged-out request must get nothing back — not a smaller list, nothing.
const apiGuest = await fetch(base + '/api/entities?q=ric&guest=1');
ok('typeahead is not a public people directory (guests get 401, no results)', apiGuest.status === 401 && ((await apiGuest.json()) as any).results.length === 0);

const mkEv = async (body: Record<string, string>) => (await fetch(base + '/events', {
  method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(body).toString(),
})).headers.get('location')!.replace('/e/', '');
const rivalClub = app.ids.clubs[0].id;
const evPick = await mkEv({ host_kind: 'athlete', host_id: hostA, title: 'Picked rival', starts_at: '2030-01-01T20:00', admission: 'open', archetype: 'versus', side_b_name: 'FC Beispiel', side_b_kind: 'club', side_b_id: rivalClub });
const bPick = (await app.db.query<any>(`SELECT entity_kind, entity_id, placeholder, status FROM event_party WHERE event_id=$1 AND side='B'`, [evPick])).rows[0];
ok('rival picked from suggestions links the REAL entity (no ghost placeholder)', bPick.entity_id === rivalClub && bPick.entity_kind === 'club' && bPick.placeholder === null);
ok('a named-but-not-consenting rival is "invited", not silently "accepted"', bPick.status === 'invited');

const evFree = await mkEv({ host_kind: 'athlete', host_id: hostA, title: 'Free rival', starts_at: '2030-01-01T20:00', admission: 'open', archetype: 'versus', side_b_name: 'FC Nowhere' });
const bFree = (await app.db.query<any>(`SELECT entity_id, placeholder, status FROM event_party WHERE event_id=$1 AND side='B'`, [evFree])).rows[0];
ok('a rival NOT on Horda still works as free text (the growth loop)', bFree.entity_id === null && bFree.placeholder === 'FC Nowhere' && bFree.status === 'unclaimed');

const evRost = await mkEv({ host_kind: 'athlete', host_id: hostA, title: 'Card', starts_at: '2030-01-01T20:00', admission: 'open', archetype: 'multi', roster: 'Rico, Ghost Guy', roster_ids: `athlete:${hostA},` });
const rost = (await app.db.query<any>(`SELECT entity_id, placeholder FROM event_party WHERE event_id=$1 AND role='attending_athlete'`, [evRost])).rows;
ok('roster mixes linked entities and free-text placeholders', rost.some((r: any) => r.entity_id === hostA) && rost.some((r: any) => r.placeholder === 'Ghost Guy'));

const evBad = await mkEv({ host_kind: 'athlete', host_id: hostA, title: 'Bad id', starts_at: '2030-01-01T20:00', admission: 'open', archetype: 'versus', side_b_name: 'X', side_b_kind: 'club', side_b_id: 'not-a-uuid' });
const bBad = (await app.db.query<any>(`SELECT entity_id, placeholder FROM event_party WHERE event_id=$1 AND side='B'`, [evBad])).rows[0];
ok('a forged entity id from the client is refused, falls back to placeholder', bBad.entity_id === null && bBad.placeholder === 'X');

const formHtml = await get(`/host/athlete/${hostA}/new`);
ok('create form ships the rival + roster typeahead', formHtml.includes('/api/entities') && formHtml.includes('ev_sideb') && formHtml.includes('ev_roster_in'));
ok('typeahead always offers "use as typed" so off-Horda rivals are never blocked', formHtml.includes('not on Horda yet'));

// --- built in the open: public changelog + env-gated Discord ---------------
// The changelog is public (no auth) — a stranger who has never heard of us must
// be able to see that we ship. It leads with the unshipped promises.
const clog = await get('/changelog');
ok('changelog is public and lists shipped entries', clog.includes('What we shipped') && clog.includes('class="cle"'));
ok('changelog publishes what is NOT built yet (the promise)', clog.includes('Now building') && clog.includes('class="bldi"'));
ok('changelog credits the fan who asked, by handle', clog.includes('Asked for by') || !/asked:/.test(clog));
ok('changelog is reachable from /about and the app footer', (await get('/about')).includes('/changelog') && (await get('/')).includes('/changelog'));
ok('/about/changelog redirects to the canonical /changelog', (await (await fetch(base + '/about/changelog', { redirect: 'manual' })).headers.get('location')) === '/changelog');
// Discord is env-gated: with DISCORD_INVITE_URL unset nothing may render a
// dead invite link. This test runs without the env var set.
const noDeadInvite = (s: string) => !s.includes('discord.gg') && !s.includes('discord.com/invite');
ok('no Discord invite link renders when DISCORD_INVITE_URL is unset', noDeadInvite(clog) && noDeadInvite(await get('/about')) && noDeadInvite(await get('/')));
ok('changelog still lets people ask for features without Discord configured', clog.includes('Tell us what to build'));
// no round photo rail; the event map is kept as a designed section; big featured EVENT cards
ok('landing keeps the event map in a designed section (not a round tile)', land.includes('class="mapcard"') && land.includes('Event map') && land.includes('href="/map"') && !land.includes('Creator map'));
ok('no IG-style round athlete photos on the landing', !land.includes('class="story"') && !land.includes('class="rail"'));
ok('featured cards are PUBLIC EVENTS (photo posters linking to /e/)', land.includes('class="fcard"') && land.includes('class="ftitle"') && /class="fcard[^"]*" href="\/e\//.test(land));
const mapPage = await get('/map');
ok('event map is its own page (Leaflet + CARTO), removed from landing', mapPage.includes('id="map"') && mapPage.includes('cartocdn.com') && mapPage.includes('Event map') && !land.includes('id="map"'));
// The `mav` span now carries an optional ` live` class for the orange live-ring,
// so match the class prefix rather than the exact closing quote.
ok('map markers are avatar rings that link to the profile (no name/popup label)', mapPage.includes("className:'hz-av'") && mapPage.includes('class="mav') && mapPage.includes('window.location.href=p.href') && !mapPage.includes('bindPopup'));
ok('landing footer carries the company description', land.includes('The events home for sports and competitive culture'));
ok('single dark arena theme: no theme boot script + no toggle on landing', !land.includes("localStorage.getItem('hz_theme')") && !land.includes('class="thm"'));
ok('no light mode anywhere (dark-only guardrail)', !land.includes('data-theme="light"') && !(await get(`/athlete/${rico}`)).includes('data-theme="light"'));
ok('map filters with taste too (Hamburg boxing excludes Rico everywhere)', !filtered.includes(`/athlete/${rico}`));
// instagram-like usability: persistent bottom tab bar + verified trust badges
// The mobile bar now mirrors the desktop rail exactly (same five destinations,
// same labels) instead of having its own Home/Map/You vocabulary.
ok('persistent bottom tab bar, icon-only (labels via aria-label, no text)', land.includes('class="bnav"') && land.includes('aria-label="Your Horda"') && !land.includes('class="lbl"') && !land.includes('>Home<'));
ok('mobile bar mirrors the desktop rail (same destinations)', land.includes('aria-label="Your Horda"') && land.includes('aria-label="Following"'));
ok('mobile bar is a floating translucent glass bar, not an opaque tray', land.includes('backdrop-filter:blur(22px)') && land.includes('border-radius:20px'));
ok('bottom nav appears on inner pages too (athlete)', (await get(`/athlete/${rico}`)).includes('class="bnav"'));
ok('verified badge on a claim-verified athlete (Rico is owned)', land.includes('class="vbadge"'));
// TikTok-style desktop left rail + language toggle + event engagement chips
// "Explore" → "Your Horda": the logged-in home IS the feed, so the nav says so.
ok('desktop left rail: labelled Your Horda/Following/Create/Profile nav', land.includes('class="drail"') && land.includes('>Your Horda<') && land.includes('>Following<') && land.includes('>Create event<'));
ok('no separate "your feed" button (the feed is Your Horda)', !land.includes('Your feed →'));
ok('search box says just "Search" (you can search clubs + athletes too)', land.includes('placeholder="Search"'));
ok('rail create link is generic /create (no leaked athlete id)', land.includes('href="/create"') && !land.includes(`/athlete/${rico}/compose`));
ok('rail carries a search box (English-only: no language toggle)', land.includes('class="dr-search"') && !land.includes('class="lgtog"') && !land.includes('/set-lang?l=de'));
ok('event cards show engagement stats (going / followers / shares)', land.includes('class="estats"') && land.includes('class="est"'));
// English-only: even a legacy German cookie renders English chrome.
const deLand = await (await fetch(base + '/', { headers: { cookie: 'hz_lang=de' } })).text();
ok('a legacy German cookie still renders English (no German chrome)', deLand.includes('>Your Horda<') && !deLand.includes('>Deine Horda<') && deLand.includes('lang="en"'));
// region default: even a DACH country header renders English now.
const dachLand = await (await fetch(base + '/', { headers: { 'cf-ipcountry': 'AT' } })).text();
ok('DACH visitor also gets English (app is English-only)', dachLand.includes('lang="en"') && dachLand.includes('>Your Horda<'));
const usLand = await (await fetch(base + '/', { headers: { 'cf-ipcountry': 'US' } })).text();
ok('non-DACH visitor gets English', usLand.includes('lang="en"') && usLand.includes('>Your Horda<'));
// no underline on logo/nav; active nav item uses the accent (not underline)
ok('logo + nav are never underlined; active nav uses the accent', !land.includes('text-decoration:underline') && land.includes('.dr-item.on,.dr-item.on svg{color:var(--acc)}'));
// one sign-up for everyone: no creator fork on the sign-up page
const signup = await (await fetch(base + '/signup')).text();
ok('sign-up is one flow (no creator "Set up your page" fork)', !signup.includes('Set up your page') && signup.includes('set up an athlete or club page later'));
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
ok('picker mirrors the "Next up" design (card + notyet + opts buttons)', mfPage.includes('>Attend</h2>') && mfPage.includes('class="notyet"') && mfPage.includes('class="opts"') && mfPage.includes('Claim your spot — watch on TikTok Live') && mfPage.includes('Claim your spot — watch on Sportdeutschland.TV') && !mfPage.includes('class="fmtwrap"'));
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
// Sharing an event sends the CARD, not a bare link: the PNG rides along via Web
// Share Level 2 (the only route into an Instagram Story) and unfurls as og:image.
ok('event share carries the matchday card image', /data-img="\/e\/[^"]+\/card\.png"/.test(mfPage));
ok('share falls back to a link where files are unsupported', mfPage.includes('navigator.canShare') && mfPage.includes('navigator.share'));
// event create form exposes an "About this event" field
ok('event create form offers an About this event section', createForm.includes('About this event') && createForm.includes('name="description"'));
// signup is magic-link only now: POST /signup sends a link and creates NO
// account (and therefore no interests) until the link is verified.
const suEmail = `au${Date.now()}@x.co`;
const suResp = await fetch(base + '/signup', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: suEmail, name: 'AF', sport: 'boxing', region: 'Hamburg' }).toString(), redirect: 'manual' });
const suBody = await suResp.text();
ok('signup responds with the magic-link "check your email" step', /check your email/i.test(suBody));
ok('signup creates no account (and no interests) before the link is verified', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM account WHERE email=$1`, [suEmail])).rows[0].n === 0);

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
// The QR encodes a native-camera check-in URL (/e/:id/scan/:token), not a bare token.
const scanTok = (tkPass.match(/\/e\/[^/"]+\/scan\/([0-9a-f]{12,})/) || [])[1] || '';
ok('the pass QR encodes a native-camera check-in URL, not just a token', !!scanTok && tkPass.includes(`/e/${tkId}/scan/${scanTok}`));
const checkinPage = await get(`/e/${tkId}/check-in`);
ok('organizer check-in has a camera scanner (jsQR via jsdelivr) + manual fallback', checkinPage.includes('cdn.jsdelivr.net/npm/jsqr') && checkinPage.includes('hzScan') && checkinPage.includes('Scan a QR ticket') && checkinPage.includes('name="token"'));
// The organiser scanning the QR with their phone's camera app checks the fan in.
const scanned = await get(`/e/${tkId}/scan/${scanTok}`);   // no cookie = demo owner of Rico
ok('scanning the QR as the organiser checks the fan in', scanned.includes('Checked in'));
ok('scanning it again reads "already checked in"', (await get(`/e/${tkId}/scan/${scanTok}`)).includes('Already checked in'));
ok('a non-owner scanning it does NOT check in — it just shows the pass', (await fetch(base + `/e/${tkId}/scan/${scanTok}?guest=1`, { redirect: 'manual' })).headers.get('location')?.includes(`/pass/${scanTok}`));
const lkId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Stream Test', starts_at: '2027-06-02T19:00', location_kind: 'online', location: 'https://youtube.com/live/x', admission: 'open', access_mode: 'link' });
const lkPage = await get(`/e/${lkId}?guest=1`);
ok('link-mode event: guest CTA is a claim (Claim your spot / Get access), not a QR "Get ticket"', (lkPage.includes('Claim your spot') || lkPage.includes('Get access')) && !lkPage.includes('Get ticket'));
// in-person / online / both must display as what they actually are — derived from
// the doors opened, so an in-person+online event never reads "online only".
const dispIp = await get(`/e/${await mkEvent({ host_kind: 'club', host_id: club, title: 'Disp IP', starts_at: '2027-07-01T19:00', location_kind: 'in_person', location: 'Poststadion, Berlin', fmt_inperson: '1', ip_cost: 'free' })}?guest=1`);
const dispOn = await get(`/e/${await mkEvent({ host_kind: 'club', host_id: club, title: 'Disp On', starts_at: '2027-07-02T19:00', location_kind: 'online', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://youtube.com/live' })}?guest=1`);
const dispHy = await get(`/e/${await mkEvent({ host_kind: 'club', host_id: club, title: 'Disp Hy', starts_at: '2027-07-03T19:00', location_kind: 'hybrid', location: 'Arena, Berlin', fmt_inperson: '1', ip_cost: 'free', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://youtube.com/live' })}?guest=1`);
ok('in-person event shows the venue (not "Online event")', dispIp.includes('Poststadion') && !dispIp.includes('Online event'));
ok('online event shows "Online event"', dispOn.includes('Online event'));
ok('in-person + online event shows "In person + streamed" (not online only)', dispHy.includes('In person + streamed'));
const lkPass = await claimToPass(lkId);
ok('link-mode pass reveals the link, no QR', lkPass.includes('Open the event link') && !lkPass.includes('id="hzqr"'));

// --- organizer's choice: public watch link vs claim-gated link ---
const pubId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Public Stream', starts_at: '2027-06-03T19:00', location_kind: 'online', location: 'https://youtube.com/live/pub', admission: 'open', access_mode: 'public' });
const pubGuest = await get(`/e/${pubId}?guest=1`);
ok('public online event: the watch/join link is open to unregistered users', pubGuest.includes('Join link') && !pubGuest.includes('Link revealed after you claim'));
const gatedGuest = await get(`/e/${lkId}?guest=1`);
ok('gated online event: link is hidden behind a claim for the unregistered', gatedGuest.includes('Link revealed after you claim') && !gatedGuest.includes('Join link'));

// --- a GUEST claim is gated behind a magic link (no instant, unverified session) ---
const gcId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Gate Test', starts_at: '2027-06-04T19:00', location_kind: 'in_person', location: 'Berlin', admission: 'open', access_mode: 'ticket' });
const gcRes = await fetch(base + `/claim/${gcId}?guest=1`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Gate Fan', contact: `gate${Date.now()}@x.co` }).toString(), redirect: 'manual' });
const gcBody = await gcRes.text();
ok('guest claim mints NO session (no hz_session cookie)', !(gcRes.headers.get('set-cookie') || '').includes('hz_session'));
ok('guest claim does NOT jump straight to a pass', gcRes.status === 200 && !(gcRes.headers.get('location') || '').includes('/pass/'));
ok('guest claim sends a magic link to finish', /Check your email/i.test(gcBody));
const gcLink = (gcBody.match(/\/auth\/verify\?token=[A-Za-z0-9_.-]+/) || [])[0] || '';
ok('the magic link exists (dev mode)', !!gcLink);
const gcVerify = await fetch(base + gcLink, { redirect: 'manual' });
const gcNext = gcVerify.headers.get('location') || '';
ok('clicking the link verifies and routes into /claim/:id/resume', gcNext.includes(`/claim/${gcId}/resume`));
const gcCookie = (gcVerify.headers.get('set-cookie') || '').match(/hz_session=[^;]+/)?.[0] || '';
const gcResume = await fetch(base + gcNext, { headers: { cookie: gcCookie }, redirect: 'manual' });
ok('only after verifying does the claim complete → a pass', (gcResume.headers.get('location') || '').includes('/pass/'));

// --- share (anonymous) vs share-under-your-name (attributable, logged-in only) ---
const guestShareView = await get(`/e/${tkId}?guest=1`);
ok('guest gets a plain anonymous Share only (no attributable share)', guestShareView.includes('aria-label="Share"') && !guestShareView.includes('Share under your name'));
ok('guest is nudged to log in to share under their name', guestShareView.includes('to share under your name'));
// dedicated fresh event so no earlier claim interferes with attribution
const attrId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Bring-a-friend', starts_at: '2027-07-01T19:00', location_kind: 'in_person', location: 'Berlin', admission: 'open', access_mode: 'ticket' });
const memberShareView = await get(`/e/${attrId}`);   // no guest flag → demo viewer is logged in
ok('logged-in gets Share AND an attributable card link', memberShareView.includes('Share the matchday card') && memberShareView.includes(`/e/${attrId}?via=`));
// a claim through the attributable link is credited to the sharer on the manage view
const shareTok = (memberShareView.match(/\/e\/[^"?]+\?via=([a-z0-9]+)/) || [])[1] || '';
await fetch(base + `/claim/${attrId}?via=${shareTok}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Referred Fan', contact: `r${Date.now()}@x.co` }).toString(), redirect: 'manual' });
const manageView = await get(`/manage/${attrId}`);
ok('organizer sees "Who brought people" with the attributed claim', shareTok !== '' && manageView.includes('Who brought people'));

// --- UX fixes: session persistence, contact host, past events, create flow ---
// verifying a magic link issues a persistent (not session-scoped) cookie so login sticks
const persistEmail = `u${Date.now()}@x.co`;
const startBody = await fetch(base + '/auth/start', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: persistEmail, name: 'U' }).toString(), redirect: 'manual' }).then(r => r.text());
const persistTok = (startBody.match(/\/auth\/verify\?token=([a-f0-9-]+)/) || [])[1] || '';
const verifyRes = await fetch(base + '/auth/verify?token=' + persistTok, { redirect: 'manual' });
const sc = verifyRes.headers.get('set-cookie') || '';
ok('magic-link verify issues a persistent session cookie (Max-Age set), not session-scoped', sc.includes('hz_session=') && /Max-Age=\d{5,}/.test(sc));
// contact host: event page shows a way to reach the host (socials or profile link)
const hostEv = await get(`/e/${tkId}?guest=1`);
ok('event page gives a real way to reach the host', hostEv.includes('on Horda →') && (hostEv.includes('Reach the host') || hostEv.includes('via their Horda page')));
// past event: create one in the past → event page says it's over, no claim CTA
const pastId = await mkEvent({ host_kind: 'athlete', host_id: rico, title: 'Last Month', starts_at: '2020-01-01T19:00', location_kind: 'in_person', location: 'Berlin', admission: 'open', access_mode: 'ticket' });
const pastEv = await get(`/e/${pastId}?guest=1`);
ok('past event page says it is in the past, not "Claim your spot"', pastEv.includes('This event is in the past') && !pastEv.includes('>Claim your spot<'));
// and past events are dropped from the discover timeline
const disc = await get('/');
ok('past events do not appear in the discover timeline', !disc.includes('Last Month'));
// create flow: a logged-in user (demo) is taken to an event form, not the page chooser
const createGo = await fetch(base + '/create', { redirect: 'manual' });
const createLoc = createGo.headers.get('location') || '';
ok('/create sends a logged-in user toward hosting an event (not the athlete/club chooser)', (createGo.status === 303 && (createLoc.includes('/host/') || createLoc.startsWith('/signup'))) || createGo.status === 200);

// --- multi-party events (Horda_Multi_Party_Events_Architecture.md) ---
// versus event with an unclaimed rival side + auto promo links
const vsId = await mkEvent({ host_kind: 'club', host_id: club, title: 'Regionalliga-Pokal', starts_at: '2027-11-01T19:00', location_kind: 'in_person', location: 'Berlin', admission: 'open', access_mode: 'ticket', archetype: 'versus', side_b_name: 'FC Rival' });
const vsGuest = await get(`/e/${vsId}?guest=1`);
ok('versus event shows a Line-up with both sides (VS)', vsGuest.includes('Line-up') && vsGuest.includes('VS') && vsGuest.includes('FC Rival'));
// Invite-only: a guest (or any non-organiser) can't open-claim the rival side —
// only the organiser sends an invite. And the matchup shows under the title.
ok('rival side is invite-only (no open "Claim this side"; awaits the organiser)', vsGuest.includes('unclaimed') && vsGuest.includes('Awaiting') && !vsGuest.includes('Claim this side'));
ok('versus matchup ("A vs B") shows under the event title', /class="pversus"/.test(vsGuest) && vsGuest.includes('FC Rival'));
// organizer share panel: every participant has a promo link with live counts
const vsManage = await get(`/manage/${vsId}`);
ok('organizer share panel lists per-participant promo links', vsManage.includes('Share panel') && vsManage.includes('?p=') && vsManage.includes('Custom link'));
// The organising account is Side A — it must NOT also appear as a separate "Organiser"
// row on top of the matchup, and Side A is labelled as the organiser.
ok('versus manage: host is Side A · organiser (no duplicate "Organiser" row)',
  vsManage.includes('A · organiser') && !/class="prole">Organiser</.test(vsManage));
// the custom-link creator is styled like the other promo cards (dashed promo card)
ok('custom-link creator matches the promo-card look', vsManage.includes('promo-new'));
// claim via a participant promo link is attributed to that party (party:token)
const sideBTok = (vsManage.match(/\?p=(p[a-z0-9]+)/g) || []).map(s => s.split('=')[1]);
const promoTok = sideBTok[0] || '';
await fetch(base + `/claim/${vsId}?p=${promoTok}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Promo Fan', contact: `pf${Date.now()}@x.co` }).toString(), redirect: 'manual' });
const seSrc = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM claim WHERE source_edge=$1`, [`party:${promoTok}`])).rows[0].n;
ok('a claim through a promo link is attributed to that party', promoTok !== '' && seSrc >= 1);
// sub-events: a bout under a parent, attribution rolls up. (A sub-event redirects
// to its parent, so fetch the child id from the DB rather than the Location header.)
await mkEvent({ host_kind: 'club', host_id: club, title: 'Bout One', starts_at: '2027-11-01T19:30', location_kind: 'in_person', location: 'Berlin', admission: 'open', access_mode: 'ticket', archetype: 'versus', side_b_name: 'Fighter B', parent_id: vsId });
const boutId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE parent_event_id=$1 ORDER BY created_at DESC LIMIT 1`, [vsId])).rows[0].id;
const parentPage = await get(`/e/${vsId}`);
ok('parent event lists its sub-events (the card)', parentPage.includes('Bout One'));
const boutPage = await get(`/e/${boutId}?guest=1`);
ok('sub-event links back to its parent', boutPage.includes('Part of') && boutPage.includes('Regionalliga-Pokal'));
const rollup = await get(`/manage/${vsId}`);
ok('parent share panel rolls up sub-event parties', rollup.includes('Bout One'));

// --- Stripe Connect payouts (Build Order item 4) ---
const cupId = await mkEvent({ host_kind: 'club', host_id: club, title: 'Ticketed Cup', starts_at: '2027-12-01T19:00', location_kind: 'in_person', location: 'Berlin', admission: 'paid', price: '20', access_mode: 'ticket' });
const paidManage = await get(`/manage/${cupId}`);
ok('paid event prompts the organizer to connect payouts (gate money not creation)', paidManage.includes('Connect payouts') && paidManage.includes('/connect'));
// connect payouts (dev/stub flips it enabled) → the gate clears
await fetch(base + `/host/club/${club}/connect`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '', redirect: 'manual' });
const payAcct = (await app.db.query<{ charges_enabled: boolean }>(`SELECT charges_enabled FROM payout_account WHERE host_kind='club' AND host_id=$1`, [club])).rows[0];
ok('connecting payouts records an enabled account for the host', !!payAcct && payAcct.charges_enabled === true);
const paidManage2 = await get(`/manage/${cupId}`);
ok('after connecting, manage shows payouts connected + platform fee', paidManage2.includes('Payouts connected') && paidManage2.includes('5%'));
const payoutsPage = await get(`/manage-payouts/club/${club}`);
ok('payouts page explains the connected state', payoutsPage.includes('Payments') && payoutsPage.includes('Payouts connected'));

const cg = await get(`/club/${club}?guest=1`);
ok('guest gate now coexists with the bottom nav (in-flow banner)', cg.includes('Log in to continue') && cg.includes('class="bnav"') && cg.includes('border-radius:14px'));

// --- snapshot the screens for viewing ---
writeFileSync('horda-app-start.html', land);
writeFileSync('horda-app-event.html', evPage);
writeFileSync('horda-app-event-paid.html', await get(`/e/${ticketedId}`));
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
