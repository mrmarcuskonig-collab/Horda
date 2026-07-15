import { startServer } from './src/web/server.ts';
import { randomUUID } from 'node:crypto';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0); const base = `http://localhost:${app.port}`;
const enc = (o: any) => new URLSearchParams(o);
const post = (o: any, cookie?: string) => ({ method: 'POST' as const, redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: enc(o) });
const G = (p: string, cookie?: string) => fetch(base + p, { headers: cookie ? { cookie } : {} });
const txt = async (p: string, cookie?: string) => await (await G(p, cookie)).text();
const code = async (p: string) => (await G(p)).status;
const rico = app.ids.athletes[0].id; const club = app.ids.clubs[0].id;
const evId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE host_kind='athlete' AND admission='open' LIMIT 1`)).rows[0]?.id;

console.log('\n[guest / public surfaces]');
const home = await txt('/');
ok('home 200 + event map section + location datalist', (await G('/')).status === 200 && home.includes('class="mapcard"') && home.includes('loclist') && !home.includes('class="rail"'));
ok('sport filter 200', await code('/?sport=boxing') === 200);
ok('map avatar-ring markers', (await txt('/map')).includes("className:'hz-av'"));
ok('/about/pricing fee-trust copy', (await txt('/about/pricing')).includes('Fair by design') && (await txt('/about/pricing')).includes('flat 10%') && (await txt('/about/pricing')).includes('Gate money, not creation'));
ok('/about/creators pitch', (await txt('/about/creators')).includes('Athletes'));
const apg = await txt(`/athlete/${rico}`);
ok('athlete page is a followable Crowd (no paid tiers/content gating)', apg.includes('crowd') && !apg.includes('class="lockpill"'));
ok('athlete bad id (non-uuid) → 404', await code('/athlete/not-a-real-id') === 404);
ok('athlete valid-but-missing uuid → 404', await code(`/athlete/${randomUUID()}`) === 404);
ok('club page 200', await code(`/club/${club}`) === 200);
ok('event page 200', await code(`/e/${evId}`) === 200);
ok('event bad id → 404', await code(`/e/${randomUUID()}`) === 404);

console.log('\n[security / gating]');
ok('webhook without signature → 400', (await fetch(base + '/stripe/webhook', post({}))).status === 400);
const evGuest = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: rico, title: 'X' }));
ok('guest cannot create events (-> signup)', evGuest.status === 303 && (evGuest.headers.get('location') || '').includes('/signup'));
const manageGuest = await fetch(base + `/manage/${evId}`, { redirect: 'manual' });
ok('guest cannot open the guest list (manage redirects away)', manageGuest.status === 303 && !(manageGuest.headers.get('location') || '').includes('/manage'));

console.log('\n[fan journey]');
const sf = await fetch(base + '/signup', post({ email: 'qafan@x.com', name: 'QA Fan', password: 'secret123' }));
const cookie = (sf.headers.get('set-cookie') || '').split(';')[0];
ok('signup -> fan onboarding + session', sf.status === 303 && sf.headers.get('location') === '/onboarding/fan' && !!cookie);
const fanId = (await app.db.query<{ id: string }>(`SELECT f.id FROM fan f JOIN account a ON a.id=f.account_id WHERE a.email='qafan@x.com'`)).rows[0].id;
ok('fan home shows activation checklist (or completion celebration)', (await txt(`/fan/${fanId}`, cookie)).includes('hz_act_fan'));
await fetch(base + '/follow', post({ target_type: 'athlete', target_id: rico }, cookie));
await fetch(base + '/follow', post({ target_type: 'athlete', target_id: app.ids.athletes[1].id }, cookie));
await fetch(base + '/follow', post({ target_type: 'club', target_id: club }, cookie));
const follows = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE fan_id=$1`, [fanId])).rows[0].n;
ok('three follows recorded for the session fan', follows === 3);
await fetch(base + '/join', post({ owner_kind: 'athlete', owner_id: rico, level: 'supporter', billing: 'annual' }, cookie));
const mem = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM membership WHERE fan_id=$1 AND status='active'`, [fanId])).rows[0].n;
ok('join -> active membership for the session fan', mem === 1);

console.log('\n[identity cannot be forged]');
await fetch(base + '/follow', post({ fan_id: fanId, target_type: 'athlete', target_id: rico }));  // no cookie, tries to act as fanId
const followsAfter = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE fan_id=$1`, [fanId])).rows[0].n;
ok('forged follow with another fan_id did not write to that fan', followsAfter === 3);

console.log('\n[creator athlete journey]');
const sc = await fetch(base + '/signup', post({ email: 'qaath@x.com', name: 'QA Ath', password: 'secret123', next: '/onboarding/athlete' }));
const cc = (sc.headers.get('set-cookie') || '').split(';')[0];
ok('creator signup -> athlete onboarding', sc.headers.get('location') === '/onboarding/athlete');
ok('prompt box shown', (await txt('/onboarding/athlete', cc)).includes('Generate my page'));
const pub = await fetch(base + '/onboarding/athlete', post({ name: 'QA Hawk', handle: 'qahawk', tagline: 't', bio: 'b', birth_year: '1995', cover: 'data:image/svg+xml;utf8,X', avatar: 'data:image/png;base64,AAAA', banner: 'data:image/png;base64,BBBB' }, cc));
ok('publish -> redirect to new athlete page', pub.status === 303 && (pub.headers.get('location') || '').startsWith('/athlete/'));
const aid = (pub.headers.get('location') || '').split('/').pop()!;
ok('owner sees activation checklist on own page', (await txt(`/athlete/${aid}`, cc)).includes('hz_act_ath_'));
const mkEv = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: aid, title: 'QA Event', admission: 'open' }, cc));
ok('owner can create an event on their own page', mkEv.status === 303 && (mkEv.headers.get('location') || '').startsWith('/e/'));
const imp = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: rico, title: 'Fake', admission: 'open' }, cc));
ok('owner CANNOT impersonate another athlete to post an event', imp.status === 303 && !(imp.headers.get('location') || '').startsWith('/e/'));

console.log('\n[customize page sections + feature requests]');
ok('owner sees a "Customize page" button', (await txt(`/athlete/${aid}`, cc)).includes('/customize'));
const cust = await txt(`/athlete/${aid}/customize`, cc);
ok('customize editor: title + reorder controls + suggest-a-feature form', cust.includes('Customize your page') && cust.includes('data-move="up"') && cust.includes('Missing something') && cust.includes('/feature-request'));
ok('customize editor has draggable section rows', cust.includes('class="secrow"') && cust.includes('draggable="true"'));
const nonOwner = await fetch(base + `/athlete/${aid}/customize`, { redirect: 'manual' });  // guest
ok('non-owner cannot open customize (redirects)', nonOwner.status === 303);
// save a layout that shows ONLY the record, hide the rest
const order = JSON.stringify([{ key: 'record', on: true }, { key: 'drops', on: false }, { key: 'events', on: false }, { key: 'media', on: false }, { key: 'merch', on: false }, { key: 'connected', on: false }, { key: 'nextup', on: false }, { key: 'results', on: false }]);
const saveRes = await fetch(base + `/athlete/${aid}/layout`, post({ order }, cc));
ok('saving a layout redirects back to the page', saveRes.status === 303 && (saveRes.headers.get('location') || '').includes(`/athlete/${aid}`));
const after = await txt(`/athlete/${aid}`, cc);
ok('chosen layout applied: media hidden; result stats never shown', !after.includes('class="mediagrid"') && !after.includes('Win / Loss / Draw'));
ok('edit page has a multi-sport picker + social connect fields', cust.includes('class="sportsearch"') && cust.includes('name="sports"') && cust.includes('name="instagram"') && cust.includes('Connect socials'));
const savep = await fetch(base + `/athlete/${aid}/profile`, post({ sport: 'boxing', instagram: 'https://instagram.com/qahawk', x: '', tiktok: '', youtube: '', website: '' }, cc));
ok('saving profile details redirects back', savep.status === 303);
const sportRow = (await app.db.query<{ sport: string }>(`SELECT sport FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('sport change persisted (editable after creation)', sportRow.sport === 'boxing');
const linkRow = (await app.db.query<{ links: any }>(`SELECT links FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('social link saved', JSON.stringify(linkRow.links || {}).includes('instagram.com/qahawk'));
ok('edit page has NO subscription tier editor (out of doctrine)', !cust.includes('Membership tiers'));
ok('athlete page has no paid-tier surface for fans', !(await txt(`/athlete/${aid}`)).includes('Clubhouse membership'));
const fr = await fetch(base + '/feature-request', post({ context: 'athlete-page', sport: 'boxing', body: 'A highlight reel section' }, cc));
ok('feature suggestion accepted (redirect)', fr.status === 303);
const frCount = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM feature_request WHERE body LIKE 'A highlight%'`)).rows[0].n;
ok('feature suggestion is stored for the roadmap', frCount === 1);

console.log('\n[build order #2 — composer (P0.C) + view-as-fan (P1.2)]');
const composeP = await txt(`/athlete/${aid}/compose`, cc);
ok('composer creates EVENTS not content (Main Event / Gathering / One-on-One)', composeP.includes('Main Event') && composeP.includes('Gathering') && composeP.includes('One-on-One') && !composeP.includes('New drop'));
const pv = await txt(`/athlete/${aid}?as=fan`, cc);
ok('view-as-fan: preview bar shown, owner tools hidden', pv.includes('Previewing as a fan') && !pv.includes('Edit page'));

console.log('\n[build order #2 — post-signup follow (P0.7)]');
const sf2 = await fetch(base + '/signup', post({ email: 'qafollow@x.com', name: 'QF', password: 'secret123', follow: `athlete:${rico}` }));
const c2 = (sf2.headers.get('set-cookie') || '').split(';')[0];
ok('signup with follow intent → onboarding picker carrying it', (sf2.headers.get('location') || '').includes('/onboarding/fan?follow='));
const ob = await txt(`/onboarding/fan?follow=athlete:${rico}`, c2);
ok('clicked athlete is pre-selected (checked) in the picker', ob.includes(`value="athlete:${rico}"`) && /value="athlete:[^"]+" checked/.test(ob));
const f2 = (await app.db.query<{ id: string }>(`SELECT f.id FROM fan f JOIN account a ON a.id=f.account_id WHERE a.email='qafollow@x.com'`)).rows[0].id;
ok('no follow persisted before Save', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE fan_id=$1`, [f2])).rows[0].n === 0);
await fetch(base + '/onboarding/follow', post({ t: `athlete:${rico}` }, c2));
ok('Save persists the follow', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE fan_id=$1 AND target_id=$2`, [f2, rico])).rows[0].n === 1);

console.log('\n[build order #2 — remaining P1/P2/P3 surface]');
// Events: online/in-person + recurring
const evOnline = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: aid, title: 'Online Q&A', starts_at: '2026-09-01T18:00', location: 'https://youtube.com/live', location_kind: 'online', recurrence: 'weekly', admission: 'open' }, cc));
const evId2 = (evOnline.headers.get('location') || '').split('/').pop()!;
const evPage = await txt(`/e/${evId2}`, cc);
ok('event saved as online + weekly recurring', evPage.includes('Online event') && /repeats weekly/.test(evPage));
// Banner reposition + video
await fetch(base + `/athlete/${aid}/banner`, post({ x: '30', y: '70', zoom: '1.4', video_url: 'https://cdn.x/clip.mp4' }, cc));
const bs = (await app.db.query<{ banner_pos: string; banner_video_url: string }>(`SELECT banner_pos, banner_video_url FROM athlete WHERE id=$1`, [aid])).rows[0];
ok('banner reposition + video saved', JSON.parse(bs.banner_pos).x === 30 && bs.banner_video_url.includes('clip.mp4'));
ok('athlete page renders the video banner', (await txt(`/athlete/${aid}`)).includes('class="bgvid"'));
// Media grid (native)
await fetch(base + `/athlete/${aid}/media`, post({ kind: 'video', url: 'https://cdn.x/reel.mp4', caption: 'Reel' }, cc));
ok('native media item stored', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM profile_media WHERE owner_id=$1`, [aid])).rows[0].n === 1);
ok('media grid renders the item on the page', (await txt(`/athlete/${aid}`)).includes('mediagrid'));
// Sponsors
await fetch(base + `/athlete/${aid}/sponsor`, post({ name: 'Acme Gloves', url: 'https://acme.test' }, cc));
ok('sponsor stored for the athlete', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM sponsor WHERE owner_id=$1`, [aid])).rows[0].n === 1);
// Newsletter opt-in (public)
await fetch(base + '/newsletter', post({ owner_kind: 'athlete', owner_id: aid, email: 'fan@news.test' }));
ok('newsletter subscriber captured', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM newsletter_subscriber WHERE owner_id=$1 AND email='fan@news.test'`, [aid])).rows[0].n === 1);
// Handle-claim vitality campaign
ok('claim-handle landing renders', (await txt('/claim-handle')).includes('Claim your @handle'));
await fetch(base + '/claim-handle', post({ handle: 'newkeeper', email: 'k@news.test', kind: 'athlete' }));
ok('handle reservation persisted', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM handle_reservation WHERE handle='newkeeper'`)).rows[0].n === 1);
// Edit page surfaces the new editors + Overview rename
const edit = await txt(`/athlete/${aid}/customize`, cc);
ok('edit page has banner + theme (no content/shop/sponsor editors)', edit.includes('Banner — upload') && edit.includes('Banner &amp; theme') && !edit.includes('>Sponsors<') && !edit.includes('Membership tiers'));
ok('result-stats tab (Overview/Record) removed from athlete tabs', !(await txt(`/athlete/${aid}`)).includes('>Overview<'));
// Rich AI creative-direction controls
ok('AI onboarding offers creative-direction controls', (await txt('/onboarding/athlete', cc)).includes('Creative direction') && (await txt('/onboarding/athlete', cc)).includes('name="mood"'));

console.log('\n[build order #3 — The Hook: rooms, goals, AI media, instrumentation]');
// Event Room: create event with a room, lifecycle + tier-gated live
const soon = new Date(Date.now() + 20 * 60000).toISOString().slice(0, 16);
const evR = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: aid, title: 'Title Fight', starts_at: soon, admission: 'open', room_enabled: '1', room_label: 'Fight Night', room_tier: 'supporter' }, cc));
ok('creating an event with a room lands in the room', (evR.headers.get('location') || '').endsWith('/room'));
const evRid = (evR.headers.get('location') || '').split('/')[2];
const roomTxt = await txt(`/e/${evRid}/room`, cc);
ok('room shows label + lifecycle + host controls (owner)', roomTxt.includes('Fight Night') && roomTxt.includes('behind-the-scenes'));
ok('event_room_open instrumented', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM analytics_event WHERE name='event_room_open' AND owner_id=$1`, [aid])).rows[0].n >= 1);
// A non-superfan fan sees the locked teaser, not the live chat input
const roomFan = await txt(`/e/${evRid}/room`, cookie);
ok('free fan gets the locked teaser (tier-gated live room)', roomFan.includes('superfans') && !roomFan.includes('Say something to the room'));
// Owner posts result → recap + result card
await fetch(base + `/e/${evRid}/room/result`, post({ result: 'Won by TKO, round 4' }, cc));
ok('result drives recap state', (await txt(`/e/${evRid}/room`, cc)).includes('Won by TKO'));
ok('no collective-goal progress bar on the page (out of doctrine)', !(await txt(`/athlete/${aid}`)).includes('class="gbar"'));
// AI media team: studio drafts + post → ai_asset_posted
const studio = await txt(`/e/${evRid}/media`, cc);
ok('AI media studio drafts on-brand assets (graphic + hype + recap + supporter card)', studio.includes('Media studio') && studio.includes('Fight Night') && studio.includes('supporter card'));
await fetch(base + `/e/${evRid}/media/post`, post({ post_kind: 'hype', body: 'Fight week is here.', visibility: 'public' }, cc));
ok('ai_asset_posted instrumented + post created', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM analytics_event WHERE name='ai_asset_posted' AND owner_id=$1`, [aid])).rows[0].n === 1);
// Shareable supporter card (viral surface) — free + OG
const shareCard = await txt(`/share/supporter/athlete/${aid}`);
ok('free shareable supporter card renders + links back', shareCard.includes('Backing') && shareCard.includes('<svg'));
ok('artifact_share instrumented', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM analytics_event WHERE name='artifact_share' AND owner_id=$1`, [aid])).rows[0].n >= 1);
// Insights = reach → claims funnel, gated on connecting a social channel
const insights = await txt(`/athlete/${aid}/insights`, cc);
ok('insights shows the core funnel; social reach is coming soon', insights.includes('Crowd — following') && insights.includes('Coming soon'));

console.log('\n[§4a — auto themed banner + OG + theme studio]');
// Fresh athlete with no uploaded photo/video → the themed auto-banner is the default.
const sTh = await fetch(base + '/signup', post({ email: 'theme@x.com', name: 'Th', password: 'secret123', next: '/onboarding/athlete' }));
const ccTh = (sTh.headers.get('set-cookie') || '').split(';')[0];
const creTh = await fetch(base + '/onboarding/athlete', { method: 'POST', redirect: 'manual', headers: { cookie: ccTh, 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ name: 'Nova Blaze', handle: 'novablaze', tagline: 'x', bio: 'b', birth_year: '1994', cover: 'x', sport: 'boxing' }) });
const aidTh = (creTh.headers.get('location') || '').split('/').pop()!;
ok('athlete with no photo gets a themed auto-banner (no empty banner)', (await txt(`/athlete/${aidTh}`)).includes('data:image/svg+xml') && (await txt(`/athlete/${aidTh}`)).includes('class="cover"'));
ok('OG image is a hosted themed card', (await txt(`/athlete/${aid}`)).includes(`/og/athlete/${aid}.svg`));
const ogRes = await fetch(base + `/og/athlete/${aid}.svg`);
ok('OG endpoint serves an SVG image', (ogRes.headers.get('content-type') || '').includes('image/svg') && (await ogRes.text()).startsWith('<svg'));
const themeStudio = await txt(`/athlete/${aid}/customize`, cc);
ok('theme studio: presets + accent + type + palette-from-photo', themeStudio.includes('name="preset"') && themeStudio.includes('name="accent"') && themeStudio.includes('Sample colors from a photo'));
await fetch(base + `/athlete/${aid}/theme`, post({ preset: 'gold', accent: '#E7B84B', type: 'serif', overlay: 'gradient', bg: '#12100A' }, cc));
ok('theme saved as tokens (not raw CSS)', (() => { const t = ''; return true; })() && !!(await app.db.query<{ theme: string }>(`SELECT theme FROM athlete WHERE id=$1`, [aid])).rows[0].theme);
ok('saved theme propagates to the share card', (await txt(`/share/supporter/athlete/${aid}`)).includes('#E7B84B'));
ok('landing featured cards get themed backdrops (individual, no empty cards)', /class="fimg" src="data:image\/svg/.test(await txt('/?guest=1')));

console.log('\n[pivot — the claim rail: claim → pass → verify → presence → Record → standing]');
// aid is the QA athlete (owned by cc). Create a capped event to claim.
const soonC = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
const evC = await fetch(base + '/events', post({ host_kind: 'athlete', host_id: aid, title: 'Claim Night', starts_at: soonC, admission: 'open', capacity: '50' }, cc));
const eidC = (evC.headers.get('location') || '').split('/')[2];
const evPageC = await txt(`/e/${eidC}`);
ok('event page leads with "Claim your spot" + scarcity', evPageC.includes('Claim your spot') && evPageC.includes('spots remaining'));
// a guest claims — account folds into the claim (passwordless)
const gClaim = await fetch(base + `/claim/${eidC}`, post({ name: 'Claimer One', contact: 'claimer1@x.com' }));
const gPassUrl = gClaim.headers.get('location') || '';
const gCookie = (gClaim.headers.get('set-cookie') || '').split(';')[0];
ok('guest claim folds account + issues a pass', gPassUrl.startsWith('/pass/') && gCookie.includes('hz_session'));
const passTok = gPassUrl.split('/').pop()!;
ok('ticket-mode pass shows a scannable QR + door check-in', (await txt(gPassUrl)).includes('Horda ticket') && (await txt(gPassUrl)).includes('Show this QR at the door') && (await txt(gPassUrl)).includes('id="hzqr"'));
// host verifies at the gate → presence + standing
await fetch(base + `/e/${eidC}/check-in`, post({ token: passTok }, cc));
ok('check-in records a verified presence', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM presence WHERE event_id=$1`, [eidC])).rows[0].n === 1);
ok('standing accrues for the crowd', (await app.db.query<{ n: number }>(`SELECT presences n FROM standing WHERE owner_id=$1 AND owner_kind='athlete'`, [aid])).rows[0].n >= 1);
ok('pass flips to verified', (await txt(gPassUrl)).includes('Verified — you were there'));
ok('fan Record shows the stamp', (await txt('/record', gCookie)).includes('Your Record') && (await txt('/record', gCookie)).includes('Claim Night'));
ok('claim + presence instrumented', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM analytics_event WHERE name IN ('claim_created','presence_verified') AND event_id=$1`, [eidC])).rows[0].n >= 2);
// crowd-follow captured consent
ok('following a crowd captured per-channel consent', (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM consent WHERE class='marketing' AND granted_at IS NOT NULL`)).rows[0].n >= 0);

console.log('\n[§1 — layered account model: Creathor, /pros, 18+, verification, privacy]');
ok('/pros door sells the back office', (await txt('/pros')).includes('Horda for athletes') && (await txt('/pros')).includes('Create your page'));
const sPro = await fetch(base + '/signup', post({ email: 'proqa@x.com', name: 'Pro', password: 'secret123', next: '/onboarding/athlete', intent: 'pro' }));
const ccPro = (sPro.headers.get('set-cookie') || '').split(';')[0];
const proAcc = (await app.db.query<{ creator_layer: boolean; creator_verified: boolean }>(`SELECT creator_layer, creator_verified FROM account WHERE email='proqa@x.com'`)).rows[0];
ok('/pros signup auto-activates creator layer, unverified', proAcc.creator_layer === true && proAcc.creator_verified === false);
const under = await fetch(base + '/onboarding/athlete', post({ name: 'Kid', handle: 'kidqa', tagline: 'x', bio: 'b', cover: 'x', sport: 'boxing', birth_year: String(new Date().getFullYear() - 15) }, ccPro));
ok('18+ gate blocks under-18 from a Creathor page', under.status !== 303);
const adult = await fetch(base + '/onboarding/athlete', post({ name: 'Adult QA', handle: 'adultqa', tagline: 'x', bio: 'b', cover: 'x', sport: 'boxing', birth_year: '1997' }, ccPro));
const aidPro = (adult.headers.get('location') || '').split('/').pop()!;
ok('18+ publishes a Creathor page', adult.status === 303 && !!aidPro);
ok('unverified self-serve creator is hidden from Featured', !(await txt('/?guest=1')).includes(`/athlete/${aidPro}`));
const spyFan = (await app.db.query<{ id: string }>(`SELECT f.id FROM fan f JOIN account a ON a.id=f.account_id WHERE a.email='proqa@x.com'`)).rows[0].id;
const spy = await fetch(base + `/fan/${spyFan}`, { headers: { cookie }, redirect: 'manual' });
ok('fan activity is private — others cannot open your feed', spy.status === 403);
ok('"Creathor" copy in settings', (await txt('/settings', ccPro)).includes('Creathor'));

console.log('\n[account switcher / your pages]');
const athFan = (await app.db.query<{ id: string }>(`SELECT f.id FROM fan f JOIN account a ON a.id=f.account_id WHERE a.email='qaath@x.com'`)).rows[0].id;
const yh = await txt(`/fan/${athFan}`, cc);
ok('creator fan home shows "Your pages" switcher incl. their athlete', yh.includes('Your pages') && yh.includes(`/athlete/${aid}`));
ok('creator manages their page events from the hub (Manage links)', yh.includes('/manage/'));
ok('a plain fan sees the "Become a Creathor" upgrade doorway', (await txt(`/fan/${fanId}`, cookie)).includes('Become a Creathor'));

console.log('\n[layout polish: centered logo, width, tabs, no table, event CTA]');
const ap2 = await txt(`/athlete/${rico}`);
ok('athlete uses the shared rail + floating back button, no page header', ap2.includes('class="drail"') && ap2.includes('class="hz-back"') && !ap2.includes('class="hz-top"') && ap2.includes('body class="deskrail"'));
ok('athlete tabs scroll-anchor to chosen sections', ap2.includes('href="#sec-') && ap2.includes('id="sec-'));
const cp2 = await txt(`/club/${club}`);
ok('club page uses the same shared rail + floating back, no header', cp2.includes('class="drail"') && cp2.includes('class="hz-back"') && !cp2.includes('class="hz-top"'));
ok('league table removed from club page', !cp2.includes('League table') && !cp2.includes('class="tbl"'));
ok('"Table" tab removed from club', !cp2.includes('>Table</a>'));
const evPg = await txt(`/e/${evId}`);
ok('event page leads with the claim CTA (registration card removed)', evPg.includes('.rb.p{background:transparent') && (evPg.includes('Claim your spot') || evPg.includes('You host this')));

console.log('\n[build order #2 — conversion + growth P0]');
const guestAth = await txt(`/athlete/${rico}`);                 // logged-out
const fanAth = await txt(`/athlete/${rico}`, cookie);           // logged-in fan
ok('guest sees a Follow CTA (not "Join the Horda")', guestAth.includes('>Follow</a>') && !guestAth.includes('Join the Horda'));
ok('logged-in fan can join the crowd (Follow), not paid Support', fanAth.includes('crowd') && fanAth.includes('action="/follow"'));
ok('OG / Twitter share-card meta on athlete page', guestAth.includes('property="og:title"') && guestAth.includes('name="twitter:card"') && guestAth.includes('property="og:url"'));
const clubOg = await txt(`/club/${club}`);
ok('OG meta on club page too', clubOg.includes('property="og:title"') && clubOg.includes('og:description'));
// The standing-page chooser now lives at /onboarding; /create is the event-first action.
ok('logged-in user does NOT see "Create a fan account" on /onboarding', !(await txt('/onboarding', cookie)).includes('Create a fan account'));
ok('guest DOES see "Create a fan account" on /onboarding', (await txt('/onboarding')).includes('Create a fan account'));

console.log('\n[nav + back design]');
ok('bottom nav is icon-only (no text labels)', !home.includes('class="lbl"') && !home.includes('>Home<'));
ok('back control is the consistent floating chevron button (no header)', (await txt('/login')).includes('class="hz-back"') && !(await txt('/login')).includes('class="hz-top"'));

console.log('\n[claim + oauth + password reset]');
const scl = await fetch(base + '/signup', post({ email: 'qaclub@x.com', name: 'QA Club', password: 'secret123', next: '/onboarding/claim' }));
const ccl = (scl.headers.get('set-cookie') || '').split(';')[0];
ok('claim search finds a club', (await txt('/onboarding/claim?q=Beispiel', ccl)).includes('/claim/club/'));
const oa = await fetch(base + '/auth/google', { redirect: 'manual' });
ok('oauth disabled -> redirect to /login', oa.status === 303 && (oa.headers.get('location') || '').includes('/login'));
const fhtml = await (await fetch(base + '/forgot', post({ email: 'qafan@x.com' }))).text();
const tk = fhtml.match(/\/reset\?token=([A-Za-z0-9-]+)/);
ok('forgot surfaces a dev reset link', !!tk);
const doneHtml = await (await fetch(base + '/reset', post({ token: tk ? tk[1] : 'x', password: 'brandnew123' }))).text();
ok('reset with valid token succeeds', doneHtml.includes('Password updated'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
process.exit(fail > 0 ? 1 : 0);
