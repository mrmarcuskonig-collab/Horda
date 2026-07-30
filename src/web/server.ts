// server.ts — a tiny zero-dependency SSR web app over the DB + engagement repo.
// Routes are thin: assemble data, render a page. Structured to lift into Next.js
// route handlers later (each handler is already a pure data->HTML function).
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { oauthProviders, authUrl as oauthAuthUrl, exchange as oauthExchange, isEnabled as oauthEnabled } from './oauth.ts';
import { renderAbout, renderAboutCreators, renderAboutFeatures, renderAboutPricing, renderChangelog, renderAboutEmbed } from './pitch.ts';
import { renderEmbedWidget, renderEmbedCode, entityHref } from './embed.ts';
import { discordUrl, hasDiscord, discordFootLink, discordBtn } from './community.ts';
import { renderImpressum, renderDatenschutz } from './legal.ts';
import { renderTerms, renderWithdrawal, TAKE_RATE_PCT } from './terms.ts';
import { feePctForPlan, DEFAULT_PLAN_ID, getPlan } from './pricing.ts';
import { lookupPlaces } from './geo.ts';
import { zonedToUtc, isValidZone, inZone, zoneLabel } from './tz.ts';
import { openDatabase, applySchema } from '../db/index.ts';
import type { Database } from '../db/index.ts';
import { getClubPage, getOrCreateSport } from '../db/repo.ts';
import {
  getAthleteProfile, getFanHome, getFollows, getUpcomingBout, getPrediction,
  followEntity, unfollowEntity, isFollowing, makePrediction, attend, getAttendance, getAffiliations, getLatestPost, setAthleteProfile, createAthlete, createPost,
  followSport, unfollowSport, followedSports, followRegion, unfollowRegion, followedRegions, searchRegions, updateFanName, updateFanHandle, handleTaken, updateAthleteIdentity,
} from '../db/engagement_repo.ts';
import {
  getBranding, setBranding, updateEntityName, getClub, getTeamsOfClub, getTeam, getRoster,
  getAssociation, getAssociationLeagues, getAssociationClubs, getNextFixtureForTeam,
} from '../db/entity_repo.ts';
import { renderEntityProfile, tableDark } from './shell.ts';
import { FAVICON_SVG } from './brand.ts';
import { buildResultShare, buildFightShare, buildWeekDrop } from '../content/index.ts';
import { createScheduledEvent, rsvp, getRsvp, getEventDetail, getGuestList, listUpcomingByHost, listProfileEvents, hostName, icsFor, approveRegistration, markPaid, featureEvent, getTicketFor, giftTicket, listTicket, getListings, buyListing, priceLabel, getOrCreateShareToken, recordShareClick, shareAttribution, addParty, listParties, claimSide, removeParty, recordPromoClick, subEvents, parentOf, partyAttribution, myParty } from '../db/events_repo.ts';
import { getTier, getTiers, setTier, joinMembership, cancelMembershipBySub, getMembership, memberCount, recordLoyalty, loyaltyScore, isSuperfan, topSuperfans, type TierLevel } from '../db/membership_repo.ts';
import { signup, verifyLogin, createSession, sessionAccount, deleteSession, deleteAllSessions, updateAccountPhone, getAccountPhone, deleteAccount, notifDisabled, setNotifPref, fanForAccount, owns, ownedEntities, grantOwnership, accountRole, setOnboarded, upsertOauthAccount, createPasswordReset, resetPassword, activateCreatorLayer, setBirthYear, accountFlags, isAdultYear, startLogin, consumeLogin, planForHost, getAccountPlan, setAccountPlan, clearPlanBySubscription, subscriptionForAccount } from '../db/auth_repo.ts';
import { getDiscover, REGIONS, searchEntities } from '../db/discover_repo.ts';
import { renderEventPage, renderCreateEvent, renderEditEvent, renderManage, renderCheckout, renderPayouts } from './events.ts';
import { updateEventFields, cancelEvent, eventAudienceFans, setEventSlug } from '../db/events_repo.ts';
import { seedDemo, type DemoIds } from './seed.ts';
import { renderIndex, renderDiscover, renderMap, renderAthletePage, renderCustomize, renderEntityEdit, renderCompose, renderFanHome, renderSignup, renderLogin, renderForgot, renderReset, renderSharePage, renderMemberWelcome, renderClaimPending, renderClaimQueue, renderOnboardFan, renderAiPrompt, renderProfilePreview, renderOnboardClaim, renderCreatorEntry, renderClaimHandle, sportsLabel, SPORT_EN_LABELS, renderSettings, renderPros, renderCreatePicker, renderCreateAge, renderMagicSent, renderFollowing, renderWelcome, sportLabel } from './pages.ts';
import { getEmailer, resetEmail, loginEmail } from './email.ts';
// `esc` is required here: the event route builds a little HTML inline for the
// Event Room CTA. It was used without being imported, which crashed /e/:id with
// "esc is not defined" for any event that had a room enabled. Guarded by a test.
import { ogMeta, esc, layout } from './layout.ts';
import { storeImage } from './storage.ts';
import { fanChecklist, athleteChecklist, entityChecklist, renderChecklist } from './activation.ts';
import { getAthleteSport, setAthleteSport, getAthleteSports, setAthleteSports, getAthleteLayout, setAthleteLayout, createFeatureRequest, getAthleteTheme, setAthleteTheme } from '../db/layout_repo.ts';
import { parseTheme, serializeTheme, autoContrast, bannerSvg, svgDataUri, THEME_PRESETS, defaultThemeForSport, renderThemeStudio, type ThemeSpec } from './theme_engine.ts';
import { listMedia, addMedia, deleteMedia, listSponsors, addSponsor, deleteSponsor, subscribeNewsletter, reserveHandle, getBannerStyle, setBannerStyle, listShopItems, addShopItem, deleteShopItem } from '../db/extras_repo.ts';
import { track, conversionRate, metricCounts, defaultRoomLabel, roomState, setRoomConfig, setResult, getRoomConfig, listRoomMessages, postRoomMessage, canSeeLiveRoom, createGoal, listGoals, activeGoalProgress, getGoal, maybeGoalSignup, trackConversion, roomPresence } from '../db/hook_repo.ts';
import { renderEventRoom, renderMediaStudio, renderInsights, goalBar } from './hook_web.ts';
import { spotsInfo, formatSpots, getClaim, createClaim, getPass, verifyPass, fanRecord, recordCount, crowdStanding, grantConsent, feedDoors, recentPresence, attendingEvents, myClaimedIn } from '../db/claim_rail_repo.ts';
import { listFormats, addFormat, formatCounts, setClaimFormat, getFormat, formatAttendees } from '../db/event_format_repo.ts';
import { listPromoCodes, createPromoCode, deletePromoCode, getPromoCode, applyPercent, recordPromoUse } from '../db/promo_code_repo.ts';
import { notify, listNotifications, unreadCount, markAllRead } from '../db/notif_repo.ts';
import { parseSeasonLines, shiftDate } from '../db/events_repo.ts';
import { renderNotifications, renderConnections, renderNotifPrefs, NOTIF_KEYS } from './pages.ts';
import { formatPicker } from './claim_web.ts';
import { requestLink, setLinkStatus, getLink, activeParents, parentsOf, childrenOf } from '../db/connection_repo.ts';
import { renderPass, renderRecord, renderCheckin, claimCta } from './claim_web.ts';
import { actionBar, shareButton } from './theme.ts';
import { normLang } from './i18n.ts';
import { resolveSportKey, cityAliases } from './localize.ts';
import { generateEventAssets, eventGraphic, supporterCard } from './mediagen.ts';
import { resolveLayout } from './sections.ts';
import { generateProfile, getModel, coverDataUri } from './profilegen.ts';
import { requestClaim, verifyByChannelCode, listClaimsForReviewer, decideClaim, officialDomain, isAdmin as accountIsAdmin, type ClaimKind } from '../db/claim_repo.ts';
import { getPayments, verifyWebhook } from './payments.ts';
import { getPayoutAccount, upsertPayoutAccount, setPayoutStatus, isPayoutsEnabled } from '../db/payouts_repo.ts';
import { changelogFeed, changelogMarkdown, rssFeed, sitemapXml, robotsTxt, llmsTxt } from './feeds.ts';
import { reportError, errorPage, healthReport } from './observe.ts';
import { createSideInvite, ensureSideInvite, sideInviteByToken, acceptSideInvite, isCoOrganizer, eventCoorganizers, coOrgParty, coOrganizedEventIds, organizedUpcoming } from '../db/coorg_repo.ts';
import { eventCardSvg } from './card.ts';
import { eventBannerSvg, normalizeBannerStyle } from './banner.ts';
import { svgToPng, inlineImage } from './raster.ts';
import { walletStatus, googleWalletUrl, buildPkpass, type PassData } from './wallet.ts';
import type { PassView } from '../db/claim_rail_repo.ts';

// Everything a wallet pass needs, from a pass the fan already holds. One place,
// so the Apple and Google passes can never describe the same ticket differently.
async function passDataFor(db: Database, p: PassView, origin: string): Promise<PassData> {
  const fanName = (await db.query<{ n: string }>(`SELECT display_name n FROM fan WHERE id=$1`, [p.fanId])).rows[0]?.n ?? 'Guest';
  return {
    token: p.token, eventTitle: p.eventTitle, hostName: p.hostKind ? await hostName(db, p.hostKind, p.hostId!) : 'Horda',
    startsAt: p.startsAt, timezone: p.timezone,
    // A wallet pass surfaces on the lock screen BY LOCATION — an online event's
    // "location" is a URL, and handing that to the OS would geolocate nonsense.
    location: p.locationKind === 'online' ? null : p.location,
    formatLabel: p.formatLabel, fanName, eventUrl: `${origin}/e/${p.eventId}`,
  };
}

// Tag each event with whether the viewer already holds a spot — the "✓ You're in"
// mark on club/team/association pages. Guests get everything false, no query.
async function withMine<T extends { id: string }>(db: Database, fanId: string | null, evs: T[]): Promise<(T & { mine: boolean })[]> {
  const mine = await myClaimedIn(db, fanId, evs.map(e => e.id));
  return evs.map(e => ({ ...e, mine: mine.has(e.id) }));
}

const payments = getPayments();
// The platform fee is derived per-organiser from their plan (see pricing.ts) — NOT
// a hardcoded constant — so pricing experiments are pure config. Today every
// organiser is on the Free plan; when Horda Plus billing lands, resolve the event
// owner's account.plan and pass it here to charge 0% for Plus.
const organiserFeePct = (planId: string = DEFAULT_PLAN_ID) => feePctForPlan(planId);

// Default UI language for a first-time visitor (no cookie yet): German for the
// DACH region, English everywhere else. Region comes from a CDN country header
// when present (Cloudflare/Render/Vercel), otherwise the browser's Accept-Language.
function defaultLangFor(headers: import('node:http').IncomingHttpHeaders): 'en' | 'de' {
  const h = (k: string) => String(headers[k] ?? '');
  const cc = (h('cf-ipcountry') || h('x-vercel-ip-country') || h('x-appengine-country') || h('x-country') || h('x-geo-country')).toUpperCase();
  if (cc === 'DE' || cc === 'AT' || cc === 'CH') return 'de';
  if (cc.length === 2 && cc !== 'XX') return 'en';           // known non-DACH country
  return /(^|[,;\s])de\b/i.test(h('accept-language')) ? 'de' : 'en';
}
const emailer = getEmailer();

const DEMO_FALLBACK = process.env.HORDA_DEMO !== '0';  // default on: usable without login
const parseCookies = (h?: string): Record<string, string> => Object.fromEntries((h ?? '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
import type { StandingDef } from '../engines/types.ts';

const FOOTBALL_TABLE: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season', config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };

const html = (res: any, body: string, code = 200) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); };
const redirect = (res: any, to: string) => { res.writeHead(303, { location: to }); res.end(); };
// JSON for the in-app typeahead endpoints. no-store: suggestions reflect who
// exists right now, and we never want a proxy holding a stale people list.
const json = (res: any, body: unknown, code = 200) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

// Env-gated Slack/Discord notifier. Sends both `text` (Slack) and `content`
// (Discord) so one URL works for either; a no-op when FEATURE_WEBHOOK_URL is unset.
// Fire-and-forget: never blocks or fails the request.
async function notifyWebhook(message: string): Promise<void> {
  const url = process.env.FEATURE_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: message, content: message }) });
  } catch { /* best-effort; a down webhook must never break the app */ }
}

async function parseForm(req: any): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}
// Fold the optional creative-direction picks into the AI description. They steer
// tone/design only — generateProfile is instructed to keep them out of the facts.
function directedDescription(f: Record<string, string>): string {
  const dir = [f.mood, f.energy, f.voice].filter(Boolean).join(', ');
  return dir ? `${f.description || ''}\n\nCreative direction (tone & design only, never facts): ${dir}.` : (f.description || '');
}
// Raw body — needed for Stripe webhook signature verification (must be the exact bytes).
async function readRaw(req: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export async function buildApp(db: Database, ids: DemoIds): Promise<Server> {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      // Health check FIRST — before session/auth, so it reflects the server's
      // real state (DB reachable + migrations at HEAD), not a rendered page.
      // Render points its health check here; a 503 fails a bad deploy loudly.
      if (path === '/healthz' || path === '/health') {
        const hr = await healthReport(db);
        res.writeHead(hr.ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(hr.body);
        return;
      }
      // --- identity: resolve the session account (demo fallback keeps it usable without login) ---
      const cookies = parseCookies(req.headers.cookie);
      // Language: an explicit cookie wins; otherwise default by region — German for
      // the DACH area (via CDN country header, else Accept-Language), English elsewhere.
      // English-only: the UI language is always English regardless of any legacy
      // hz_lang cookie or Accept-Language header. (German still works in SEARCH —
      // that's handled in the discover/map routes via localize.ts, not here.)
      const lang = 'en' as const;
      const account = (await sessionAccount(db, cookies.hz_session)) ?? (DEMO_FALLBACK ? { id: ids.demoAccountId, email: 'demo@horda.app', displayName: 'You' } : null);
      const viewer = (account ? await fanForAccount(db, account.id) : null) ?? ids.fanId;
      const viewerGuest = !account || url.searchParams.get('guest') === '1';
      // Creators (people who own a page) get the "+" create entry in the nav;
      // plain fans never see a create/publish option anywhere.
      const ownedForNav = (!viewerGuest && account) ? await ownedEntities(db, account.id) : [];
      const ownedAthleteForNav = ownedForNav.find(e => e.kind === 'athlete');
      const viewerCreateHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/compose` : undefined;
      const canEdit = (kind: string, id: string) => viewerGuest ? Promise.resolve(false) : owns(db, account?.id ?? null, kind, id);
      const adminFlag = !!account && (account.id === ids.demoAccountId ? true : await accountIsAdmin(db, account.id));
      const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0];
      const origin = process.env.HORDA_URL || `${fwdProto || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost'}`;
      // Persistent login: 90-day cookie (not session-scoped) + Secure on https, so
      // logging in actually sticks across browser restarts. HttpOnly + Lax as before.
      const secure = origin.startsWith('https://');
      const sessionCookie = (token: string) => `hz_session=${token}; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

      if (path === '/favicon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(FAVICON_SVG); return; }

      // --- auth ---
      if (req.method === 'POST' && path === '/signup') {
        // Legacy password signup created an account AND logged the user in with NO
        // email verification — the exact "new user had access right after entering
        // their email" bug. There is now ONE door: name + email → magic link. Any
        // POST here is funnelled into that flow so an unverified instant account can
        // never be created. The sport/region filter + follow + creator-intent are
        // carried on the login token and applied at verify time.
        const f = await parseForm(req);
        const email = (f.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) return html(res, renderMagicSent({ email: '', error: true, next: f.next || '' }));
        // Encode a "follow this creator after signup" intent into the post-verify
        // destination — the onboarding picker already reads ?follow=.
        let next = f.next || '';
        if (f.follow && (next === '' || next === '/' || next.startsWith('/onboarding/fan'))) {
          next = `/onboarding/fan?follow=${encodeURIComponent(f.follow)}`;
        }
        const { token, code } = await startLogin(db, email, { name: f.name || undefined, next: (next && next !== '/') ? next : undefined });
        const link = `${origin}/auth/verify?token=${token}`;
        const msg = loginEmail(link, code);
        void emailer.send({ to: email, subject: msg.subject, html: msg.html, text: msg.text }).catch(() => false);
        return html(res, renderMagicSent({ email, next, devLink: emailer.enabled ? null : link, devCode: emailer.enabled ? null : code }));
      }
      // --- passwordless sign-in (magic link + OTP) — the default, per Build Order item 1 ---
      // Enter an email → we mail a magic link + a 6-digit code. New emails create a
      // Fan account on first use; no password wall. Password login remains a fallback.
      if (req.method === 'POST' && path === '/auth/start') {
        const f = await parseForm(req);
        const email = (f.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) return html(res, renderMagicSent({ email: '', error: true, next: f.next || '' }));
        const nextDest = (f.next && f.next !== '/') ? f.next : (f.intent === 'pro' ? '/onboarding/athlete' : '');
        const { token, code } = await startLogin(db, email, { name: f.name || undefined, next: nextDest || undefined });
        const link = `${origin}/auth/verify?token=${token}`;
        const msg = loginEmail(link, code);
        // Fire the email immediately and DON'T block the response on the provider —
        // the "check your email" page renders instantly; the send happens in parallel.
        void emailer.send({ to: email, subject: msg.subject, html: msg.html, text: msg.text }).catch(() => false);
        // Dev (no email provider): surface the link + code so the flow is usable/testable.
        return html(res, renderMagicSent({ email, next: nextDest, devLink: emailer.enabled ? null : link, devCode: emailer.enabled ? null : code }));
      }
      if (path === '/auth/verify') {
        const r = await consumeLogin(db, { token: url.searchParams.get('token') || undefined });
        if (!r) return html(res, renderMagicSent({ email: '', expired: true, next: '' }));
        const token = await createSession(db, r.accountId);
        const dest = r.next || (r.isNew ? '/onboarding/fan' : '/');
        res.writeHead(303, { 'set-cookie': sessionCookie(token), location: dest }); res.end(); return;
      }
      if (req.method === 'POST' && path === '/auth/code') {
        const f = await parseForm(req);
        const r = await consumeLogin(db, { email: f.email || '', code: (f.code || '').replace(/\s/g, '') });
        if (!r) return html(res, renderMagicSent({ email: f.email || '', badCode: true, next: f.next || '' }));
        const token = await createSession(db, r.accountId);
        const dest = (f.next && f.next !== '/') ? f.next : r.next || (r.isNew ? '/onboarding/fan' : '/');
        res.writeHead(303, { 'set-cookie': sessionCookie(token), location: dest }); res.end(); return;
      }
      // --- onboarding (first-run) ---
      if (path === '/onboarding/fan') {
        if (!account) return redirect(res, '/signup');
        const sport = url.searchParams.get('sport') || undefined;
        const data = await getDiscover(db, { sport });
        const followed = await getFollows(db, viewer);
        const preselect = (url.searchParams.get('follow') || '').split(',').map(s => s.trim()).filter(Boolean);
        return html(res, renderOnboardFan({ fanId: viewer, sport, sports: data.sports, athletes: data.athletes.slice(0, 8), clubs: data.clubs.slice(0, 6), followedCount: followed.length, preselect }));
      }
      // batch-follow from the onboarding picker (persists only on Save)
      if (req.method === 'POST' && path === '/onboarding/follow') {
        if (!account) return redirect(res, '/signup');
        const picks = new URLSearchParams(await readRaw(req)).getAll('t');
        for (const p of picks) {
          const [type, id] = p.split(':');
          if ((type === 'athlete' || type === 'club' || type === 'team') && id) {
            await followEntity(db, viewer, type, id);
            await recordLoyalty(db, viewer, type, id, 'follow');
          }
        }
        return redirect(res, '/onboarding/done');
      }
      if (path === '/onboarding/done') {
        if (account) await setOnboarded(db, account.id);
        // The highest-intent moment we get: they just joined. Invite them into
        // Discord once, here — never nag again. No Discord configured → the
        // original straight-through redirect, unchanged.
        if (hasDiscord()) return html(res, renderWelcome({ fanId: viewer }));
        return redirect(res, `/fan/${viewer}`);
      }
      // AI-first athlete onboarding: describe → generate → preview → publish
      if (path === '/onboarding/athlete' && req.method !== 'POST') {
        if (!account) return redirect(res, '/signup');
        return html(res, renderAiPrompt({
          title: 'Create your athlete page', lead: 'Tell us, in your own words, what you do and the vibe you want. We’ll build it.',
          placeholder: 'e.g. I’m Rico “The Raven” Vargas, a southpaw welterweight boxer out of Kreuzberg, Berlin. 2–0, all finishes.\nHere’s my site + socials: https://ricovargas.box · https://instagram.com/ricotheraven\nVibe: dark and intense, fight-week energy.',
          generateAction: '/onboarding/athlete/generate', back: '/',
          altLink: `<p class="mut" style="margin-top:14px">A club or federation instead? <a href="/onboarding/claim" style="border-bottom:1px solid var(--b)">Claim your page</a>.</p>`,
        }));
      }
      if (req.method === 'POST' && path === '/onboarding/athlete/generate') {
        if (!account) return redirect(res, '/signup');
        const f = await parseForm(req);
        const gen = await generateProfile({ kind: 'athlete', description: directedDescription(f) }, getModel());
        return html(res, renderProfilePreview({ kind: 'athlete', gen: { ...gen, cover: coverDataUri(gen.cover) }, description: f.description || '', createAction: '/onboarding/athlete', generateAction: '/onboarding/athlete/generate' }));
      }
      if (req.method === 'POST' && path === '/onboarding/athlete') {
        if (!account) return redirect(res, '/signup');
        const f = await parseForm(req);
        // No 18+ gate on making a page — see the note on /create. Youth sport is
        // a first-class use case, not an edge case to be walled off. Age only
        // matters at the payout boundary, which Stripe enforces itself.
        const aId = await createAthlete(db, f.name || 'Athlete', (f.handle || '').replace(/^@/, '') || undefined);
        await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [account.id, aId]);
        await grantOwnership(db, account.id, 'athlete', aId);
        let aLinks: Record<string, string> = {}; try { aLinks = JSON.parse(f.links || '{}'); } catch { /* ignore */ }
        const aAvatar = await storeImage(f.avatar, 'avatars');
        // Only store an actually-uploaded banner photo; otherwise leave it empty
        // so the §4a themed auto-banner is the default (wow, and customizable).
        const aBanner = await storeImage(f.banner, 'banners');
        await setAthleteProfile(db, aId, { tagline: f.tagline || undefined, avatarUrl: aAvatar || undefined, bannerUrl: aBanner || undefined, links: Object.keys(aLinks).length ? aLinks : undefined });
        if (f.sport) await setAthleteSport(db, aId, f.sport);   // drives sport-appropriate default sections
        if (f.bio) await createPost(db, 'athlete', aId, f.bio);
        await setOnboarded(db, account.id);
        // `flags` used to be read for the (now-removed) age check; fetch it here
        // so the verified state still carries across when the page publishes.
        const pubFlags = await accountFlags(db, account.id);
        await activateCreatorLayer(db, account.id, pubFlags.creatorVerified);   // publishing = you're a Creathor
        return redirect(res, `/athlete/${aId}`);
      }
      // AI-first branding for a claimed club/federation (owner only)
      let brM;
      if ((brM = path.match(/^\/onboarding\/brand\/(club|team|association)\/([^/]+)(\/generate)?$/))) {
        if (!account) return redirect(res, '/signup');
        const kind = brM[1], id = brM[2];
        if (!(await owns(db, account.id, kind, id))) return redirect(res, `/${kind}/${id}`);
        if (req.method === 'POST' && brM[3]) {
          const f = await parseForm(req);
          const gen = await generateProfile({ kind: 'club', description: directedDescription(f) }, getModel());
          return html(res, renderProfilePreview({ kind: 'club', gen: { ...gen, cover: coverDataUri(gen.cover) }, description: f.description || '', createAction: `/onboarding/brand/${kind}/${id}`, generateAction: `/onboarding/brand/${kind}/${id}/generate`, showHandle: false }));
        }
        if (req.method === 'POST') {
          const f = await parseForm(req);
          const cur = await getBranding(db, kind, id);
          let bLinks: Record<string, string> = {}; try { bLinks = JSON.parse(f.links || '{}'); } catch { /* ignore */ }
          const bAvatar = await storeImage(f.avatar, 'avatars');
          const bBanner = await storeImage(f.banner || f.cover, 'banners');
          await setBranding(db, kind as any, id, { tagline: f.tagline || cur.tagline || undefined, links: { ...cur.links, ...bLinks }, avatarUrl: bAvatar || cur.avatarUrl || undefined, bannerUrl: bBanner || cur.bannerUrl || undefined });
          if (f.bio) await createPost(db, kind, id, f.bio);
          return redirect(res, `/${kind}/${id}`);
        }
        return html(res, renderAiPrompt({
          title: 'Set up your page', lead: 'Describe your club or federation and the look you want. We’ll generate it.',
          placeholder: 'e.g. FC Beispiel, a grassroots football club in Kreuzberg founded 1924, Kreisliga A. Proud, working-class, black-and-white. We want matchday energy.',
          generateAction: `/onboarding/brand/${kind}/${id}/generate`, back: `/${kind}/${id}`,
        }));
      }
      if (path === '/onboarding/claim') {
        if (!account) return redirect(res, '/signup');
        const q = (url.searchParams.get('q') || '').trim();
        let results: { kind: string; id: string; name: string; region: string | null }[] = [];
        if (q) {
          const like = '%' + q.toLowerCase() + '%';
          const clubs = (await db.query<any>(`SELECT id, name, region FROM club WHERE lower(name) LIKE $1 ORDER BY name LIMIT 10`, [like])).rows.map(r => ({ kind: 'club', id: r.id, name: r.name, region: r.region ?? null }));
          const assoc = (await db.query<any>(`SELECT id, name FROM association WHERE lower(name) LIKE $1 ORDER BY name LIMIT 10`, [like])).rows.map(r => ({ kind: 'association', id: r.id, name: r.name, region: null }));
          results = [...clubs, ...assoc];
        }
        return html(res, renderOnboardClaim({ q, results }));
      }
      if (req.method === 'POST' && path === '/login') {
        const f = await parseForm(req);
        const accId = await verifyLogin(db, (f.email || '').toLowerCase().trim(), f.password || '');
        if (!accId) return html(res, renderLogin(f.next || '/'), 401);
        const token = await createSession(db, accId);
        res.writeHead(303, { 'set-cookie': sessionCookie(token), location: f.next || '/' }); res.end(); return;
      }
      if (path === '/login') return html(res, renderLogin(url.searchParams.get('next') ?? '/'));
      if (path === '/logout') {
        if (cookies.hz_session) await deleteSession(db, cookies.hz_session);
        res.writeHead(303, { 'set-cookie': 'hz_session=; Path=/; Max-Age=0', location: '/' }); res.end(); return;
      }
      // --- password reset ---
      if (path === '/forgot' && req.method !== 'POST') return html(res, renderForgot(false));
      if (req.method === 'POST' && path === '/forgot') {
        const f = await parseForm(req);
        const token = await createPasswordReset(db, (f.email || '').toLowerCase().trim());
        let devLink: string | null = null;
        if (token) {
          const link = `${origin}/reset?token=${token}`;
          const msg = resetEmail(link);
          await emailer.send({ to: (f.email || '').toLowerCase().trim(), subject: msg.subject, html: msg.html, text: msg.text }).catch(() => false);
          if (!emailer.enabled) devLink = link;   // dev: surface the link since no email is sent
        }
        return html(res, renderForgot(true, devLink));   // same confirmation regardless (no enumeration)
      }
      if (path === '/reset' && req.method !== 'POST') {
        const token = url.searchParams.get('token') || '';
        return html(res, renderReset(token, { error: !token }));
      }
      if (req.method === 'POST' && path === '/reset') {
        const f = await parseForm(req);
        const okReset = await resetPassword(db, f.token || '', f.password || '');
        return html(res, renderReset(f.token || '', okReset ? { done: true } : { error: true }));
      }
      // --- social login (OAuth2) ---
      let oauthM;
      if ((oauthM = path.match(/^\/auth\/([a-z]+)$/))) {
        const p = oauthM[1];
        if (!oauthEnabled(p)) return redirect(res, '/login');
        const state = randomUUID();
        const next = url.searchParams.get('next') || '';
        res.writeHead(303, {
          'set-cookie': `hz_oauth=${state}|${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
          location: oauthAuthUrl(p, `${origin}/auth/${p}/callback`, state),
        }); res.end(); return;
      }
      if ((oauthM = path.match(/^\/auth\/([a-z]+)\/callback$/))) {
        const p = oauthM[1];
        const code = url.searchParams.get('code') || '';
        const [cstate, cnext = ''] = (cookies.hz_oauth || '').split('|');
        if (!code || !cstate || url.searchParams.get('state') !== cstate) return redirect(res, '/login');
        const profile = await oauthExchange(p, code, `${origin}/auth/${p}/callback`).catch(() => null);
        if (!profile) return redirect(res, '/login');
        const acc = await upsertOauthAccount(db, profile.email, profile.name);
        const token = await createSession(db, acc.accountId);
        const next = decodeURIComponent(cnext) || '/onboarding/fan';
        res.writeHead(303, { 'set-cookie': [sessionCookie(token), 'hz_oauth=; Path=/; Max-Age=0'], location: next || '/onboarding/fan' }); res.end(); return;
      }
      // claim verification: claiming is a REQUEST, not instant ownership.
      let claimM;
      // re-check a pending channel-code claim (claimant says they posted the code)
      if ((claimM = path.match(/^\/claim\/(athlete|club|team|association)\/([^/]+)\/verify$/)) && req.method === 'POST') {
        if (!account) return redirect(res, '/signup');
        const kind = claimM[1] as ClaimKind, id = claimM[2];
        const claim = (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE account_id=$1 AND target_kind=$2 AND target_id=$3 AND status='pending'`, [account.id, kind, id])).rows[0];
        const verified = claim ? await verifyByChannelCode(db, claim.id).catch(() => false) : false;
        const entityHref = kind === 'athlete' ? `/athlete/${id}` : `/${kind}/${id}`;
        if (verified) return redirect(res, entityHref);
        const name = (await hostName(db, kind, id)) || 'this page';
        const site = await officialDomain(db, kind, id);
        return html(res, renderClaimPending({ kind, id, name, code: (await db.query<{ channel_code: string }>(`SELECT channel_code FROM claim_request WHERE account_id=$1 AND target_kind=$2 AND target_id=$3`, [account.id, kind, id])).rows[0]?.channel_code || '', site, backHref: entityHref }));
      }
      // request a claim
      if ((claimM = path.match(/^\/claim\/(athlete|club|team|association)\/([^/]+)$/))) {
        if (!account) return redirect(res, '/signup');
        const kind = claimM[1] as ClaimKind, id = claimM[2];
        const entityHref = kind === 'athlete' ? `/athlete/${id}` : `/${kind}/${id}`;
        const r = await requestClaim(db, { id: account.id, email: account.email }, kind, id);
        if (r.status === 'verified') return redirect(res, kind === 'athlete' ? entityHref : `/onboarding/brand/${kind}/${id}`);
        const name = (await hostName(db, kind, id)) || 'this page';
        const site = await officialDomain(db, kind, id);
        return html(res, renderClaimPending({ kind, id, name, code: r.code || '', site, backHref: entityHref }));
      }
      // review queue (admin + governing-association owners)
      if (path === '/claims') {
        if (!account) return redirect(res, '/login?next=/claims');
        const claims = await listClaimsForReviewer(db, { id: account.id, email: account.email, isAdmin: adminFlag });
        return html(res, renderClaimQueue({ claims, isAdmin: adminFlag }));
      }
      let decM;
      if ((decM = path.match(/^\/claims\/([^/]+)\/decide$/)) && req.method === 'POST') {
        if (!account) return redirect(res, '/login');
        const f = await parseForm(req);
        await decideClaim(db, decM[1], { id: account.id, email: account.email, isAdmin: adminFlag }, f.decision === 'approve');
        return redirect(res, '/claims');
      }

      // loyalty: attribute points to the entity behind an action (drives earned Superfan)
      const eventHost = async (eventId: string) => (await db.query<{ host_kind: string; host_id: string }>(`SELECT host_kind, host_id FROM event WHERE id=$1`, [eventId])).rows[0];
      const loyaltyForEvent = async (fanId: string, eventId: string, kind: string) => { const h = await eventHost(eventId); if (h?.host_kind && h?.host_id) await recordLoyalty(db, fanId, h.host_kind, h.host_id, kind); };

      // Engagement writes act as the SERVER-RESOLVED fan (viewer), never a
      // form-supplied fan_id — so loyalty/follows/RSVPs can't be forged for others.
      if (req.method === 'POST' && path === '/loyalty/share') {
        const f = await parseForm(req);
        if (viewer && f.owner_kind && f.owner_id) await recordLoyalty(db, viewer, f.owner_kind, f.owner_id, 'share');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && path === '/follow') {
        const f = await parseForm(req);
        // Sports + regions live in their own stores (text keys, not uuid entities).
        if (f.target_type === 'sport') { await followSport(db, viewer, f.target_id); return redirect(res, req.headers.referer ?? '/following'); }
        if (f.target_type === 'region') { await followRegion(db, viewer, f.target_id); return redirect(res, req.headers.referer ?? '/following'); }
        await followEntity(db, viewer, f.target_type as any, f.target_id);
        await recordLoyalty(db, viewer, f.target_type, f.target_id, 'follow');
        await maybeGoalSignup(db, f.target_type, f.target_id, viewer, 'follow');
        // Joining a crowd is the consent action (§5). Channels are granular; email
        // by default here, the full per-channel opt-in lands with the comms rail.
        const consentChannels = (f.consent || 'email').split(',').map(s => s.trim()).filter(Boolean);
        if (consentChannels.length) await grantConsent(db, viewer, f.target_type, f.target_id, consentChannels, 'crowd_join');
        return redirect(res, req.headers.referer ?? `/athlete/${f.target_id}`);
      }
      if (req.method === 'POST' && path === '/predict') {
        const f = await parseForm(req);
        await makePrediction(db, viewer, f.event_id, f.pick);
        await loyaltyForEvent(viewer, f.event_id, 'predict');
        return redirect(res, req.headers.referer ?? '/');
      }
      // ---- Luma-style scheduled events ----
      if (req.method === 'POST' && path === '/rsvp') {
        const f = await parseForm(req);
        await rsvp(db, viewer, f.event_id, f.response as any);
        if (f.response === 'going') await loyaltyForEvent(viewer, f.event_id, 'rsvp');
        return redirect(res, req.headers.referer ?? `/e/${f.event_id}`);
      }
      if (req.method === 'POST' && path === '/events') {
        const f = await parseForm(req);
        // only the entity's owner may schedule events for it (no impersonation)
        if (viewerGuest) return redirect(res, '/signup');
        if (!await owns(db, account?.id ?? null, f.host_kind, f.host_id)) return redirect(res, `/${f.host_kind === 'athlete' ? 'athlete' : f.host_kind}/${f.host_id}`);
        const streams: any = {};
        if (f.youtube) streams.youtube = f.youtube;
        if (f.twitch) streams.twitch = f.twitch;
        if (f.instagram) streams.instagram = f.instagram;
        if (f.tiktok) streams.tiktok = f.tiktok;
        if (f.discord) streams.discord = f.discord;
        const coverUrl = (await storeImage(f.cover, 'events')) || undefined;

        // WAYS IN. The form defines one block per door (in person / stream);
        // each becomes an event_format and the FAN picks one at claim time.
        // v80 modelled this as a single event-wide radio, which made hybrid
        // impossible: you could say "in person and streamed" and then only offer
        // one way to actually attend. admission + access_mode are event-level
        // legacy columns, so they're DERIVED from the doors rather than asked.
        const toCents2 = (x?: string) => { const v = parseFloat(String(x || '').replace(',', '.')); return isFinite(v) && v > 0 ? Math.round(v * 100) : null; };
        const where = ['in_person', 'online', 'hybrid'].includes(f.location_kind) ? f.location_kind : 'in_person';
        // Where constrains which doors may exist, regardless of what was posted.
        const wantIp = f.fmt_inperson === '1' && where !== 'online';
        // A posted stream URL IS intent to have a stream door, with or without the
        // checkbox — callers that predate the checkbox just send the link. And an
        // explicit link beats our inference from `where`: "in person" + a stream
        // link is a hybrid event however it was labelled.
        const wantSt = (f.fmt_stream === '1' && where !== 'in_person') || !!(f.fmt_stream1_url || '').trim();
        // A price IS the paid signal. Requiring the radio too would silently make
        // a priced door free for every caller that just sends an amount.
        const ipPaid = f.ip_cost === 'paid' || !!toCents2(f.fmt_inperson_price);
        const stCost = ['free', 'paid', 'open'].includes(f.st_cost) ? f.st_cost : 'free';

        // A caller that posted NO door fields at all predates this model (the
        // sub-event flow, scripts, the old form). Honour what it DID post rather
        // than overriding it with a derivation of nothing — same principle as
        // capacity_limited: never discard an explicit instruction just because
        // the shape of the form changed underneath it.
        const postedDoors = f.fmt_inperson !== undefined || f.fmt_stream !== undefined;
        const ways: { kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; capacity: number | null; maxPerPerson: number }[] = [];
        if (wantIp) ways.push({
          kind: 'in_person', label: 'In person', channelUrl: null,
          requiresTicket: ipPaid && !!toCents2(f.fmt_inperson_price),
          priceCents: ipPaid ? toCents2(f.fmt_inperson_price) : null,
          capacity: f.fmt_inperson_cap ? Number(f.fmt_inperson_cap) : null,
          maxPerPerson: Math.max(1, Math.min(50, Number(f.fmt_inperson_maxpp) || 1)),
        });
        if (wantSt) ways.push({
          kind: 'stream', label: (f.fmt_stream1_label || '').trim() || 'Watch online',
          channelUrl: (f.fmt_stream1_url || '').trim() || null,
          requiresTicket: stCost === 'paid' && !!toCents2(f.fmt_stream1_price),
          priceCents: stCost === 'paid' ? toCents2(f.fmt_stream1_price) : null,
          // Streams have real caps too (a webinar licence, a Zoom room). The
          // organiser decides — this used to be hardcoded to unlimited, which
          // was us making their decision for them. 'open to all' means nobody
          // claims, so there is nothing to count and a cap is meaningless.
          capacity: (stCost !== 'open' && f.fmt_stream1_cap) ? Number(f.fmt_stream1_cap) : null,
          // One person, one stream seat — and this one IS ours to decide: a
          // stream seat unlocks the link FOR THE CLAIMER. Buying three wouldn't
          // give three people access, because the other two have no claim and no
          // link. Each viewer claims their own seat, which is also the only way
          // we learn who watched.
          maxPerPerson: 1,
        });
        // NOTE: a caller that posted no doors gets NO formats — deliberately.
        // It then renders the single-button claim CTA, which is the behaviour
        // those callers (sub-events, scripts) have always had. Minting a door for
        // them would silently switch them to the picker and change their wording.
        // Extra platforms — the same broadcast also on Twitch, TikTok, YouTube…
        // Each is a free "Watch on …" door the fan can pick. Added only when the
        // watch-online way is on and a URL was actually given.
        for (const n of ['2', '3'] as const) {
          const su = (f[`fmt_stream${n}_url`] || '').trim();
          if (wantSt && su) ways.push({
            kind: 'stream', label: (f[`fmt_stream${n}_label`] || '').trim() || 'Also streaming',
            channelUrl: su, requiresTicket: false, priceCents: null, capacity: null, maxPerPerson: 1,
          });
        }

        // Derive the event-level columns from the doors:
        //  paid if ANY door costs money · approval wins over everything ·
        //  otherwise you register (we learn who came) unless the only door is an
        //  open stream, where by definition we learn nothing.
        const anyPaid = ways.some(w => w.requiresTicket && (w.priceCents ?? 0) > 0);
        const onlyOpenStream = !wantIp && wantSt && stCost === 'open';
        const gi = postedDoors
          ? {
              admission: anyPaid ? 'paid' : onlyOpenStream ? 'open' : 'register',
              // in-person → a scannable QR ticket. Online only → the claim
              // unlocks the link, unless the stream is open to all.
              access: wantIp ? 'ticket' : (onlyOpenStream ? 'public' : 'link'),
            }
          : { admission: (f.admission as string) || 'open', access: f.access_mode as string };

        // Sport: the `sport` TABLE is a registry that only held the sports the
        // demo seeded, so a plain lookup silently returned null for HYROX — the
        // event existed but no sport filter could find it. getOrCreateSport makes
        // the registry self-populating: the first person to host a HYROX event
        // puts HYROX on the map, chips included. 'other' = deliberately no sport.
        const sportId = (f.sport && f.sport !== 'other')
          ? await getOrCreateSport(db, f.sport, sportLabel(f.sport))
          : undefined;

        // Approval composes with any of the above — it used to be a fourth,
        // mutually-exclusive admission value, so "paid AND approved" was unsayable.
        const approval = f.approval_required === '1';
        const admission = approval ? 'apply' : (gi?.admission ?? (f.admission as any) ?? 'open');
        const accessMode = gi?.access ?? f.access_mode;
        // Capacity: NULL = unlimited, and that's the default.
        //   field '1'      → the organiser opted into a limit
        //   field '0'      → they explicitly chose unlimited; ignore any stale number
        //   field ABSENT   → a caller that predates the toggle (the old form, the
        //                    sub-event flow, scripts): honour a posted capacity
        //                    rather than silently dropping it. Never discard an
        //                    explicit instruction just because a checkbox is new.
        const capLimited = f.capacity_limited === undefined ? !!f.capacity : f.capacity_limited === '1';
        const capacity = capLimited && f.capacity ? Number(f.capacity) : undefined;

        // The posted time is WALL-CLOCK in the organiser's zone. Resolve it to a
        // true instant HERE — handing the naive string to ::timestamptz made
        // Postgres resolve it in the SERVER's zone, which is how the calendar
        // export ended up an hour out. Unknown zone → previous behaviour, so
        // nothing already scheduled silently shifts.
        const evTz = isValidZone(f.timezone) ? f.timezone : null;
        const startsAtUtc = f.starts_at
          ? (evTz ? zonedToUtc(f.starts_at, evTz).toISOString() : f.starts_at)
          : new Date().toISOString();

        // Online-only events no longer collect a venue; the join link lives on the
        // stream door. Mirror it into `location` so the online watch link still works.
        const locationVal = (postedDoors && !wantIp && wantSt && !(f.location || '').trim())
          ? (f.fmt_stream1_url || '').trim()
          : f.location;
        const baseArgs = {
          hostKind: f.host_kind as any, hostId: f.host_id, title: f.title || 'Untitled event',
          startsAt: startsAtUtc, timezone: evTz, location: locationVal, description: f.description,
          coverUrl, admission: admission as any,
          // Event-level price mirrors the cheapest paid door. For a caller that
          // posted no doors, fall back to its own `price` field.
          priceCents: postedDoors
            ? ((ways.find(w => w.requiresTicket && (w.priceCents ?? 0) > 0)?.priceCents) ?? undefined)
            : (f.price ? Math.round(Number(String(f.price).replace(',', '.')) * 100) : undefined),
          streams,
          capacity,
          // Derive from the doors the organiser ACTUALLY opened, not the "Where"
          // dropdown — a mismatch there is why an in-person+online event could
          // show as online-only. Both doors → hybrid; stream only → online.
          locationKind: postedDoors ? (wantIp && wantSt ? 'hybrid' : wantSt ? 'online' : 'in_person') : f.location_kind,
          accessMode,
          archetype: ['single', 'versus', 'multi'].includes(f.archetype) ? f.archetype : 'single',
          visibility: f.visibility === 'unlisted' ? 'unlisted' : 'public',
          waitlistEnabled: capLimited && f.waitlist_enabled === '1',
          approvalRequired: approval,
          bannerStyle: f.banner_style ? normalizeBannerStyle(f.banner_style) : null,
          sportId,
        };
        // `ways` (built above from the door blocks) IS the format list — this
        // used to be a SECOND, parallel derivation from the same fields, which
        // is how the price on the in-person block and the event price could
        // disagree. One source, one meaning.
        const applyFormats = async (evId: string) => { let i = 0; for (const w of ways) await addFormat(db, { eventId: evId, sort: i++, ...w }); };

        const parentId = (f.parent_id || '').trim() || undefined;
        // SAME-DAY RULE: a bout / sub-event happens on the main event's day. A
        // multi-day event is modelled as separate main events (Day 1, Day 2, …),
        // not one event with sub-events across days. So when creating a sub-event
        // we keep its time-of-day but force its DATE onto the parent's date.
        let subArgs = baseArgs;
        if (parentId) {
          const parent = await getEventDetail(db, parentId).catch(() => null);
          if (parent) {
            // SUB-EVENT PRICING: for now sub-events can't be priced separately — one
            // ticket covers the whole event, so a sub inherits the parent's price and
            // admission. (The organiser's per-door inputs on the sub are ignored.)
            subArgs = { ...baseArgs, admission: parent.admission as any, priceCents: parent.priceCents ?? undefined };
            // SAME-DAY RULE: keep the sub's time-of-day but force its DATE onto the
            // parent's day (a multi-day event is separate main events, not subs).
            if (baseArgs.startsAt && parent.startsAt) {
              const parentDay = new Date(parent.startsAt as any).toISOString().slice(0, 10);  // YYYY-MM-DD
              const childTime = new Date(baseArgs.startsAt as any).toISOString().slice(10);    // Thh:mm:ss.sssZ
              subArgs = { ...subArgs, startsAt: parentDay + childTime };
            }
          }
        }
        const id = await createScheduledEvent(db, { ...subArgs, recurrence: f.recurrence, parentEventId: parentId });
        await applyFormats(id);
        // Custom URL at creation — free for everyone, top-level events only.
        if (!parentId && typeof f.slug === 'string' && f.slug.trim()) {
          await setEventSlug(db, id, f.slug).catch(() => {});   // a taken/invalid slug just doesn't apply; the event is still created
        }
        // Multi-party spine. In a VERSUS event the organising account IS a competitor,
        // so it takes Side A directly — we do NOT also mint a separate "Organiser"
        // party (that duplicate is what put the host "on top as organiser" above the
        // matchup). For single/open and multi events the host isn't a side, so it gets
        // the organiser party. Whoever is Side A must be the account that organised the
        // event; to put a different Side A on top, that side organises it themselves.
        // Every party auto-gets a promo link. Measurement only — no money moves.
        if (baseArgs.archetype !== 'versus')
          await addParty(db, { eventId: id, role: 'organizer', entityKind: f.host_kind, entityId: f.host_id, status: 'accepted' });
        // Side B / roster: if the organiser picked a REAL entity from the
        // typeahead, link it (kind+id) instead of minting a placeholder — a
        // duplicate ghost would strand that side's attribution. Free text still
        // works and stays 'unclaimed': listing rivals who aren't here yet is the
        // growth loop, not an error case.
        const ENT_KINDS = ['athlete', 'club', 'team', 'association'];
        const pickedEntity = (kind?: string, eid?: string) =>
          kind && eid && ENT_KINDS.includes(kind) && /^[0-9a-f-]{36}$/i.test(eid) ? { kind, id: eid } : null;

        if (baseArgs.archetype === 'versus') {
          await addParty(db, { eventId: id, role: 'side', side: 'A', entityKind: f.host_kind, entityId: f.host_id, status: 'accepted' });
          const sideB = (f.side_b_name || '').trim();
          const bEnt = pickedEntity(f.side_b_kind, f.side_b_id);
          if (bEnt) {
            // Real entity → they own this side. Still 'invited', not 'accepted':
            // being named in someone else's event isn't consent to appear in it.
            await addParty(db, { eventId: id, role: 'side', side: 'B', entityKind: bEnt.kind, entityId: bEnt.id, status: 'invited' });
          } else if (sideB) {
            await addParty(db, { eventId: id, role: 'side', side: 'B', placeholder: sideB, status: 'unclaimed' });
          }
        }
        // roster_ids is positionally aligned with roster names; '' = free text.
        const rosterNames = (f.roster || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
        const rosterIds = (f.roster_ids || '').split(',').map(s => s.trim());
        for (let i = 0; i < rosterNames.length; i++) {
          const [rk, rid] = (rosterIds[i] || '').split(':');
          const ent = pickedEntity(rk, rid);
          await addParty(db, ent
            ? { eventId: id, role: 'attending_athlete', entityKind: ent.kind, entityId: ent.id, status: 'invited' }
            : { eventId: id, role: 'attending_athlete', placeholder: rosterNames[i], status: 'unclaimed' });
        }
        // Event Room config (Build Order #3) — extends the event, no parallel system.
        if (f.room_enabled === '1') {
          const sport = f.host_kind === 'athlete' ? await getAthleteSport(db, f.host_id) : null;
          await setRoomConfig(db, id, { enabled: true, label: (f.room_label || '').trim() || defaultRoomLabel(sport), tier: 'public' });
          await track(db, 'event_room_open', { ownerKind: f.host_kind, ownerId: f.host_id, eventId: id, props: { tier: 'public' } });
        }
        // Recurrence: auto-create the repeat series (weekly/monthly × N), formats cloned.
        const recur = f.recurrence === 'weekly' || f.recurrence === 'monthly' ? f.recurrence : null;
        const count = Math.min(52, Math.max(1, Number(f.recurrence_count) || 1));
        let made = 0;
        if (recur && count > 1) {
          for (let n = 1; n < count; n++) {
            const sid = await createScheduledEvent(db, { ...baseArgs, startsAt: shiftDate(baseArgs.startsAt, recur, n), recurrence: 'none' });
            await applyFormats(sid); made++;
          }
        }
        // Season schedule: one event per pasted fixture line, formats cloned.
        const season = parseSeasonLines(f.season_schedule || '', baseArgs.title);
        for (const fx of season) {
          const sid = await createScheduledEvent(db, { ...baseArgs, title: fx.title, startsAt: fx.startsAt, location: fx.location ?? baseArgs.location, recurrence: 'none' });
          await applyFormats(sid); made++;
        }
        if (made > 0) {
          const ownerFan = await fanForAccount(db, account!.id);
          if (ownerFan) await notify(db, { fanId: ownerFan, kind: 'season_created', headline: `${made + 1} events created — your series is live.`, href: `/e/${id}`, eventId: id });
        }
        return redirect(res, f.room_enabled === '1' ? `/e/${id}/room` : parentId ? `/e/${parentId}` : `/e/${id}`);
      }
      // REMOVED (28 Jul 2026): the fan → athlete paid-subscription system
      // (Supporter/Clubhouse tiers, Superfan status). Horda's one monetization
      // model is now: free to run events, Horda Plus for organisers (0% fee).
      // The /join, /member and /athlete/:id/tiers routes are gone; the DB tables
      // (membership, membership_tier, loyalty_event) are left dormant, unused.
      if (req.method === 'POST' && path === '/join') {
        return html(res, '<p>Fan memberships have been retired. <a href="/">Back to Horda</a></p>', 410);
      }
      // /ticket/gift · /ticket/list · /ticket/buy — REMOVED, not hidden.
      //
      // These were live routes with no UI left pointing at them. That is worse
      // than a visible feature: an unlinked POST endpoint is still an endpoint,
      // and these took a ticket_id from the form and NEVER CHECKED THE CALLER
      // OWNED IT — anyone who could guess an id could gift away someone else's
      // ticket, or list it for sale.
      //
      // They also sold a bearer ticket: hand the row to a new holder, leave the
      // old QR live. The AGB says tickets are personengebunden and resale is not
      // offered; these three routes contradicted both.
      //
      // The replacement (void + reissue + ledger, ownership checked, price capped
      // at face value) is src/db/transfer_repo.ts, and it is switched off. When
      // resale is a decision rather than an accident, wire THAT — don't restore
      // these.
      if (req.method === 'POST' && /^\/ticket\/(gift|list|buy)$/.test(path)) {
        return html(res, '<p>Tickets on Horda are personal and non-transferable. <a href="/agb">Why</a></p>', 404);
      }
      let mm;
      // /member/... retired with the fan-membership system → send them to the page.
      if ((mm = path.match(/^\/member\/(athlete|club|team|association)\/([^/]+)$/))) {
        const href = mm[1] === 'athlete' ? `/athlete/${mm[2]}` : mm[1] === 'team' ? `/team/${mm[2]}` : mm[1] === 'association' ? `/association/${mm[2]}` : `/club/${mm[2]}`;
        return redirect(res, href);
      }
      if (req.method === 'POST' && path === '/feature') {
        const f = await parseForm(req);
        // only the owner of the entity being featured-on may cross-post
        if (!await owns(db, account?.id ?? null, f.feat_kind, f.feat_id)) return redirect(res, req.headers.referer ?? `/e/${f.event_id}`);
        await featureEvent(db, f.feat_kind, f.feat_id, f.event_id);
        return redirect(res, req.headers.referer ?? `/e/${f.event_id}`);
      }
      // --- Stripe Connect: organizer payout onboarding (Build Order item 4) ---
      // The gate for paid ticketing. Owner-only. Creates (once) an Express account,
      // then sends them to Stripe's hosted KYC/onboarding. Web-first, no app stores.
      let payM;
      if (req.method === 'POST' && (payM = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/connect$/))) {
        if (!await owns(db, account?.id ?? null, payM[1], payM[2])) return redirect(res, `/e`);
        let acct = await getPayoutAccount(db, payM[1], payM[2]);
        if (!acct?.stripeAccountId) {
          const created = await payments.createConnectAccount({ email: account?.email });
          await upsertPayoutAccount(db, payM[1], payM[2], created.accountId);
          acct = await getPayoutAccount(db, payM[1], payM[2]);
        }
        const ret = `${origin}/host/${payM[1]}/${payM[2]}/connect/return`;
        const { url } = await payments.accountLink({ accountId: acct!.stripeAccountId!, refreshUrl: ret, returnUrl: ret });
        // Stub (no Stripe key) returns immediately-enabled; sync status now so the
        // dev/demo flow flips to "connected" without a real round-trip.
        if (!payments.enabled) { const st = await payments.getAccount(acct!.stripeAccountId!); await setPayoutStatus(db, payM[1], payM[2], st ?? { chargesEnabled: false, payoutsEnabled: false }); }
        return redirect(res, url);
      }
      if (payM = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/connect\/return$/)) {
        const acct = await getPayoutAccount(db, payM[1], payM[2]);
        if (acct?.stripeAccountId) { const st = await payments.getAccount(acct.stripeAccountId).catch(() => null); if (st) await setPayoutStatus(db, payM[1], payM[2], st); }
        return redirect(res, `/manage-payouts/${payM[1]}/${payM[2]}`);
      }
      if (payM = path.match(/^\/manage-payouts\/(athlete|club|team|association)\/([^/]+)$/)) {
        if (!await owns(db, account?.id ?? null, payM[1], payM[2])) return redirect(res, `/${payM[1]}/${payM[2]}`);
        const acct = await getPayoutAccount(db, payM[1], payM[2]);
        return html(res, renderPayouts({ hostKind: payM[1], hostId: payM[2], hostName: await hostName(db, payM[1], payM[2]), connected: !!acct?.chargesEnabled, payoutsEnabled: !!acct?.payoutsEnabled, started: !!acct?.stripeAccountId, live: payments.enabled }));
      }
      let cm;
      if (req.method === 'POST' && (cm = path.match(/^\/e\/([^/]+)\/pay$/))) {
        const f = await parseForm(req);
        const evId = cm[1];
        const d = await getEventDetail(db, evId);
        // Paid ticketing gate: with real Stripe on, the organizer must have connected
        // payouts (KYC) before we collect money. Free events + dev/stub are ungated.
        const connected = (d?.hostKind && d?.hostId) ? await isPayoutsEnabled(db, d.hostKind, d.hostId) : false;
        if (payments.enabled) {
          if (!connected) return redirect(res, `/e/${evId}`);   // tickets not on sale until payouts connected
          const organiserPlan = await planForHost(db, d?.hostKind ?? null, d?.hostId ?? null);
          const feeCents = Math.round((d?.priceCents ?? 0) * organiserFeePct(organiserPlan) / 100);
          const acct = (d?.hostKind && d?.hostId) ? await getPayoutAccount(db, d.hostKind, d.hostId) : null;
          const { url } = await payments.createCheckout({
            mode: 'payment', amountCents: d?.priceCents ?? 0, currency: d?.currency || 'EUR',
            productName: `Ticket · ${d?.title ?? 'Event'}`,
            successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/e/${evId}`,
            metadata: { kind: 'ticket', event_id: evId, fan_id: viewer },
            applicationFeeCents: feeCents,
            destinationAccount: acct?.stripeAccountId ?? undefined,
          });
          return redirect(res, url);
        }
        await markPaid(db, evId, viewer);
        await loyaltyForEvent(viewer, evId, 'attend');
        return redirect(res, `/e/${evId}`);
      }
      // Stripe webhook — source of truth for granting/revoking (works even if the
      // buyer closes the tab; also delivers subscription cancellations). Verifies
      // the signature against STRIPE_WEBHOOK_SECRET before trusting anything.
      if (req.method === 'POST' && path === '/stripe/webhook') {
        const raw = await readRaw(req);
        const event = verifyWebhook(raw, req.headers['stripe-signature'] as string | undefined, process.env.STRIPE_WEBHOOK_SECRET);
        if (!event) { res.writeHead(400); res.end('invalid signature'); return; }
        try {
          if (event.type === 'checkout.session.completed') {
            const s = event.data?.object ?? {};
            const m = (s.metadata ?? {}) as Record<string, string>;
            const subId = typeof s.subscription === 'string' ? s.subscription : (s.subscription?.id ?? null);
            if (m.kind === 'ticket' && m.event_id && m.fan_id) { await markPaid(db, m.event_id, m.fan_id); await loyaltyForEvent(m.fan_id, m.event_id, 'attend'); }
            else if (m.kind === 'plus' && m.account_id) { await setAccountPlan(db, m.account_id, 'plus', subId); }
          } else if (event.type === 'customer.subscription.deleted') {
            const sub = event.data?.object ?? {};
            // The only subscription Horda sells now is Horda Plus — downgrade to Free.
            if (sub.id) await clearPlanBySubscription(db, sub.id);
          }
        } catch { /* never 500 to Stripe — it would retry forever; we logged-and-acked */ }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"received":true}'); return;
      }
      // Stripe Checkout return — verify the session, then grant access (idempotent).
      // Belt-and-suspenders with the webhook above so access is instant on redirect.
      if (path === '/checkout/success') {
        const sid = url.searchParams.get('session_id');
        const sess = sid ? await payments.retrieve(sid).catch(() => null) : null;
        if (sess?.paid) {
          const m = sess.metadata;
          if (m.kind === 'ticket' && m.event_id && m.fan_id) { await markPaid(db, m.event_id, m.fan_id); await loyaltyForEvent(m.fan_id, m.event_id, 'attend'); return redirect(res, `/e/${m.event_id}`); }
          if (m.kind === 'plus' && m.account_id) { await setAccountPlan(db, m.account_id, 'plus', sess.subscriptionId); return redirect(res, '/settings?upgraded=1'); }
        }
        return redirect(res, '/');
      }
      // --- Horda Plus subscription (organiser upgrade → 0% platform fee) --------
      if (req.method === 'POST' && path === '/plus/subscribe') {
        if (!account?.id) return redirect(res, '/signup?next=/about/pricing');
        const plus = getPlan('plus');
        if (!plus.live) return redirect(res, '/about/pricing');   // not on sale yet
        const f = await parseForm(req);
        const annual = (f.interval ?? 'annual') !== 'monthly';
        const amountCents = Math.round((annual ? plus.priceAnnual * 12 : plus.priceMonthly) * 100);
        if (payments.enabled) {
          const { url } = await payments.createCheckout({
            mode: 'subscription', amountCents, currency: plus.currency, interval: annual ? 'year' : 'month',
            productName: 'Horda Plus', successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/about/pricing`, metadata: { kind: 'plus', account_id: account.id },
          });
          return redirect(res, url);
        }
        // Dev/stub (no Stripe key): grant Plus directly so the flow is exercisable.
        await setAccountPlan(db, account.id, 'plus', 'sub_dev_' + Math.random().toString(36).slice(2, 10));
        return redirect(res, '/settings?upgraded=1');
      }
      if (req.method === 'POST' && path === '/plus/cancel') {
        if (!account?.id) return redirect(res, '/signup');
        const subId = await subscriptionForAccount(db, account.id);
        if (subId && payments.enabled) await payments.cancelSubscription(subId).catch(() => {});
        // Downgrade immediately for instant feedback; the webhook is idempotent.
        await setAccountPlan(db, account.id, 'free', null);
        await db.query(`UPDATE account SET stripe_subscription_id=NULL WHERE id=$1`, [account.id]);
        return redirect(res, '/settings?downgraded=1');
      }
      if (req.method === 'POST' && (cm = path.match(/^\/e\/([^/]+)\/approve$/))) {
        const f = await parseForm(req);
        const ev = await getEventDetail(db, cm[1]);
        if (!ev) return html(res, 'Not found', 404);
        if (!await canEdit(ev.hostKind ?? '', ev.hostId ?? '')) return redirect(res, `/e/${cm[1]}`);  // owner-only
        await approveRegistration(db, cm[1], f.fan_id);
        return redirect(res, `/manage/${cm[1]}`);
      }
      if ((cm = path.match(/^\/e\/([^/]+)\/checkout$/))) {
        const d = await getEventDetail(db, cm[1]);
        if (!d) return html(res, 'Not found', 404);
        return html(res, renderCheckout(d, viewer, payments.enabled));
      }
      let em;
      if ((em = path.match(/^\/e\/([^/]+)\/ics$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="horda-event.ics"' });
        res.end(icsFor(d)); return;
      }
      // --- the claim rail (the pivot) ---------------------------------------
      // Claim a spot. A guest supplies name + email and gets a MAGIC LINK — the
      // claim completes only after they click it (executeClaim runs at /claim/:id/
      // resume, which is a post-verify destination). No unverified instant account
      // or session is ever created — same one-door rule as /signup.
      const executeClaim = async (eid: string, d: any, claimFan: string, formatId: string | null, partySize: number, promo: string, via: string, promoCode = '') => {
        // Everything about a claim comes from the DOOR the fan chose: the price,
        // the capacity it counts against, and how many spots they may take.
        // Event-level fallback only for events with no doors (legacy, sub-events).
        let priceCents: number | null = d.admission === 'paid' ? d.priceCents : null;
        let fmtLabel = '';
        let fmtCapacity: number | null = null;
        let maxPerPerson = 1;
        const chosen = formatId ? await getFormat(db, formatId) : null;
        if (chosen) {
          priceCents = chosen.requiresTicket ? (chosen.priceCents ?? null) : null;
          fmtLabel = chosen.label;
          fmtCapacity = chosen.capacity;
          maxPerPerson = chosen.maxPerPerson;
        }
        // Promo code — an organiser discount the fan typed. Only applies to a real
        // ticket price; 100%-off makes the ticket free. Records a redemption.
        if (promoCode && priceCents && priceCents > 0) {
          const pc = await getPromoCode(db, eid, promoCode);
          if (pc) { priceCents = applyPercent(priceCents, pc.percentOff); await recordPromoUse(db, pc.id).catch(() => {}); }
        }
        const evRow = (await db.query<any>(`SELECT capacity, registration_mode FROM event WHERE id=$1`, [eid])).rows[0];
        // Attribution: a participant promo link (?p=) beats a fan share (?via=).
        const sourceEdge = promo ? `party:${promo}` : via ? `via:${via}` : 'direct';
        const cl = await createClaim(db, {
          eventId: eid, fanId: claimFan,
          capacity: chosen ? fmtCapacity : (evRow?.capacity ?? null),
          mode: evRow?.registration_mode ?? 'open',
          priceCents, sourceEdge,
          formatId: formatId || null,
          partySize: partySize || 1,
          maxPerPerson,
        });
        // One ticket covers the whole event: claiming a SUB-event also enrols you in
        // the MAIN event (free — you already paid for the sub), so BOTH show on your
        // Horda page. Claiming the MAIN grants implicit access to every sub (no sub
        // claims created), so only the main shows on your feed. Idempotent.
        if (d.parentEventId) {
          await createClaim(db, { eventId: d.parentEventId, fanId: claimFan, capacity: null, mode: 'open', priceCents: 0, sourceEdge: 'included:sub', formatId: null, partySize: 1, maxPerPerson: 1 }).catch(() => {});
        }
        await track(db, 'claim_created', { ownerKind: d.hostKind ?? undefined, ownerId: d.hostId ?? undefined, fanId: claimFan, eventId: eid, props: { status: cl.status, format: fmtLabel } });
        // Notify the organizer that someone confirmed (per-format), unless self-claim.
        if (d.hostKind && d.hostId) {
          const orgAcct = (await db.query<{ account_id: string }>(`SELECT account_id FROM ownership WHERE owner_kind=$1 AND owner_id=$2 LIMIT 1`, [d.hostKind, d.hostId])).rows[0]?.account_id
            ?? (d.hostKind === 'athlete' ? (await db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [d.hostId])).rows[0]?.account_id : null);
          const orgFan = orgAcct ? await fanForAccount(db, orgAcct) : null;
          if (orgFan && orgFan !== claimFan) {
            const who = (await db.query<{ n: string }>(`SELECT display_name n FROM fan WHERE id=$1`, [claimFan])).rows[0]?.n ?? 'Someone';
            await notify(db, { fanId: orgFan, kind: 'claim_new', headline: `${who} confirmed for ${d.title}${fmtLabel ? ` — ${fmtLabel}` : ''}.`, href: `/manage/${eid}`, eventId: eid });
          }
        }
        // Confirm back to the fan (unless waitlisted/approval-pending).
        if (cl.status === 'claimed') await notify(db, { fanId: claimFan, kind: 'claim_confirmed', headline: `You're confirmed for ${d.title}${fmtLabel ? ` — ${fmtLabel}` : ''}.`, href: `/pass/${cl.passToken}`, eventId: eid });
        return redirect(res, `/pass/${cl.passToken}`);
      };
      if (req.method === 'POST' && (em = path.match(/^\/claim\/([^/]+)$/))) {
        const eid = em[1];
        const d = await getEventDetail(db, eid);
        if (!d) return redirect(res, '/');
        if (d.cancelledAt) return redirect(res, `/e/${eid}`);   // nobody joins a cancelled event
        const f = await parseForm(req);   // parse once — carries format_id and guest fields
        const formatId = f.format_id || null;
        const partySize = Number(f[`party_size_${formatId}`] ?? f.party_size) || 1;
        const promo = url.searchParams.get('p') || '';
        const via = url.searchParams.get('via') || '';
        const promoCode = (f.promo_code || '').trim();
        if (viewerGuest) {
          // No instant account. Name + email → magic link; the claim resumes only
          // after the link is clicked. A phone number can't receive a link, so we
          // require an email here (this is the "get access without clicking the
          // link" bug, closed).
          const email = (f.contact || '').trim().toLowerCase();
          if (!f.name || !email.includes('@')) return redirect(res, `/e/${eid}`);
          const q = new URLSearchParams();
          if (formatId) q.set('format_id', formatId);
          if (partySize > 1) q.set('party_size', String(partySize));
          if (promo) q.set('p', promo);
          if (via) q.set('via', via);
          if (promoCode) q.set('pc', promoCode);
          const next = `/claim/${eid}/resume${q.toString() ? `?${q}` : ''}`;
          const { token, code } = await startLogin(db, email, { name: f.name, next });
          const link = `${origin}/auth/verify?token=${token}`;
          const msg = loginEmail(link, code);
          void emailer.send({ to: email, subject: msg.subject, html: msg.html, text: msg.text }).catch(() => false);
          return html(res, renderMagicSent({ email, next, devLink: emailer.enabled ? null : link, devCode: emailer.enabled ? null : code }));
        }
        return executeClaim(eid, d, viewer, formatId, partySize, promo, via, promoCode);
      }
      // Resume a claim after the magic link is verified. Logged-in only (you get
      // here as the post-verify destination), so it just runs executeClaim.
      if (req.method === 'GET' && (em = path.match(/^\/claim\/([^/]+)\/resume$/))) {
        const eid = em[1];
        if (viewerGuest) return redirect(res, `/e/${eid}`);
        const d = await getEventDetail(db, eid);
        if (!d) return redirect(res, '/');
        if (d.cancelledAt) return redirect(res, `/e/${eid}`);
        const formatId = url.searchParams.get('format_id') || null;
        const partySize = Number(url.searchParams.get('party_size')) || 1;
        return executeClaim(eid, d, viewer, formatId, partySize, url.searchParams.get('p') || '', url.searchParams.get('via') || '', url.searchParams.get('pc') || '');
      }
      // Apple Wallet — a signed .pkpass. 404s until the Pass Type certificate is
      // configured (Apple Developer Program, €99/yr). See src/web/wallet.ts.
      if ((em = path.match(/^\/pass\/([^/]+)\.pkpass$/))) {
        const p = await getPass(db, em[1]);
        if (!p) return html(res, 'Not found', 404);
        // The pass IS the credential — only its owner may download it. The web
        // pass at /pass/:token is already token-gated (holding the token is the
        // proof), so the same rule applies and no extra check is possible or
        // needed: a wallet pass built from a token you hold is your own ticket.
        const buf = await buildPkpass(await passDataFor(db, p, origin));
        if (!buf) return html(res, 'Apple Wallet is not configured yet.', 404);
        res.writeHead(200, { 'content-type': 'application/vnd.apple.pkpass', 'content-disposition': `attachment; filename="horda-ticket.pkpass"` });
        res.end(buf);
        return;
      }
      if ((em = path.match(/^\/pass\/([^/]+)$/))) {
        const p = await getPass(db, em[1]);
        if (!p) return html(res, '<p>Pass not found. <a href="/">Home</a></p>', 404);
        // Wallet links are computed per-request, not stored: the Google JWT is
        // time-stamped and both depend on env that can change without a deploy.
        const ws = walletStatus();
        const pd = await passDataFor(db, p, origin);
        return html(res, renderPass({
          pass: p, verifyUrl: `${origin}/pass/${em[1]}`, guest: viewerGuest, fanId: viewerGuest ? null : viewer,
          wallet: {
            google: ws.google ? googleWalletUrl(pd) : null,
            apple: ws.apple ? `/pass/${em[1]}.pkpass` : null,
          },
        }));
      }
      // Native-camera check-in: the fan's QR encodes this URL, so the organiser can
      // scan it with ANY phone camera app (no in-app QR decoder needed). Opening it as
      // the event owner checks the fan in; opening it as anyone else just shows the
      // pass (so a fan scanning their own QR can't self-check-in).
      if ((em = path.match(/^\/e\/([^/]+)\/scan\/([0-9a-fA-F]{8,})$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/pass/${em[2]}`);
        const result = await verifyPass(db, em[2], account?.id ?? null, d.locationKind === 'online' ? 'online' : 'in_room');
        if (result.ok && !result.already) await track(db, 'presence_verified', { ownerKind: d.hostKind ?? undefined, ownerId: d.hostId ?? undefined, eventId: em[1] });
        const cap0 = (await db.query<{ capacity: number | null }>(`SELECT capacity FROM event WHERE id=$1`, [em[1]])).rows[0]?.capacity ?? null;
        const spots0 = await spotsInfo(db, em[1], cap0);
        const vc0 = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM presence WHERE event_id=$1`, [em[1]])).rows[0].n;
        return html(res, renderCheckin({ eventId: em[1], title: d.title, claimed: spots0.claimed, capacity: cap0, verifiedCount: vc0, result }));
      }
      if ((em = path.match(/^\/e\/([^/]+)\/check-in$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return redirect(res, '/');
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);
        let result;
        if (req.method === 'POST') {
          const f = await parseForm(req);
          result = await verifyPass(db, (f.token || '').replace(/\s+/g, ''), account?.id ?? null, d.locationKind === 'online' ? 'online' : 'in_room');
          if (result.ok && !result.already) await track(db, 'presence_verified', { ownerKind: d.hostKind ?? undefined, ownerId: d.hostId ?? undefined, eventId: em[1] });
        }
        const cap = (await db.query<{ capacity: number | null }>(`SELECT capacity FROM event WHERE id=$1`, [em[1]])).rows[0]?.capacity ?? null;
        const spots = await spotsInfo(db, em[1], cap);
        const vcount = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM presence WHERE event_id=$1`, [em[1]])).rows[0].n;
        return html(res, renderCheckin({ eventId: em[1], title: d.title, claimed: spots.claimed, capacity: cap, verifiedCount: vcount, result }));
      }
      if (path === '/record' || path === '/me/record') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        return html(res, renderRecord({ fanId: viewer, name: account?.displayName || 'You', rows: await fanRecord(db, viewer), count: await recordCount(db, viewer) }));
      }
      if (path === '/notifications') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const items = await listNotifications(db, viewer);
        await markAllRead(db, viewer);   // opening the page clears the unread badge
        return html(res, renderNotifications({ fanId: viewer, createHref: viewerCreateHref, items }));
      }
      // Notification PREFERENCES (Luma-style) — how you get notified, per category.
      if (req.method !== 'POST' && path === '/notifications/settings') {
        if (viewerGuest || !account) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const disabled = await notifDisabled(db, account.id);
        const hasPhone = !!(await getAccountPhone(db, account.id));
        const profileHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/customize` : undefined;
        return html(res, renderNotifPrefs({ fanId: viewer, createHref: viewerCreateHref, disabled, hasPhone, profileHref, notice: url.searchParams.get('ok') || undefined }));
      }
      if (req.method === 'POST' && path === '/notifications/settings') {
        if (viewerGuest || !account) return redirect(res, '/signup');
        const f = await parseForm(req);
        // Unchecked boxes don't submit, so iterate the canonical key list.
        for (const k of NOTIF_KEYS) await setNotifPref(db, account.id, k, f[k] === 'on');
        return redirect(res, '/notifications/settings?ok=' + encodeURIComponent('Preferences saved.'));
      }
      // --- entity connections (athlete↔club↔league) --------------------------
      if ((em = path.match(/^\/(athlete|club)\/([^/]+)\/connections$/))) {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const ck = em[1], cid = em[2];
        if (!await canEdit(ck, cid)) return redirect(res, `/${ck}/${cid}`);
        const outgoing = await parentsOf(db, ck, cid);
        const incoming = ck === 'club' ? await childrenOf(db, ck, cid) : [];  // clubs receive join requests
        const q = async (t: string) => (await db.query<any>(`SELECT id, name FROM ${t} ORDER BY name LIMIT 40`)).rows;
        const clubs = ck === 'athlete' ? (await q('club')).map((r: any) => ({ kind: 'club', id: r.id, name: r.name })) : [];
        const leagues = (await q('league')).map((r: any) => ({ kind: 'league', id: r.id, name: r.name }));
        const assocs = (await q('association')).map((r: any) => ({ kind: 'association', id: r.id, name: r.name }));
        const candidates = [...clubs, ...leagues, ...assocs];
        return html(res, renderConnections({ fanId: viewer, createHref: viewerCreateHref, kind: ck, id: cid, name: await hostName(db, ck, cid), outgoing, incoming, candidates }));
      }
      if (req.method === 'POST' && path === '/connections/request') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const f = await parseForm(req);
        if (!await canEdit(f.child_kind, f.child_id)) return redirect(res, '/');
        const [pk, pid] = (f.parent || '').split(':');
        if (pk && pid) {
          await requestLink(db, { childKind: f.child_kind, childId: f.child_id, parentKind: pk, parentId: pid, requestedBy: 'child' });
          // notify the parent's owner (if any) that someone requested to join
          const pAcct = (await db.query<{ account_id: string }>(`SELECT account_id FROM ownership WHERE owner_kind=$1 AND owner_id=$2 LIMIT 1`, [pk, pid])).rows[0]?.account_id ?? null;
          const pFan = pAcct ? await fanForAccount(db, pAcct) : null;
          if (pFan) await notify(db, { fanId: pFan, kind: 'claim_new', headline: `${await hostName(db, f.child_kind, f.child_id)} requested to join ${await hostName(db, pk, pid)}.`, href: `/${pk}/${pid}/connections` });
        }
        return redirect(res, `/${f.child_kind}/${f.child_id}/connections`);
      }
      if (req.method === 'POST' && (em = path.match(/^\/connections\/link\/([^/]+)\/(admit|reject|remove)$/))) {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const link = await getLink(db, em[1]);
        if (!link) return redirect(res, '/');
        const parentOwner = await canEdit(link.parent_kind, link.parent_id);
        const childOwner = await canEdit(link.child_kind, link.child_id);
        if (em[2] === 'admit' && parentOwner) {
          await setLinkStatus(db, em[1], 'active');
          const cAcct = (await db.query<{ account_id: string }>(`SELECT account_id FROM ownership WHERE owner_kind=$1 AND owner_id=$2 LIMIT 1`, [link.child_kind, link.child_id])).rows[0]?.account_id
            ?? (link.child_kind === 'athlete' ? (await db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [link.child_id])).rows[0]?.account_id : null);
          const cFan = cAcct ? await fanForAccount(db, cAcct) : null;
          if (cFan) await notify(db, { fanId: cFan, kind: 'claim_confirmed', headline: `You're now connected to ${await hostName(db, link.parent_kind, link.parent_id)}.`, href: `/${link.child_kind}/${link.child_id}` });
        } else if (em[2] === 'reject' && parentOwner) await setLinkStatus(db, em[1], 'removed');
        else if (em[2] === 'remove' && (parentOwner || childOwner)) await setLinkStatus(db, em[1], 'removed');
        const bk = childOwner ? link.child_kind : link.parent_kind, bid = childOwner ? link.child_id : link.parent_id;
        return redirect(res, `/${bk}/${bid}/connections`);
      }
      // --- Build Order #3: Event Room ---------------------------------------
      // Build an EventBrief for the AI media + room graphic from the event + host.
      const eventBrief = async (ev: any) => {
        let name = ev.hostName || 'Host', nickname = '', sport: string | null = null;
        if (ev.hostKind === 'athlete') {
          const ap = await getAthleteProfile(db, ev.hostId);
          name = ap.name; nickname = (ap.name.match(/[‘'"]([^’'"]+)[’'"]/) ?? [])[1] ?? '';
          sport = await getAthleteSport(db, ev.hostId);
        }
        const label = (await getRoomConfig(db, ev.id))?.label || defaultRoomLabel(sport);
        return { athleteName: name, nickname, sport, label, title: ev.title, opponent: null, date: ev.date ?? null, location: ev.location ?? null, result: ev.result ?? null };
      };
      if ((em = path.match(/^\/e\/([^/]+)\/room$/))) {
        const d = await getEventDetail(db, em[1]);
        const rc = await getRoomConfig(db, em[1]);
        if (!d || !rc || !rc.enabled) return redirect(res, `/e/${em[1]}`);
        const isOwner = await canEdit(d.hostKind ?? '', d.hostId ?? '');
        const state = roomState(rc);
        const canLive = true;   // event room is open — fan-tier gating retired
        if (state === 'live' && !viewerGuest && !isOwner && canLive) {
          await track(db, 'room_live_view', { ownerKind: d.hostKind ?? undefined, ownerId: d.hostId ?? undefined, fanId: viewer, eventId: em[1] });
          // next-event return: this fan was in a prior room of the same host
          const prior = (await db.query(`SELECT 1 FROM room_message rm JOIN event e ON e.id=rm.event_id WHERE rm.fan_id=$1 AND e.host_kind=$2 AND e.host_id=$3 AND rm.event_id<>$4 LIMIT 1`, [viewer, d.hostKind, d.hostId, em[1]])).rows[0];
          if (prior) await track(db, 'next_event_return', { ownerKind: d.hostKind ?? undefined, ownerId: d.hostId ?? undefined, fanId: viewer, eventId: em[1] });
        }
        const brief = await eventBrief(d);
        const goals = d.hostKind ? await activeGoalProgress(db, d.hostKind, d.hostId!) : [];
        const athleteHref = d.hostKind === 'athlete' ? `/athlete/${d.hostId}` : `/${d.hostKind}/${d.hostId}`;
        return html(res, renderEventRoom({
          eventId: em[1], title: d.title, ownerKind: d.hostKind ?? '', ownerId: d.hostId ?? '',
          label: rc.label || brief.label, state, result: rc.result, startsAt: rc.startsAt, tier: rc.tier,
          graphic: state === 'recap' && rc.result ? eventGraphic({ ...brief, result: rc.result }) : eventGraphic(brief),
          messages: await listRoomMessages(db, em[1]), canSeeLive: canLive, isOwner, guest: viewerGuest, fanId: viewerGuest ? null : viewer,
          athleteHref, goals, presence: await roomPresence(db, em[1]),
        }));
      }
      if (req.method === 'POST' && (em = path.match(/^\/e\/([^/]+)\/room\/(post|react|bts|result)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return redirect(res, '/');
        const isOwner = await canEdit(d.hostKind ?? '', d.hostId ?? '');
        const act = em[2];
        const f = await parseForm(req);
        if (act === 'bts' || act === 'result') {
          if (!isOwner) return redirect(res, `/e/${em[1]}/room`);
          if (act === 'bts') await postRoomMessage(db, em[1], { authorKind: 'athlete', fanId: null, kind: 'bts', body: f.body || '' });
          else { await setResult(db, em[1], (f.result || '').slice(0, 200)); await setRoomConfig(db, em[1], { stateOverride: 'recap' }); }
          return redirect(res, `/e/${em[1]}/room`);
        }
        // fan chat / react — server-resolved identity, tier-gated to the live room
        if (viewerGuest) return redirect(res, '/signup');
        const rc = await getRoomConfig(db, em[1]);
        const canLive = true;   // event room is open — fan-tier gating retired
        if (!canLive) return redirect(res, `${d.hostKind === 'athlete' ? `/athlete/${d.hostId}` : `/${d.hostKind}/${d.hostId}`}#join`);
        await postRoomMessage(db, em[1], { authorKind: 'fan', fanId: viewer, kind: act === 'react' ? 'reaction' : 'chat', body: act === 'react' ? (f.emoji || '🔥') : (f.body || '') });
        return redirect(res, `/e/${em[1]}/room`);
      }
      // AI media studio (owner) — draft assets; nothing posts without approval.
      if ((em = path.match(/^\/e\/([^/]+)\/media$/)) && req.method !== 'POST') {
        const d = await getEventDetail(db, em[1]);
        if (!d) return redirect(res, '/');
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);
        const rc = await getRoomConfig(db, em[1]);
        const brief = await eventBrief(d);
        const assets = await generateEventAssets({ ...brief, result: rc?.result ?? null }, getModel());
        return html(res, renderMediaStudio({ eventId: em[1], athleteId: d.hostId ?? '', hostKind: d.hostKind ?? 'athlete', title: d.title, label: rc?.label || brief.label, hasResult: !!rc?.result, assets }));
      }
      if (req.method === 'POST' && (em = path.match(/^\/e\/([^/]+)\/media\/post$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d || !d.hostKind) return redirect(res, '/');
        if (!await canEdit(d.hostKind, d.hostId!)) return redirect(res, `/e/${em[1]}`);
        const f = await parseForm(req);
        const vis = ['supporter', 'clubhouse', 'public'].includes(f.visibility) ? f.visibility : 'public';
        if ((f.body || '').trim() && (d.hostKind === 'athlete' || d.hostKind === 'club' || d.hostKind === 'team')) {
          await createPost(db, d.hostKind as any, d.hostId!, f.body.trim(), em[1], vis as any);
        }
        await track(db, 'ai_asset_posted', { ownerKind: d.hostKind, ownerId: d.hostId!, eventId: em[1], props: { kind: f.post_kind || 'post' } });
        return redirect(res, `/e/${em[1]}/room`);
      }
      // THE MATCHDAY CARD — the picture that unfurls in WhatsApp and the file the
      // OS share sheet hands to Instagram. Public and uncredentialed on purpose:
      // a crawler fetching an og:image has no cookie, and an og:image behind auth
      // simply never renders.
      //
      // It shows only what the event page already shows a logged-out visitor —
      // title, host, when, where, price. Never who is coming (fan activity is
      // private), never the watch link (that's what claiming is for).
      // The DYNAMIC event banner (the "background picture"): a designed treatment of
      // the host's own photo/logo, split left/right for a versus event. Served as SVG
      // and used as the cover FALLBACK wherever no custom cover was uploaded.
      if ((em = path.match(/^\/e\/([^/]+)\/banner\.svg$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        const avatarFor = async (kind: string | null, id: string | null): Promise<string | null> => {
          if (!kind || !id) return null;
          if (kind === 'athlete') return (await db.query<{ a: string | null }>(`SELECT avatar_url a FROM athlete WHERE id=$1`, [id])).rows[0]?.a ?? null;
          return (await db.query<{ a: string | null }>(`SELECT avatar_url a FROM entity_branding WHERE entity_type=$1 AND entity_id=$2`, [kind, id])).rows[0]?.a ?? null;
        };
        const hostAvatar = await avatarFor(d.hostKind, d.hostId);
        let opponent: { name: string; avatarUrl: string | null } | null = null;
        const versus = d.archetype === 'versus';
        if (versus) {
          // The rival is side B. Claimed → their avatar; unclaimed → a placeholder half.
          const sideB = (await listParties(db, em[1])).find(p => p.side === 'B');
          opponent = sideB ? { name: sideB.name, avatarUrl: sideB.entityId ? await avatarFor(sideB.entityKind, sideB.entityId) : null } : { name: '', avatarUrl: null };
        }
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=120' });
        res.end(eventBannerSvg({ style: d.bannerStyle, host: { name: d.hostName, avatarUrl: hostAvatar }, opponent, versus }));
        return;
      }
      // Live preview of the default banner while CREATING an event (no event row
      // exists yet). Renders from the host's own picture; ?versus=1 shows the split
      // with a placeholder opponent. Used by the create/edit form's design picker.
      if (path === '/banner/preview.svg') {
        const hk = url.searchParams.get('host_kind'), hi = url.searchParams.get('host_id');
        // Raw (may be null) — the generator auto-picks a direction from the host
        // when no explicit one is given, so there's no colour-variant to choose.
        const style = url.searchParams.get('style');
        const versus = url.searchParams.get('versus') === '1';
        let hostAvatar: string | null = null, hostNm = 'Host';
        if (hk && hi) {
          hostNm = (await hostName(db, hk, hi).catch(() => 'Host')) || 'Host';
          hostAvatar = hk === 'athlete'
            ? (await db.query<{ a: string | null }>(`SELECT avatar_url a FROM athlete WHERE id=$1`, [hi])).rows[0]?.a ?? null
            : (await db.query<{ a: string | null }>(`SELECT avatar_url a FROM entity_branding WHERE entity_type=$1 AND entity_id=$2`, [hk, hi])).rows[0]?.a ?? null;
        }
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=60' });
        res.end(eventBannerSvg({ style, host: { name: hostNm, avatarUrl: hostAvatar }, opponent: null, versus }));
        return;
      }
      if ((em = path.match(/^\/e\/([^/]+)\/card\.(png|svg)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        // Unlisted events must not have a shareable card sitting on a guessable
        // URL — "unlisted" is a promise about where this event appears.
        const vis = (await db.query<{ visibility: string }>(`SELECT visibility FROM event WHERE id=$1`, [em[1]])).rows[0];
        if (vis?.visibility === 'unlisted') return html(res, 'Not found', 404);

        const evFmts = await formatCounts(db, em[1]);
        const evCap = (await db.query<{ capacity: number | null }>(`SELECT capacity FROM event WHERE id=$1`, [em[1]])).rows[0];
        const sp = await spotsInfo(db, em[1], evCap?.capacity ?? null);
        // The card is a stranger's first look, so scarcity here is the honest
        // public number — the countdown rule (claim_web.ts) is about the viewer
        // who already holds a ticket, and a crawler never does.
        const brief = {
          title: d.title, hostName: d.hostName, startsAt: d.startsAt, timezone: d.timezone,
          location: d.location, locationKind: d.locationKind,
          priceLabel: d.admission === 'paid' ? priceLabel(d) : 'Free',
          ways: evFmts.map(f => f.kind === 'stream' ? f.label : 'In person'),
          remaining: sp.remaining, full: sp.full,
          coverUrl: d.coverUrl && /^https?:\/\//i.test(d.coverUrl) ? d.coverUrl : null,
        };
        if (em[2] === 'svg') {
          res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=300' });
          res.end(eventCardSvg(brief));
          return;
        }
        // Inline the cover before rasterising — resvg does no network I/O, and it
        // must not: this route is on the path of an unfurl, and a slow image host
        // would hold the crawler (and the socket) open.
        const inlined = await inlineImage(brief.coverUrl);
        const png = await svgToPng(eventCardSvg({ ...brief, coverUrl: inlined }));
        if (!png) {
          // Rasteriser unavailable (wrong platform, missing binary). Serve the SVG
          // rather than a 500: the <img> preview on the page still works, and the
          // crawler simply gets no card — degraded, not broken.
          res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=60' });
          res.end(eventCardSvg(brief));
          return;
        }
        // Five minutes: long enough that an unfurl storm doesn't re-render per
        // crawler, short enough that "7 left" isn't a lie for the rest of the day.
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' });
        res.end(png);
        return;
      }

      if ((em = path.match(/^\/e\/([^/]+)$/))) {
        const guest = viewerGuest;
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, '<p>Event not found. <a href="/">Home</a></p>', 404);
        em[1] = d.id;   // the param may have been a custom slug — use the uuid for all DB calls + links below
        // Attributable-share click: someone opened a fan's /e/:id?via=<token> link.
        const viaTok = url.searchParams.get('via');
        if (viaTok) await recordShareClick(db, viaTok).catch(() => {});
        // Participant promo click: /e/:id?p=<token> from a side/roster/custom link.
        const promoTok = url.searchParams.get('p');
        if (promoTok) await recordPromoClick(db, promoTok).catch(() => {});
        const myRsvp = guest ? null : await getRsvp(db, viewer, em[1]);
        const myEntities = guest ? [] : await ownedEntities(db, account?.id ?? null);
        const myTicket = guest ? null : await getTicketFor(db, em[1], viewer);
        const listings = await getListings(db, em[1]);
        const isHost = await canEdit(d.hostKind ?? '', d.hostId ?? '');
        // A co-organizer (the invited "other side") gets limited powers: add side
        // events, share a promo link — but NOT edit the main event.
        const isCoOrg = (!guest && account) ? await isCoOrganizer(db, em[1], account.id) : false;
        // The "Event Room" CTA ("… — countdown, live reactions and the host's
        // behind-the-scenes") is REMOVED from the event page. It's a leftover from
        // Build Order #3 (rooms/tiers/live chat), which the events-first pivot
        // left behind — it advertised a tier-gated live-chat product on a page
        // whose only job is: claim your spot. The room routes still exist for now,
        // just not surfaced here.
        const roomCta = '';
        // The claim rail (the pivot): the primary CTA on every event is "Claim your spot".
        const evRow = (await db.query<any>(`SELECT capacity, registration_mode, standing_threshold, visibility FROM event WHERE id=$1`, [em[1]])).rows[0];
        const spots = await spotsInfo(db, em[1], evRow?.capacity ?? null);
        // The doors, each with its OWN remaining count. Per-door because a full
        // hall must not read as "this event is full" when the stream is wide open.
        const evFormats = await formatCounts(db, em[1]);
        const claimWays = await Promise.all(evFormats.map(async w => {
          const s = await formatSpots(db, w.id, w.capacity);
          return {
            id: w.id, kind: w.kind, label: w.label, requiresTicket: w.requiresTicket,
            priceCents: w.priceCents, capacity: w.capacity, maxPerPerson: w.maxPerPerson,
            going: w.going, remaining: s.remaining, full: s.full,
          };
        }));
        const mineClaim = guest ? null : await getClaim(db, em[1], viewer);
        let minePass: { status: string; token: string } | null = null;
        if (mineClaim) { const pv = (await db.query<{ token: string }>(`SELECT token FROM pass WHERE claim_id=$1`, [mineClaim.id])).rows[0]; minePass = { status: mineClaim.status, token: pv?.token ?? '' }; }
        // Sub-event page: one ticket covers the whole event, so a viewer who holds
        // the PARENT (main) ticket is already in for this sub — no separate claim.
        const parentClaim = (!guest && d.parentEventId) ? await getClaim(db, d.parentEventId, viewer) : null;
        let parentPassTok = '';
        if (parentClaim && !mineClaim) parentPassTok = (await db.query<{ token: string }>(`SELECT token FROM pass WHERE claim_id=$1`, [parentClaim.id])).rows[0]?.token ?? '';
        const standHave = (!guest && d.hostKind) ? await crowdStanding(db, viewer, d.hostKind, d.hostId!) : 0;
        // Multi-format: if the organizer offered formats, fans pick how they'll attend.
        // (evFormats already fetched above for the door list — one query, one truth)
        const mineFormatId = mineClaim ? ((await db.query<{ format_id: string | null }>(`SELECT format_id FROM claim WHERE id=$1`, [mineClaim.id])).rows[0]?.format_id ?? null) : null;
        const claimBlock = isHost
          ? `<div class="card"><strong>You host this.</strong><div class="row" style="margin-top:8px"><a class="btn" href="/e/${em[1]}/check-in">Open check-in →</a><a class="btn ghost" href="/manage/${em[1]}">Manage &amp; attendance →</a></div></div>`
          : (parentClaim && !mineClaim)
          // Sub-event, and the viewer already holds the whole-event (parent) ticket:
          // no separate claim needed. One ticket covers everything.
          ? `<div class="card" style="border-color:var(--acc)"><strong style="color:var(--acc)">✓ You're in — your main ticket covers this.</strong> <span class="mut">You claimed the whole event, so you're set for this one too. Nothing else to do.</span>${parentPassTok ? `<div class="row" style="margin-top:8px"><a class="btn" href="/pass/${parentPassTok}">View your pass</a></div>` : ''}</div>`
          : evFormats.length
            // claimWays = the same doors, each carrying its OWN remaining count
            // and per-person limit, so the picker can show real scarcity per door
            // and offer a quantity only where the organiser allows one.
            ? formatPicker({ eventId: em[1], guest, full: spots.full, fanId: guest ? null : viewer, via: viaTok, promo: promoTok, isHost, formats: claimWays.map(w => ({ ...w, channelUrl: evFormats.find(f => f.id === w.id)?.channelUrl ?? null })), mine: minePass ? { status: minePass.status, token: minePass.token, formatId: mineFormatId } : null })
            : claimCta({ eventId: em[1], remaining: spots.remaining, full: spots.full, mine: minePass, guest, priceLabel: d.admission === 'paid' ? priceLabel(d) : 'Free', mode: evRow?.registration_mode ?? 'open', accessMode: d.accessMode, via: viaTok, promo: promoTok, standing: { have: standHave, need: evRow?.standing_threshold ?? 0 }, ways: claimWays });
        // Persistent primary-action bar (the IG/TikTok pattern) — scarcity + one tap.
        // Only reached when the viewer has NOT claimed (the minePass branch below
        // replaces it entirely), so the countdown rule holds here by construction.
        const barSub = spots.remaining == null ? (d.admission === 'paid' ? priceLabel(d) : 'Free') : (spots.full ? 'Full — join the waitlist' : `${spots.remaining} spot${spots.remaining === 1 ? '' : 's'} left${d.admission === 'paid' ? ' · ' + priceLabel(d) : ''}`);
        // The sticky bar is ONLY a shortcut, never a second claim CTA. For a fan
        // who hasn't claimed, the inline claim block IS the single "Claim your
        // spot" — a bottom bar that just scrolls to it is the duplicate the user
        // flagged. So the bar shows only where it adds something: the host's
        // check-in shortcut, or a claimed fan's "View pass".
        const stickyCta = isHost
          ? actionBar({ title: d.title, sub: `${spots.claimed} claimed`, cta: `<a class="btn" href="/e/${em[1]}/check-in">Check-in</a>` })
          : minePass
            ? actionBar({ title: "You're in", sub: minePass.status === 'waitlisted' ? 'On the waitlist' : 'Pass ready', cta: `<a class="btn" href="/pass/${minePass.token}">View pass</a>` })
            : '';
        // Past events: the door is closed. Replace the claim rail with a clear note
        // (the event still lives on host/co-host/sharer profiles under "Past").
        const ended = !!d.startsAt && Date.now() >= new Date(d.startsAt).getTime() + 3 * 3600 * 1000;
        const pastCard = `<div class="card"><strong>This event is in the past.</strong> <span class="mut">Claims are closed.${minePass ? ` You can still view your pass.` : ''}</span>${minePass ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="/pass/${minePass.token}">View your pass</a></div>` : ''}${isHost ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="/manage/${em[1]}">See who came →</a></div>` : ''}</div>`;
        // A cancelled event closes the door for everyone. Show why (the organiser's
        // message), and drop the claim rail entirely — nobody joins a cancelled event.
        const cancelledCard = `<div class="card" style="border-color:#e5484d"><strong style="color:#e5707a">This event was cancelled.</strong>${d.cancelMessage ? `<div class="mut" style="margin-top:6px">${esc(d.cancelMessage)}</div>` : ''}${isHost ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="/manage/${em[1]}">Manage</a></div>` : ''}</div>`;
        const topBlock = d.cancelledAt ? cancelledCard : (ended ? pastCard + roomCta : claimBlock + roomCta);
        const barBlock = (d.cancelledAt || ended) ? '' : stickyCta;
        // Who may see the watch/join link: host, a public event, or anyone who claimed.
        const hasAccess = isHost || d.accessMode === 'public' || !!mineClaim;
        // A logged-in fan gets a personal attributable share link for this event.
        const shareRef = guest ? null : await getOrCreateShareToken(db, em[1], viewer);
        // Host's public socials = how a fan actually reaches them (no in-app DM yet).
        let hostLinks: Record<string, string> = {};
        if (d.hostKind === 'athlete' && d.hostId) hostLinks = (await getAthleteProfile(db, d.hostId).catch(() => null))?.links ?? {};
        else if (d.hostKind && d.hostId) hostLinks = (await getBranding(db, d.hostKind, d.hostId).catch(() => null))?.links ?? {};
        // Multi-party line-up: organizers, sides, roster + sub-events + parent link.
        const parties = await listParties(db, em[1]);
        const subs = await subEvents(db, em[1]);
        const parent = d.parentEventId ? await parentOf(db, em[1]) : null;
        // Sub-event access surfacing: if the viewer holds THIS event's ticket, every
        // sub-event is covered. Otherwise mark the specific subs they claimed directly.
        const covered = !!mineClaim;
        let subsMine: string[] = [];
        if (!guest && subs.length && !covered) {
          subsMine = (await db.query<{ event_id: string }>(`SELECT event_id FROM claim WHERE fan_id=$1 AND event_id = ANY($2) AND status IN ('claimed','approved','verified') AND voided_at IS NULL`, [viewer, subs.map(s => s.id)])).rows.map(r => r.event_id);
        }
        const canClaim = !guest && myEntities.length > 0;
        // A participant sees their own promo link + draw.
        const mine = guest ? null : await myParty(db, em[1], myEntities);
        const myPromoToken = mine?.promoToken ?? null;
        const myPromoDraw = myPromoToken ? (await partyAttribution(db, em[1])).rows.find(r => r.token === myPromoToken) : undefined;
        // Emit schema.org Event JSON-LD only for a PUBLIC, LISTED, still-upcoming
        // event — so AI/search can surface it, but an unlisted or finished event
        // never leaks into a search result. going = seats sold, for availability.
        const listable = (evRow?.visibility ?? 'public') !== 'unlisted' && !ended;
        // Co-organizer read-only panel: their promo link + the event's stats +
        // their own promo draw. They can promote and watch — never edit.
        let coOrg: { promoToken: string | null; going: number; draw: { identities: number; ticketBuyers: number } | null } | null = null;
        if (isCoOrg && account) {
          const cp = await coOrgParty(db, em[1], account.id);
          const draw = cp?.promoToken ? (await partyAttribution(db, em[1])).rows.find(r => r.token === cp.promoToken) : undefined;
          coOrg = { promoToken: cp?.promoToken ?? null, going: spots.claimed, draw: draw ? { identities: draw.identities, ticketBuyers: draw.ticketBuyers } : null };
        }
        const hostFollowing = (!guest && d.hostKind && d.hostId) ? await isFollowing(db, viewer, d.hostKind, d.hostId) : false;
        return html(res, renderEventPage(d, { guest, fanId: guest ? null : viewer, isFollowing: hostFollowing, myRsvp, isHost, isCoOrg, coOrg, myEntities, myTicket, listings, extraTop: topBlock, stickyCta: barBlock, hasAccess, shareRef, hostLinks, parties, subs, covered, subsMine, parentClaimed: !!parentClaim, parent, canClaim, origin, listable, going: spots.claimed, myPromoToken, myPromoDraw: myPromoDraw ? { identities: myPromoDraw.identities, ticketBuyers: myPromoDraw.ticketBuyers } : undefined }));
      }
      // Edit an event — owner-only, safe fields (never the date).
      if ((em = path.match(/^\/e\/([^/]+)\/edit$/)) && req.method !== 'POST') {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);
        return html(res, renderEditEvent(d, viewerGuest ? null : viewer, { canCustomUrl: true, origin, error: url.searchParams.get('err') || undefined }));
      }
      if ((em = path.match(/^\/e\/([^/]+)\/edit$/)) && req.method === 'POST') {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);
        const f = await parseForm(req);
        const patch: any = { title: f.title, description: f.description ?? '' };
        if (typeof f.cover === 'string' && f.cover) patch.coverUrl = (await storeImage(f.cover, 'covers')) || undefined;
        if (typeof f.banner_style === 'string' && f.banner_style) patch.bannerStyle = normalizeBannerStyle(f.banner_style);
        if (d.locationKind === 'online') { const u = (f.stream_url || '').trim(); patch.location = u; patch.streams = { ...(d.streams as any), primary: u }; }
        else if (f.location !== undefined) patch.location = f.location;
        await updateEventFields(db, d.id, patch);
        // Custom URL — free for everyone.
        if (typeof f.slug === 'string') {
          const r = await setEventSlug(db, d.id, f.slug);
          if (!r.ok) return redirect(res, `/e/${d.id}/edit?err=${encodeURIComponent(r.error ?? 'Could not save that URL.')}`);
        }
        return redirect(res, `/manage/${d.id}`);
      }
      // Cancel an event — sets cancelled, then tells everyone with a spot / who liked it.
      if ((em = path.match(/^\/e\/([^/]+)\/cancel$/)) && req.method === 'POST') {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);
        const f = await parseForm(req);
        const msg = (f.message || '').trim() || `${d.title} has been cancelled.`;
        await cancelEvent(db, em[1], msg);
        for (const fanId of await eventAudienceFans(db, em[1])) {
          await notify(db, { fanId, kind: 'event_cancelled', headline: `Cancelled: ${d.title}. ${msg}`.slice(0, 200), href: `/e/${em[1]}`, eventId: em[1] }).catch(() => {});
        }
        return redirect(res, `/manage/${em[1]}`);
      }
      if ((em = path.match(/^\/manage\/([^/]+)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);  // guest list is owner-only
        const payoutAcct = (d.hostKind && d.hostId) ? await getPayoutAccount(db, d.hostKind, d.hostId) : null;
        return html(res, renderManage(d, await getGuestList(db, em[1]), await formatCounts(db, em[1]), await shareAttribution(db, em[1]), await partyAttribution(db, em[1]), (d.hostKind && d.hostId) ? { hostKind: d.hostKind, hostId: d.hostId, connected: !!payoutAcct?.chargesEnabled } : undefined, viewerGuest ? null : viewer, await formatAttendees(db, em[1]), await listPromoCodes(db, em[1])));
      }
      if ((em = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/new$/))) {
        const parentId = url.searchParams.get('parent');
        const pe = parentId ? await getEventDetail(db, parentId) : null;
        // Sub-events inherit the parent's details by default — same venue (same
        // day is enforced server-side). The organiser can change any of it.
        const parent = pe ? { id: pe.id, title: pe.title, location: pe.location ?? null } : undefined;
        // Pre-select the host's own sport — right ~95% of the time, one click to change.
        const hostSport = em[1] === 'athlete' ? await getAthleteSport(db, em[2]) : null;
        return html(res, renderCreateEvent(em[1], em[2], await hostName(db, em[1], em[2]), parent, hostSport, viewerGuest ? null : viewer, { canCustomUrl: true, origin }));
      }
      // Multi-party: claim an unclaimed side/roster slot (the two-sided growth loop).
      // ORGANIZER invites the other side. The other side is NOT open to whoever
      // clicks first — only the organiser mints a private invite link for a
      // specific rival. We render the link for the organiser to send.
      const pmInvite = path.match(/^\/e\/([^/]+)\/party\/([^/]+)\/invite$/);
      if (req.method === 'POST' && pmInvite) {
        const d = await getEventDetail(db, pmInvite[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${pmInvite[1]}`);  // organiser only
        const token = await ensureSideInvite(db, pmInvite[2]);
        if (!token) return redirect(res, `/e/${pmInvite[1]}`);
        const party = (await listParties(db, pmInvite[1])).find(x => x.id === pmInvite[2]);
        const inviteUrl = `${origin}/e/${pmInvite[1]}/join-side?invite=${token}`;
        return html(res, layout('Invite the other side', `
          <h1>Invite ${party?.name ? esc(party.name) : 'the other side'}</h1>
          <p class="mut">Send this private link to the person responsible for the other side (a manager, coach, or the athlete/club themselves). When they open it, they'll connect their name + email — which creates their account — and become a <b style="color:var(--bone)">co-organiser</b>. They can't edit your event, but they can manage their own page and share their own promo link for it.</p>
          <div class="card" style="margin-top:14px"><div class="mut" style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;font-weight:800">Private invite link</div>
            <p style="word-break:break-all;margin:8px 0"><a href="${esc(inviteUrl)}" style="color:var(--bone);border-bottom:1px solid var(--b)">${esc(inviteUrl)}</a></p>
            ${shareButton({ title: `Co-organise ${d.title}`, cls: 'btn', label: 'Copy invite link', url: inviteUrl })}
          </div>
          <div class="row" style="margin-top:16px"><a class="btn ghost" href="/e/${pmInvite[1]}">← Back to the event</a></div>
        `, { back: `/e/${pmInvite[1]}`, nav: { guest: false, fanId: viewer } }));
      }
      // The invited person ACCEPTS → becomes a co-organiser. Guests are sent to
      // sign up first (name + email → magic link), returning here to accept.
      const pmJoin = path.match(/^\/e\/([^/]+)\/join-side$/);
      if (pmJoin && req.method === 'GET') {
        const token = url.searchParams.get('invite') || '';
        const inv = await sideInviteByToken(db, token);
        if (!inv) return html(res, layout('Invite not found', `<h1>This invite link isn't valid</h1><p class="mut">It may have been withdrawn. Ask the organiser for a fresh link.</p><div class="row" style="margin-top:12px"><a class="btn" href="/">Home</a></div>`, { back: '/', nav: { guest: viewerGuest, fanId: viewerGuest ? null : viewer } }));
        if (viewerGuest || !account) {
          return redirect(res, `/signup?next=${encodeURIComponent(`/e/${pmJoin[1]}/join-side?invite=${token}`)}`);
        }
        const owned = await ownedEntities(db, account.id);
        return html(res, layout('Co-organise this event', `
          <h1>You've been invited to co-organise</h1>
          <p class="mut"><b style="color:var(--bone)">${esc(inv.eventTitle)}</b> — you'd represent <b style="color:var(--bone)">${esc(inv.placeholder || 'the other side')}</b>. As a co-organiser you can add side events and share your own promo link. You can't edit the main event.</p>
          <form method="post" action="/e/${pmJoin[1]}/join-side" style="margin-top:14px">
            <input type="hidden" name="invite" value="${esc(token)}">
            ${owned.length ? `<label class="mut" style="display:block;font-size:13px;margin-bottom:8px">Accept as
              <select name="as" style="display:block;width:100%;margin-top:6px;background:var(--s);border:1px solid var(--b);border-radius:10px;color:var(--bone);padding:11px;font:inherit">
                <option value="">Myself (${esc(account.displayName || 'private person')})</option>
                ${owned.map(o => `<option value="${esc(o.kind)}:${esc(o.id)}">${esc(o.name)} (${esc(o.kind)})</option>`).join('')}
              </select></label>` : ''}
            <div class="row" style="margin-top:12px"><button type="submit">Accept &amp; co-organise →</button><a class="btn ghost" href="/e/${pmJoin[1]}">Not now</a></div>
          </form>
        `, { back: `/e/${pmJoin[1]}`, nav: { guest: false, fanId: viewer } }));
      }
      if (pmJoin && req.method === 'POST') {
        if (viewerGuest || !account) return redirect(res, `/signup`);
        const f = await parseForm(req);
        const asPick = (f.as || '').includes(':') ? { kind: f.as.split(':')[0], id: f.as.split(':')[1] } : null;
        // only accept an entity the accepter actually owns
        const owned = await ownedEntities(db, account.id);
        const valid = asPick && owned.some(o => o.kind === asPick.kind && o.id === asPick.id) ? asPick : null;
        const r = await acceptSideInvite(db, { token: f.invite || '', accountId: account.id, asEntityKind: valid?.kind ?? null, asEntityId: valid?.id ?? null });
        return redirect(res, r ? `/e/${r.eventId}` : `/e/${pmJoin[1]}`);
      }
      // Organizer removes a party (or a participant removes themselves).
      const pmRemove = path.match(/^\/e\/([^/]+)\/party\/([^/]+)\/remove$/);
      if (req.method === 'POST' && pmRemove) {
        const d = await getEventDetail(db, pmRemove[1]);
        if (!d) return html(res, 'Not found', 404);
        const p = (await listParties(db, pmRemove[1])).find(x => x.id === pmRemove[2]);
        const isOrganizer = await canEdit(d.hostKind ?? '', d.hostId ?? '');
        const isMe = !viewerGuest && p?.entityId && (await ownedEntities(db, account!.id)).some(o => o.kind === p.entityKind && o.id === p.entityId);
        if (isOrganizer || isMe) await removeParty(db, pmRemove[2]);
        return redirect(res, `/e/${pmRemove[1]}`);
      }
      // Organizer mints a custom promo link (an influencer / media partner draw).
      const pmPromo = path.match(/^\/e\/([^/]+)\/promo$/);
      if (req.method === 'POST' && pmPromo) {
        const d = await getEventDetail(db, pmPromo[1]);
        if (!d || !await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${pmPromo[1]}`);
        const f = await parseForm(req);
        const label = (f.label || '').trim() || 'Custom link';
        await addParty(db, { eventId: pmPromo[1], role: 'promoter', placeholder: label, status: 'accepted', kind: 'custom' });
        return redirect(res, `/manage/${pmPromo[1]}`);
      }
      // Promo codes — organiser-only. Add a discount code (10/20/50/free) or remove one.
      const pmCode = path.match(/^\/e\/([^/]+)\/promocode$/);
      if (req.method === 'POST' && pmCode) {
        const d = await getEventDetail(db, pmCode[1]);
        if (!d || !await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${pmCode[1]}`);
        const f = await parseForm(req);
        await createPromoCode(db, pmCode[1], f.code || '', Number(f.percent) || 0).catch(() => null);
        return redirect(res, `/manage/${pmCode[1]}`);
      }
      const pmCodeDel = path.match(/^\/e\/([^/]+)\/promocode\/([^/]+)\/delete$/);
      if (req.method === 'POST' && pmCodeDel) {
        const d = await getEventDetail(db, pmCodeDel[1]);
        if (!d || !await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${pmCodeDel[1]}`);
        await deletePromoCode(db, pmCodeDel[1], pmCodeDel[2]);
        return redirect(res, `/manage/${pmCodeDel[1]}`);
      }

      if (req.method === 'POST' && path === '/attend') {
        const f = await parseForm(req);
        await attend(db, f.fan_id, f.event_id, (f.mode as any) ?? 'going');
        await loyaltyForEvent(f.fan_id, f.event_id, 'rsvp');
        return redirect(res, req.headers.referer ?? '/');
      }
      // Place lookup for every address field. Server-side proxy: keeps any API
      // key off the client and keeps the user's typing between them and us.
      if (path === '/api/geo') {
        if (viewerGuest) return json(res, { results: [] }, 401);
        return json(res, { results: await lookupPlaces(url.searchParams.get('q') || '') });
      }

      // Entity typeahead for the rival / roster pickers on the create form.
      // JSON, logged-in only (it's an authoring aid, not a public directory —
      // fan privacy doctrine means we don't hand out a browsable people index).
      if (path === '/api/entities') {
        if (viewerGuest) return json(res, { results: [] }, 401);
        const q = url.searchParams.get('q') || '';
        const kindsRaw = (url.searchParams.get('kinds') || '').split(',').filter(Boolean);
        const allowed = ['athlete', 'club', 'team', 'association'];
        const kinds = kindsRaw.filter(k => allowed.includes(k)) as any[];
        const results = await searchEntities(db, q, {
          kinds: kinds.length ? kinds : undefined,
          sport: url.searchParams.get('sport'),
          limit: 8,
        });
        return json(res, { results });
      }

      // Legal. Must be reachable from anywhere, unauthenticated, always — an
      // Impressum has to be "leicht erkennbar, unmittelbar erreichbar und
      // ständig verfügbar" (§ 5 DDG). Never gate these behind anything.
      if (path === '/impressum') return html(res, renderImpressum());
      if (path === '/agb' || path === '/terms') return html(res, renderTerms());
      if (path === '/widerruf' || path === '/withdrawal') return html(res, renderWithdrawal());
      if (path === '/datenschutz') return html(res, renderDatenschutz());
      if (path === '/privacy') return redirect(res, '/datenschutz');
      if (path === '/legal') return redirect(res, '/impressum');

      // joinhorda.com/discord → the live invite. One indirection so the invite
      // can be rotated in env without touching a single published link.
      if (path === '/discord') {
        const inv = discordUrl();
        return inv ? redirect(res, inv) : redirect(res, '/changelog#ask');
      }

      // Public ship log. No auth, no gating — the whole point is that anyone,
      // including someone who has never heard of us, can see what we ship.
      if (path === '/changelog') return html(res, renderChangelog(viewerGuest));
      if (path === '/about/changelog') return redirect(res, '/changelog');

      // --- MACHINE-READABLE SURFACES -------------------------------------
      // All public, all uncredentialed: an agent or crawler has no cookie, and a
      // machine surface behind auth is a machine surface nobody reads. Nothing
      // here exposes anything a logged-out visitor can't already see.
      //
      // Every one of these derives from src/content/changelog.ts at request time
      // — no cache, no second copy. A JSON feed's characteristic failure is
      // silently drifting from the page it describes; the fix is having nothing
      // to drift from.
      const serve = (body: string, type: string, maxAge = 300) => {
        res.writeHead(200, { 'content-type': type, 'cache-control': `public, max-age=${maxAge}` });
        res.end(body);
      };
      if (path === '/changelog.json') {
        // Pretty-printed on purpose: this gets read by humans debugging agents at
        // least as often as by the agents, and the bytes are irrelevant at this size.
        return serve(JSON.stringify(changelogFeed(origin), null, 2), 'application/json; charset=utf-8');
      }
      if (path === '/changelog.md') return serve(changelogMarkdown(origin), 'text/markdown; charset=utf-8');
      if (path === '/feed.xml' || path === '/rss.xml') return serve(rssFeed(origin), 'application/rss+xml; charset=utf-8');
      if (path === '/sitemap.xml') {
        // Public, upcoming, listed events — so a crawler discovers each event page
        // and reads its schema.org JSON-LD. Unlisted excluded; capped so a viral
        // moment can't produce a 50k-line sitemap (crawlers cap at 50k anyway).
        const smEvents = (await db.query<{ id: string; starts_at: string | null }>(
          `SELECT id, starts_at FROM event
           WHERE host_kind IS NOT NULL AND starts_at > now()
             AND COALESCE(visibility,'public') <> 'unlisted'
           ORDER BY starts_at ASC LIMIT 5000`)).rows;
        return serve(sitemapXml(origin, smEvents.map(e => ({ id: e.id, startsAt: e.starts_at }))), 'application/xml; charset=utf-8', 3600);
      }
      if (path === '/robots.txt') return serve(robotsTxt(origin), 'text/plain; charset=utf-8', 3600);
      if (path === '/llms.txt') return serve(llmsTxt(origin, { discordUrl: hasDiscord() ? discordUrl() : undefined }), 'text/plain; charset=utf-8', 3600);
      if (path === '/about') return html(res, renderAbout(viewerGuest));
      if (path === '/about/creators') return html(res, renderAboutCreators(viewerGuest));
      if (path === '/about/features') return html(res, renderAboutFeatures(viewerGuest));
      if (path === '/about/pricing') return html(res, renderAboutPricing(viewerGuest));
      if (path === '/about/embed') return html(res, renderAboutEmbed(viewerGuest));
      // Embeddable events widget — a club/athlete drops this <iframe> on their own
      // site. Public + read-only; frameable (we set no X-Frame-Options).
      if ((em = path.match(/^\/embed\/(athlete|club|team|association)\/([^/]+)$/))) {
        const [_x, kind, id] = em;
        const nm = await hostName(db, kind, id).catch(() => '');
        if (!nm) return html(res, 'Not found', 404);
        const evs = (await listProfileEvents(db, kind, id)).filter(e => !e.past)
          .map(e => ({ id: e.id, title: e.title, date: e.date, live: e.live }));
        return html(res, renderEmbedWidget({ kind, id, name: nm, events: evs, origin }));
      }
      // Owner-facing snippet page (auth: must own the entity).
      if ((em = path.match(/^\/embed\/(athlete|club|team|association)\/([^/]+)\/code$/))) {
        const [_x, kind, id] = em;
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        if (!await canEdit(kind, id)) return redirect(res, entityHref(kind, id));
        const nm = await hostName(db, kind, id).catch(() => '');
        if (!nm) return html(res, 'Not found', 404);
        return html(res, renderEmbedCode({ kind, id, name: nm, origin, fanId: viewer }));
      }
      if (path === '/athletes') return redirect(res, '/about/creators');
      if (path === '/clubs') return redirect(res, '/about/creators');
      if (path === '/pros' || path === '/about/creators/pros') {
        return html(res, renderPros({ guest: viewerGuest, fanId: viewer }));
      }
      // The "run a full page" entrance (athlete / club / federation) — for people
      // who want a standing creator page, distinct from just hosting one event.
      if (path === '/onboarding') {
        return html(res, renderCreatorEntry({ guest: viewerGuest }));
      }
      // Create an event — the events-first doctrine: any logged-in person can host.
      //
      // NO AGE GATE HERE, deliberately. Doctrine is "gate money, not creation":
      // a 16-year-old running a Kreisliga fixture or a school tournament is
      // exactly who this is for. The 18+ requirement lives where money actually
      // moves — connecting a payout account — because that's Stripe's rule, not
      // ours. See /manage-payouts. (Under-16s additionally need parental consent
      // under Art. 8 DSGVO; that's covered in /datenschutz.)
      if (path === '/create' || (req.method === 'POST' && path === '/create')) {
        if (viewerGuest || !account) return redirect(res, '/signup?next=/create');
        const hostable = await ownedEntities(db, account.id);
        if (hostable.length === 1) return redirect(res, `/host/${hostable[0].kind}/${hostable[0].id}/new`);
        if (hostable.length > 1) return html(res, renderCreatePicker({ fanId: viewer, pages: hostable }));
        // No page yet → auto-provision a personal host page and go straight to
        // the event form. Nothing between wanting an event and writing one.
        const aId = await createAthlete(db, account.displayName || 'My events');
        await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [account.id, aId]);
        await grantOwnership(db, account.id, 'athlete', aId);
        await activateCreatorLayer(db, account.id, false);
        return redirect(res, `/host/athlete/${aId}/new`);
      }
      // Profile: land on your PUBLIC profile as an external visitor sees it. If you
      // own a page, that's your public entity page (with an owner-only "Edit
      // profile" button → Settings); otherwise the personal dashboard.
      if (path === '/me') {
        if (viewerGuest) return redirect(res, '/signup?next=/me');
        const own = ownedForNav.find(e => e.kind === 'athlete') ?? ownedForNav[0];
        if (own) return redirect(res, `/${own.kind}/${own.id}`);
        return redirect(res, `/fan/${viewer}`);
      }
      if (path === '/settings') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const editHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/customize` : undefined;
        const insHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/insights` : undefined;
        const handle = (await db.query<{ handle: string | null }>(`SELECT handle FROM fan WHERE id=$1`, [viewer])).rows[0]?.handle ?? null;
        const phone = account ? await getAccountPhone(db, account.id) : null;
        const ownsCount = account ? (await ownedEntities(db, account.id)).length : 0;
        const plan = await getAccountPlan(db, account?.id ?? null);
        const flash = url.searchParams.get('upgraded') ? 'Welcome to Horda Plus — your paid tickets are now 0% fee.'
          : url.searchParams.get('downgraded') ? 'Horda Plus cancelled. You’re back on the Free plan.'
          : url.searchParams.get('ok') || undefined;
        return html(res, renderSettings({ fanId: viewer, fanName: account?.displayName || 'You', handle, email: account?.email, phone, ownsPages: ownsCount > 0, editPageHref: editHref, insightsHref: insHref, createHref: viewerCreateHref, notice: flash, error: url.searchParams.get('err') || undefined, plan, plusLive: getPlan('plus').live, platformFeePct: TAKE_RATE_PCT, managed: ownedForNav.map(o => ({ kind: o.kind, id: o.id, name: o.name })) }));
      }
      // Live username availability — the settings field polls this as you type.
      if (path === '/account/username-available') {
        if (viewerGuest) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"valid":false}'); return; }
        const u = (url.searchParams.get('u') || '').trim().replace(/^@/, '').toLowerCase();
        const valid = /^[a-z0-9_]{3,20}$/.test(u);
        const current = (await db.query<{ handle: string | null }>(`SELECT handle FROM fan WHERE id=$1`, [viewer])).rows[0]?.handle?.toLowerCase() === u;
        const available = valid && (current || !(await handleTaken(db, u, viewer)));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ valid, available, current }));
        return;
      }
      // Account edits (magic-link model: no passwords). Name + username live on the
      // fan; phone on the account; sessions are the "security" surface.
      if (req.method === 'POST' && path === '/account/profile') {
        if (viewerGuest) return redirect(res, '/signup');
        const f = await parseForm(req);
        if (typeof f.name === 'string' && f.name.trim()) await updateFanName(db, viewer, f.name);
        if (typeof f.username === 'string' && f.username.trim()) {
          const r = await updateFanHandle(db, viewer, f.username);
          if (!r.ok) return redirect(res, '/settings?err=' + encodeURIComponent(r.error || 'Could not update username.'));
        }
        return redirect(res, '/settings?ok=' + encodeURIComponent('Saved.'));
      }
      if (req.method === 'POST' && path === '/account/phone') {
        if (viewerGuest || !account) return redirect(res, '/signup');
        const f = await parseForm(req);
        await updateAccountPhone(db, account.id, f.phone ?? null);
        return redirect(res, '/settings?ok=' + encodeURIComponent('Phone updated.'));
      }
      if (req.method === 'POST' && path === '/account/signout-all') {
        if (viewerGuest || !account) return redirect(res, '/');
        await deleteAllSessions(db, account.id);
        res.writeHead(303, { 'set-cookie': 'hz_session=; Path=/; Max-Age=0', location: '/' }); res.end(); return;
      }
      if (req.method === 'POST' && path === '/account/delete') {
        if (viewerGuest || !account) return redirect(res, '/');
        const f = await parseForm(req);
        if ((f.confirm || '').trim().toUpperCase() !== 'DELETE') return redirect(res, '/settings?err=' + encodeURIComponent('Type DELETE to confirm.'));
        const r = await deleteAccount(db, account.id);
        if (!r.ok) return redirect(res, '/settings?err=' + encodeURIComponent(r.error || 'Could not delete.'));
        res.writeHead(303, { 'set-cookie': 'hz_session=; Path=/; Max-Age=0', location: '/' }); res.end(); return;
      }
      if (path === '/signup') {
        return html(res, renderSignup(url.searchParams.get('next') ?? '/', url.searchParams.get('follow') ?? ''));
      }
      // PUBLIC share pages (the acquisition loop) — open to everyone, like Shop.
      let sm;
      if ((sm = path.match(/^\/share\/result\/([^/]+)$/))) {
        const a = await buildResultShare(db, sm[1]);
        return a ? html(res, renderSharePage(a, '/signup', { guest: viewerGuest, fanId: viewerGuest ? null : viewer })) : html(res, '<p>Not found</p>', 404);
      }
      if ((sm = path.match(/^\/share\/fight\/([^/]+)$/))) {
        const a = await buildFightShare(db, sm[1]);
        return a ? html(res, renderSharePage(a, '/signup', { guest: viewerGuest, fanId: viewerGuest ? null : viewer })) : html(res, '<p>Not found</p>', 404);
      }
      if ((sm = path.match(/^\/share\/week\/([^/]+)$/))) {
        const a = await buildWeekDrop(db, sm[1]);
        return html(res, renderSharePage(a, '/signup', { guest: viewerGuest, fanId: viewerGuest ? null : viewer }));
      }

      // language preference (EN/DE) — per-device cookie, then back to where you were
      if (path === '/set-lang') {
        const l = url.searchParams.get('l') === 'de' ? 'de' : 'en';
        // Stay on the current page: prefer an explicit ?next=, else the Referer path.
        let next = url.searchParams.get('next') || '';
        if (!next || !next.startsWith('/')) {
          try { const ref = new URL(req.headers.referer || '', origin); if (ref.host === new URL(origin).host) next = ref.pathname + ref.search; } catch { /* ignore */ }
        }
        if (!next.startsWith('/')) next = '/';   // only same-origin redirects
        res.writeHead(303, { 'set-cookie': `hz_lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax`, location: next }); res.end(); return;
      }
      // Following: everything you follow + search to add + unfollow.
      if (path === '/following') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const follows = await getFollows(db, viewer);
        const sportKeys = await followedSports(db, viewer);
        const sports = sportKeys.map(k => ({ key: k, name: sportLabel(k) }));
        const regions = await followedRegions(db, viewer);
        const q = (url.searchParams.get('q') || '').trim();
        let results: { kind: string; id: string; name: string; region: string | null }[] = [];
        if (q) {
          const like = '%' + q.toLowerCase() + '%';
          const ath = (await db.query<any>(`SELECT id, display_name name, region FROM athlete WHERE lower(display_name) LIKE $1 ORDER BY display_name LIMIT 8`, [like])).rows.map(r => ({ kind: 'athlete', id: r.id, name: r.name, region: r.region ?? null }));
          const cl = (await db.query<any>(`SELECT id, name, region FROM club WHERE lower(name) LIKE $1 ORDER BY name LIMIT 8`, [like])).rows.map(r => ({ kind: 'club', id: r.id, name: r.name, region: r.region ?? null }));
          // Sports match by key or English label — a sport is a first-class thing to follow now.
          const ql = q.toLowerCase();
          const sp = Object.entries(SPORT_EN_LABELS).filter(([k, n]) => k.includes(ql.replace(/\s+/g, '_')) || n.toLowerCase().includes(ql))
            .slice(0, 6).map(([k, n]) => ({ kind: 'sport', id: k, name: n, region: null }));
          // Cities/regions — the known set plus any place present in the data (e.g. "Berlin").
          const regSet = new Set<string>();
          for (const r of REGIONS) if (r.toLowerCase().includes(ql)) regSet.add(r);
          for (const r of await searchRegions(db, q)) regSet.add(r);
          const rg = [...regSet].slice(0, 6).map(r => ({ kind: 'region', id: r, name: r, region: null }));
          results = [...rg, ...sp, ...ath, ...cl];
        }
        // Recommendations: the most-followed athletes/clubs/federations you don't
        // already follow — so there's always a next thing to back.
        const followedIds = new Set(follows.map(f => `${f.type}:${f.id}`));
        const recRows = [
          ...(await db.query<any>(`SELECT a.id, a.display_name name, a.region, (SELECT count(*) FROM follow WHERE target_type::text='athlete' AND target_id=a.id) AS fc FROM athlete a ORDER BY fc DESC, a.display_name LIMIT 12`, [])).rows.map((r: any) => ({ kind: 'athlete', id: r.id, name: r.name, region: r.region ?? null })),
          ...(await db.query<any>(`SELECT c.id, c.name, c.region, (SELECT count(*) FROM follow WHERE target_type::text='club' AND target_id=c.id) AS fc FROM club c ORDER BY fc DESC, c.name LIMIT 12`, [])).rows.map((r: any) => ({ kind: 'club', id: r.id, name: r.name, region: r.region ?? null })),
        ];
        const recommendations = recRows.filter(r => !followedIds.has(`${r.kind}:${r.id}`)).slice(0, 8);
        return html(res, renderFollowing({ fanId: viewer, createHref: viewerCreateHref, follows, sports, regions, q, results, recommendations }));
      }
      if (req.method === 'POST' && path === '/unfollow') {
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        const f = await parseForm(req);
        if (f.target_type === 'sport') await unfollowSport(db, viewer, f.target_id);
        else if (f.target_type === 'region') await unfollowRegion(db, viewer, f.target_id);
        else await unfollowEntity(db, viewer, f.target_type, f.target_id);
        return redirect(res, req.headers.referer ?? '/following');
      }
      if (path === '/') {
        // A typed sport is resolved to its KEY across both live languages, so
        // "Fußball", "soccer" or "football" all select the football chip. A typed
        // city is expanded to every equivalent so "München" finds "Munich" events.
        const sportRaw = url.searchParams.get('sport') || undefined;
        const sport = sportRaw ? (resolveSportKey(sportRaw, SPORT_EN_LABELS) ?? sportRaw) : undefined;
        const region = url.searchParams.get('region') || undefined;
        // A logged-in organiser's own events are excluded from "Public events" —
        // that band is for discovering other people's. ownedForNav is the viewer's
        // owned entities (empty for guests/plain fans).
        const excludeHosts = viewerGuest ? [] : ownedForNav.map(o => ({ kind: o.kind, id: o.id }));
        const data = await getDiscover(db, { sport, region, regionAliases: cityAliases(region), excludeHosts });
        const unread = viewerGuest ? 0 : await unreadCount(db, viewer);
        // Remember a guest's filter so, when they sign up, it becomes their feed
        // (auto-follow the sport + region they were browsing).
        if (viewerGuest && (sport || region)) res.setHeader('set-cookie', `hz_filter=${encodeURIComponent((sport || '') + '|' + (region || ''))}; Path=/; Max-Age=1800; SameSite=Lax`);
        // Logged-in home leads with the viewer's own feed of upcoming events from
        // the crowds they follow (the "events I prefer").
        // "Your events" = the events YOU organise (main organiser or co-organiser),
        // soonest first. Not "from who you follow" — that's what Public events is for.
        let organized: { eventId: string; title: string; date: string | null; hostName: string; role: 'organizer' | 'co-organizer' }[] = [];
        if (!viewerGuest && account) {
          const ownerKeys = ownedForNav.map(o => `${o.kind}:${o.id}`);
          const coIds = await coOrganizedEventIds(db, account.id);
          const rows = await organizedUpcoming(db, ownerKeys, coIds);
          organized = await Promise.all(rows.map(async r => ({ eventId: r.eventId, title: r.title, date: r.date, hostName: r.hostKind && r.hostId ? await hostName(db, r.hostKind, r.hostId) : '', role: r.role })));
        }
        // Public "Events · live & upcoming": include the events the viewer has
        // CLAIMED a pass/ticket for (even if outside the top window), and mark them.
        let upcoming = data.upcoming as (typeof data.upcoming[number] & { claimed?: boolean })[];
        if (!viewerGuest && account) {
          const claimedSet = await myClaimedIn(db, viewer, upcoming.map(e => e.id));
          upcoming = upcoming.map(e => ({ ...e, claimed: claimedSet.has(e.id) }));
          // pull in any claimed upcoming events not already shown, so a ticket you
          // hold is never missing from the list.
          const present = new Set(upcoming.map(e => e.id));
          const attending = await attendingEvents(db, viewer);
          for (const a of attending) {
            if (present.has(a.eventId) || (a.startsAt && new Date(a.startsAt).getTime() < Date.now())) continue;
            upcoming.push({ id: a.eventId, title: a.title, date: a.date ?? undefined, host: (a.hostKind && a.hostId ? await hostName(db, a.hostKind, a.hostId) : ''), admission: 'open', going: 0, shares: 0, followers: 0, live: false, coverUrl: null, claimed: true } as any);
            present.add(a.eventId);
          }
        }
        return html(res, renderDiscover({ guest: viewerGuest, fanId: viewer, sport, region, data: { ...data, upcoming }, regions: REGIONS, lang, unread, organized }));
      }
      if (path === '/map') {
        // Event map: plot UPCOMING public events at their host's region.
        //
        // Two bugs this query had: (1) no `starts_at > now()` filter, and (2)
        // ORDER BY starts_at ASC — so the LIMIT filled with the OLDEST rows,
        // meaning the map showed last month's finished matches and dropped next
        // week's. It has to be future-only, and ordered by soonest-first so the
        // cap keeps the events people can still go to.
        //
        // `live` = starts within the next 3 hours (or started up to 3h ago) —
        // the map rings these in orange. `AT TIME ZONE` so "now" is judged at the
        // venue, consistent with everywhere else (tz.ts).
        const evRows = (await db.query<any>(
          `SELECT e.id, e.name title,
                  COALESCE(a.region, cl.region) region,
                  COALESCE(e.cover_url, a.avatar_url) avatar,
                  (e.starts_at <= now() + interval '3 hours' AND e.starts_at >= now() - interval '3 hours') live
           FROM event e
           LEFT JOIN athlete a ON e.host_kind::text='athlete' AND a.id::text=e.host_id::text
           LEFT JOIN club cl  ON e.host_kind::text='club'    AND cl.id::text=e.host_id::text
           WHERE e.host_kind IS NOT NULL AND e.starts_at IS NOT NULL
             AND e.starts_at >= now() - interval '3 hours'
             AND COALESCE(e.visibility,'public') <> 'unlisted'
             AND e.parent_event_id IS NULL   -- sub-events live only on their main event page
             AND e.cancelled_at IS NULL
           ORDER BY e.starts_at ASC LIMIT 200`)).rows;
        const points = evRows.filter(r => r.region).map(r => ({ name: r.title, region: r.region, href: `/e/${r.id}`, kind: 'event', avatar: r.avatar || null, live: !!r.live }));
        return html(res, renderMap({ guest: viewerGuest, fanId: viewer, points, lang }));
      }
      let m;
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/branding$/))) {
        const f = await parseForm(req);
        await setAthleteProfile(db, m[1], { avatarUrl: (await storeImage(f.avatar, 'avatars')) || undefined, bannerUrl: (await storeImage(f.banner, 'banners')) || undefined });
        return redirect(res, `/athlete/${m[1]}`);
      }
      // athlete customizes their page sections (owner-only)
      if ((m = path.match(/^\/athlete\/([^/]+)\/customize$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const sport = await getAthleteSport(db, m[1]);
        const sections = resolveLayout(sport, await getAthleteLayout(db, m[1]));
        const prof = await getAthleteProfile(db, m[1]);
        const cTiers: any[] = [];   // fan tiers retired — no tier editor
        const cBanner = await getBannerStyle(db, m[1]);
        const cMedia = await listMedia(db, 'athlete', m[1]);
        const cSponsors = await listSponsors(db, 'athlete', m[1]);
        const cSports = await getAthleteSports(db, m[1]);
        const cShop = await listShopItems(db, 'athlete', m[1]);
        const cTheme = autoContrast(parseTheme(await getAthleteTheme(db, m[1]), cSports[0] ?? sport));
        const cThemeStudio = renderThemeStudio(m[1], prof.name, cTheme);
        const managed = ownedForNav.map(o => ({ kind: o.kind, id: o.id, name: o.name }));
        return html(res, renderCustomize({ athleteId: m[1], fanId: viewer, name: prof.name, handle: prof.handle, tagline: prof.tagline, managed, error: url.searchParams.get('err') || undefined, sport, sports: cSports, sections, links: prof.links, tiers: cTiers, bannerUrl: prof.bannerUrl, banner: cBanner, media: cMedia, sponsors: cSponsors, shop: cShop, themeStudioHtml: cThemeStudio }));
      }
      // Save the athlete PAGE identity — name, @handle, about. Owner only.
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/identity$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const r = await updateAthleteIdentity(db, m[1], { name: f.name, handle: f.handle, tagline: f.tagline });
        return redirect(res, `/athlete/${m[1]}/customize${r.ok ? '' : '?err=' + encodeURIComponent(r.error || 'Could not save')}`);
      }
      // §4a theme save — preset base + accent/type/overlay/bg overrides (tokens only).
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/theme$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const base = THEME_PRESETS.find(p => p.id === f.preset)?.spec ?? defaultThemeForSport((await getAthleteSports(db, m[1]))[0] ?? null);
        const hex = (v: string, d: string) => /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : d;
        const spec: ThemeSpec = autoContrast({
          bg: hex(f.bg, base.bg), fg: base.fg, accent: hex(f.accent, base.accent),
          type: (['bold', 'condensed', 'wide', 'serif', 'mono'].includes(f.type) ? f.type : base.type) as ThemeSpec['type'],
          overlay: (['none', 'gradient', 'grain', 'stripes', 'spotlight'].includes(f.overlay) ? f.overlay : base.overlay) as ThemeSpec['overlay'],
        });
        await setAthleteTheme(db, m[1], serializeTheme(spec));
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // banner reposition / zoom / video — owner only
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/banner$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        await setBannerStyle(db, m[1], { pos: { x: Number(f.x), y: Number(f.y), zoom: Number(f.zoom) }, videoUrl: f.video_url || null });
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // media grid add / delete — owner only
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/media$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const url = f.kind === 'image' ? ((await storeImage(f.url, 'media')) || f.url) : f.url;
        if (url) await addMedia(db, 'athlete', m[1], f.kind || 'image', url, f.caption || undefined);
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/media\/([^/]+)\/delete$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        await deleteMedia(db, 'athlete', m[1], m[2]);
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // sponsors add / delete — owner only
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/sponsor$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const logo = (await storeImage(f.logo_url, 'sponsors')) || f.logo_url || undefined;
        if ((f.name || '').trim()) await addSponsor(db, 'athlete', m[1], f.name.trim(), f.url || undefined, logo);
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/sponsor\/([^/]+)\/delete$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        await deleteSponsor(db, 'athlete', m[1], m[2]);
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // shop items add / delete — owner only
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/shop$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const cents = f.price ? Math.round(Number(String(f.price).replace(',', '.').replace(/[^0-9.]/g, '')) * 100) : null;
        if ((f.title || '').trim()) await addShopItem(db, 'athlete', m[1], { kind: f.kind || 'merch', title: f.title.trim(), subtitle: f.subtitle, url: f.url, priceCents: cents });
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/shop\/([^/]+)\/delete$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        await deleteShopItem(db, 'athlete', m[1], m[2]);
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // Build Order #3: collective / rivalry goal — owner sets a metric + reward.
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/goal$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const threshold = f.metric === 'support' ? Math.round(Number(f.threshold) * 100) : Math.round(Number(f.threshold));
        await createGoal(db, { ownerKind: 'athlete', ownerId: m[1], metric: f.metric || 'attendees', threshold: threshold || 1, reward: f.reward || 'a reward', rivalKind: f.rival_id ? 'athlete' : undefined, rivalId: f.rival_id || undefined });
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // creator insights dashboard (owner)
      if ((m = path.match(/^\/athlete\/([^/]+)\/insights$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const aid = m[1];
        const prof = await getAthleteProfile(db, aid);
        const one = async (sql: string) => (await db.query<{ n: number }>(sql, [aid])).rows[0]?.n ?? 0;
        const followers = await one(`SELECT count(*)::int n FROM follow WHERE target_type::text='athlete' AND target_id=$1`);
        const claims = await one(`SELECT count(*)::int n FROM claim c JOIN event e ON e.id=c.event_id WHERE e.host_kind='athlete' AND e.host_id=$1 AND c.status NOT IN ('refunded','no_show')`);
        const presences = await one(`SELECT count(*)::int n FROM presence p JOIN event e ON e.id=p.event_id WHERE e.host_kind='athlete' AND e.host_id=$1`);
        const events = (await listProfileEvents(db, 'athlete', aid)).length;
        return html(res, renderInsights({ name: prof.name, athleteId: aid, editHref: `/athlete/${aid}/customize`, followers, claims, presences, events }));
      }
      // shareable supporter card (the viral surface) — free + OG-tagged
      if ((sm = path.match(/^\/share\/supporter\/(athlete|club|team|association)\/([^/]+)$/))) {
        const nm = await hostName(db, sm[1], sm[2]);
        let sport: string | null = null;
        if (sm[1] === 'athlete') sport = await getAthleteSport(db, sm[2]);
        // §4a propagation: the athlete's own theme skins the share card.
        const card = sm[1] === 'athlete'
          ? bannerSvg({ name: nm, sport }, autoContrast(parseTheme(await getAthleteTheme(db, sm[2]), sport)), { og: true })
          : supporterCard({ athleteName: nm, sport, label: defaultRoomLabel(sport), title: nm, opponent: null }, { backing: true });
        await track(db, 'artifact_share', { ownerKind: sm[1], ownerId: sm[2], props: { kind: 'supporter_card' } });
        const ogImg = `${origin}/share/supporter/${sm[1]}/${sm[2]}.svg`;
        return html(res, renderSharePage({ title: `Backing ${nm}`, card, body: `I'm backing ${nm} on Horda. Get closer to the athletes you love.`, shareText: `I'm backing ${nm} on Horda — joinhorda.com` }, sm[1] === 'athlete' ? `/athlete/${sm[2]}` : `/${sm[1]}/${sm[2]}`, { guest: viewerGuest, fanId: viewerGuest ? null : viewer }));
      }
      // save a membership tier (Supporter/Clubhouse) — owner only; wired to Stripe
      // Fan tier editor retired with the membership system → back to the page.
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/tiers$/))) {
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      // save profile details (sports + social links) — owner only
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/profile$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const params = new URLSearchParams(await readRaw(req));
        const sports = params.getAll('sports').map(s => s.trim()).filter(Boolean);
        if (sports.length) await setAthleteSports(db, m[1], sports);
        else if (params.get('sport')) await setAthleteSport(db, m[1], params.get('sport'), false);
        const links: Record<string, string> = {};
        for (const k of ['instagram', 'x', 'tiktok', 'youtube', 'website']) { const v = params.get(k); if (v) links[k] = v; }
        await setAthleteProfile(db, m[1], { links });
        return redirect(res, `/athlete/${m[1]}/customize`);
      }
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/layout$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        let parsed: any = []; try { parsed = JSON.parse(f.order || '[]'); } catch { /* ignore */ }
        const sport = await getAthleteSport(db, m[1]);
        const clean = resolveLayout(sport, Array.isArray(parsed) ? parsed.map((x: any) => ({ key: String(x?.key ?? ''), on: !!x?.on })) : null);
        await setAthleteLayout(db, m[1], clean);
        return redirect(res, `/athlete/${m[1]}`);
      }
      // "+" composer (owner) — create menu. Posts are public now (no paid tiers).
      if ((m = path.match(/^\/athlete\/([^/]+)\/compose$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        return html(res, renderCompose({ athleteId: m[1], fanId: viewer, hasPaidTiers: false }));
      }
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/post$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const vis = ['supporter', 'clubhouse', 'public'].includes(f.visibility) ? f.visibility : 'public';
        if ((f.body || '').trim()) await createPost(db, 'athlete', m[1], f.body.trim(), undefined, vis as any);
        return redirect(res, `/athlete/${m[1]}`);
      }
      // creators propose new features → continuous product improvement
      if (req.method === 'POST' && path === '/feature-request') {
        const f = await parseForm(req);
        await createFeatureRequest(db, account?.id ?? null, f.sport || null, f.context || null, f.body || '');
        // Post it where the team argues about it. Kept fire-and-forget: a wedged
        // webhook must never cost the user their submission.
        void notifyWebhook(`💡 **Feature request**${f.sport ? ` [${f.sport}]` : ''}\n> ${(f.body || '').slice(0, 400)}\n_Triage → if we build it, add it to src/content/changelog.ts and credit the asker._`);
        return redirect(res, req.headers.referer ?? '/');
      }
      // newsletter opt-in (public). Owner_kind 'horda' = platform-wide list.
      if (req.method === 'POST' && path === '/newsletter') {
        const f = await parseForm(req);
        const added = await subscribeNewsletter(db, f.owner_kind || 'horda', f.owner_id || 'horda', f.email || '');
        if (added) await notifyWebhook(`📰 New newsletter subscriber for ${f.owner_kind || 'horda'}:${f.owner_id || 'horda'}`);
        const back = f.owner_kind === 'athlete' && f.owner_id ? `/athlete/${f.owner_id}` : (req.headers.referer ?? '/');
        return redirect(res, back + (back.includes('?') ? '&' : '?') + 'subscribed=1');
      }
      // handle-claim vitality campaign — reserve your @handle before you build.
      if (path === '/claim-handle' && req.method !== 'POST') {
        return html(res, renderClaimHandle({ guest: viewerGuest, fanId: viewer }));
      }
      if (req.method === 'POST' && path === '/claim-handle') {
        const f = await parseForm(req);
        const r = await reserveHandle(db, f.handle || '', f.email || '', f.kind || undefined);
        if (r.ok) await notifyWebhook(`🏷️ Handle reserved: @${(f.handle || '').toLowerCase().replace(/^@/, '')} (${f.email})`);
        return html(res, renderClaimHandle({ guest: viewerGuest, fanId: viewer, result: r, handle: f.handle }));
      }
      if (req.method === 'POST' && (m = path.match(/^\/entity\/(club|team|association)\/([^/]+)\/branding$/))) {
        const f = await parseForm(req);
        const cur = await getBranding(db, m[1], m[2]);
        await setBranding(db, m[1] as any, m[2], { tagline: cur.tagline ?? undefined, links: cur.links, avatarUrl: (await storeImage(f.avatar, 'avatars')) || cur.avatarUrl || undefined, bannerUrl: (await storeImage(f.banner, 'banners')) || cur.bannerUrl || undefined });
        return redirect(res, `/${m[1]}/${m[2]}`);
      }
      if ((m = path.match(/^\/fan\/([^/]+)$/))) {
        // §1a: fan activity (follows, RSVPs, subs) is PRIVATE for all users — a
        // fan home is only ever visible to its owner, never to other accounts.
        if (viewerGuest) return redirect(res, '/signup?next=' + encodeURIComponent(path));
        if (m[1] !== viewer) return html(res, '<p>This feed is private. <a href="/">Home</a></p>', 403);
        const home = await getFanHome(db, m[1]);
        const follows = await getFollows(db, m[1]);
        // "Your pages": the creator side of the SAME account — switch here, and
        // manage the events each page runs. Only on the owner's own fan home.
        const ownPages = (account && m[1] === viewer)
          ? await Promise.all((await ownedEntities(db, account.id)).map(async e => ({ ...e, events: await listProfileEvents(db, e.kind, e.id) })))
          : [];
        // Your events, four bands: what you run (owned pages, above), what you
        // CO-run (co-organiser on someone else's event), what you hold a ticket
        // for, and everyone you follow. Co-running is a separate band because you
        // don't own the event — you promote it and see its stats, but don't edit it.
        const attending = await attendingEvents(db, m[1]);
        const coIds = account ? await coOrganizedEventIds(db, account.id) : [];
        const ownerKeys = ownPages.map(p => `${p.kind}:${p.id}`);
        const coRunning = coIds.length
          ? await Promise.all((await organizedUpcoming(db, ownerKeys, coIds)).filter(r => r.role === 'co-organizer').map(async r => ({
              eventId: r.eventId, title: r.title, date: r.date,
              hostName: (r.hostKind && r.hostId) ? await hostName(db, r.hostKind, r.hostId) : '',
            })))
          : [];
        const fanHandle = (await db.query<{ handle: string | null }>(`SELECT handle FROM fan WHERE id=$1`, [m[1]])).rows[0]?.handle ?? null;
        return html(res, renderFanHome({ fanId: m[1], fanName: account?.displayName || 'You', handle: fanHandle, home, follows, pages: ownPages, createHref: viewerCreateHref, attending, coRunning }));
      }
      // §4a/§6: hosted themed OG image for an athlete (rich share cards). SVG for
      // now; PNG rasterization is a follow-up once an image lib is added.
      if ((m = path.match(/^\/og\/athlete\/([^/]+)\.svg$/))) {
        const prof = /^[0-9a-fA-F-]{36}$/.test(m[1]) ? await getAthleteProfile(db, m[1]).catch(() => null) : null;
        if (!prof) { res.writeHead(404); res.end('not found'); return; }
        const sportsArr = await getAthleteSports(db, m[1]);
        const spec = autoContrast(parseTheme(await getAthleteTheme(db, m[1]), sportsArr[0] ?? null));
        const svg = bannerSvg({ name: prof.name, sport: sportsArr[0] ?? null, city: (prof as any).region ?? null }, spec, { og: true });
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=300' });
        res.end(svg); return;
      }
      if ((m = path.match(/^\/athlete\/([^/]+)$/))) {
        const guest = viewerGuest;
        const fanId = guest ? null : viewer;
        // existence + uuid-format guard so a bad/typo id is a clean 404, not a 500
        const aExists = /^[0-9a-fA-F-]{36}$/.test(m[1]) && (await db.query(`SELECT 1 FROM athlete WHERE id=$1`, [m[1]])).rows[0];
        if (!aExists) return html(res, '<p>Athlete not found. <a href="/">Home</a></p>', 404);
        const profile = await getAthleteProfile(db, m[1]);
        const upcoming = await getUpcomingBout(db, m[1]);
        const attendance = (!guest && upcoming) ? await getAttendance(db, viewer, upcoming.eventId) : null;
        const affiliations = await getAffiliations(db, m[1]);
        const rawAthEvents = await listProfileEvents(db, 'athlete', m[1]);
        // Mark the ones this viewer already holds a spot at (one query for the
        // whole list — see myClaimedIn).
        const athMine = await myClaimedIn(db, guest ? null : viewer, rawAthEvents.map(e => e.id));
        const events = rawAthEvents.map(e => ({ ...e, mine: athMine.has(e.id) }));
        // Fan membership/superfan retired — profile is follow + events only.
        const tiers: any[] = [], membership = null, members = 0, superfan = false, lscore = 0;
        const asFan = url.searchParams.get('as') === 'fan';   // owner previews their page as a fan
        const realOwner = await canEdit('athlete', m[1]);
        const athOwner = realOwner && !asFan;
        const athAct = athOwner ? renderChecklist(await athleteChecklist(db, m[1])) : '';
        const athSections = resolveLayout(await getAthleteSport(db, m[1]), await getAthleteLayout(db, m[1]));
        // §4a themed banner + OG — auto-generated wow default when no photo, and
        // the OG image is a hosted URL so shared links render a rich card either way.
        const athSportsArr = await getAthleteSports(db, m[1]);
        const athTheme = autoContrast(parseTheme(await getAthleteTheme(db, m[1]), athSportsArr[0] ?? null));
        const athClub = affiliations.find(a => a.kind === 'club')?.label ?? null;
        const athBanData = { name: profile.name, sport: athSportsArr[0] ?? null, club: athClub, city: (profile as any).region ?? null };
        const athThemedBanner = (profile.bannerUrl) ? undefined : svgDataUri(bannerSvg(athBanData, athTheme));
        const athRealPhoto = profile.bannerUrl && /^https?:\/\//.test(profile.bannerUrl) ? profile.bannerUrl : `${origin}/og/athlete/${m[1]}.svg`;
        const athOg = ogMeta({ title: `${profile.name} on Horda`, description: profile.tagline || `Follow ${profile.name} on Horda — drops, events and superfan access.`, url: `${origin}/athlete/${m[1]}`, image: athRealPhoto, type: 'profile' });
        const athMedia = await listMedia(db, 'athlete', m[1]);
        const athSponsors = await listSponsors(db, 'athlete', m[1]);
        const athBanner = await getBannerStyle(db, m[1]);
        const athGoals = await activeGoalProgress(db, 'athlete', m[1]);
        const goalsHtml = athGoals.map(g => goalBar(g)).join('');
        const athShop = await listShopItems(db, 'athlete', m[1]);
        const athSportsLabel = sportsLabel(await getAthleteSports(db, m[1]));
        const athConnections = await activeParents(db, 'athlete', m[1]);
        // Does this viewer already follow? Drives Follow vs Following on the page —
        // it always said "Follow", even to someone who already did.
        const athFollowing = fanId ? await isFollowing(db, fanId, 'athlete', m[1]) : false;
        return html(res, renderAthletePage({ guest, fanId, profile, upcoming, attendance, affiliations, events, connections: athConnections, scheduleHref: `/host/athlete/${m[1]}/new`, tiers, membership, superfan, loyalty: fanId ? { score: lscore, threshold: 200 } : null, memberCount: members, canEdit: athOwner, activation: athAct, sections: athSections, ogTags: athOg, previewAsFan: realOwner && asFan, media: athMedia, sponsors: athSponsors, banner: athBanner, goalsHtml, sportsLabel: athSportsLabel, createHref: viewerCreateHref, shop: athShop, themedBanner: athThemedBanner, isFollowing: athFollowing }));
      }
      // Club / team / federation PAGE editor — same depth as the athlete + personal
      // editors (name, about, photos, links), owner-gated, with the profile switcher.
      let entEdit;
      if ((entEdit = path.match(/^\/(club|team|association)\/([^/]+)\/customize$/))) {
        const ek = entEdit[1] as 'club' | 'team' | 'association', eid = entEdit[2];
        if (!await canEdit(ek, eid)) return redirect(res, `/${ek}/${eid}`);
        const b = await getBranding(db, ek, eid);
        const managed = ownedForNav.map(o => ({ kind: o.kind, id: o.id, name: o.name }));
        return html(res, renderEntityEdit({ kind: ek, id: eid, fanId: viewer, name: (await hostName(db, ek, eid)) || 'Your page', tagline: b.tagline, avatarUrl: b.avatarUrl, bannerUrl: b.bannerUrl, links: b.links, managed, error: url.searchParams.get('err') || undefined }));
      }
      // Save a club/team/federation's name, about + social links (owner only).
      if (req.method === 'POST' && (entEdit = path.match(/^\/(club|team|association)\/([^/]+)\/identity$/))) {
        const ek = entEdit[1] as 'club' | 'team' | 'association', eid = entEdit[2];
        if (!await canEdit(ek, eid)) return redirect(res, `/${ek}/${eid}`);
        const f = await parseForm(req);
        if ((f.name || '').trim()) await updateEntityName(db, ek, eid, f.name);
        const cur = await getBranding(db, ek, eid);
        const links: Record<string, string> = { ...cur.links };
        for (const k of ['instagram', 'x', 'tiktok', 'youtube', 'website']) links[k] = (f[k] || '').trim();
        await setBranding(db, ek, eid, { tagline: (f.tagline || '').trim() || undefined, links, avatarUrl: cur.avatarUrl || undefined, bannerUrl: cur.bannerUrl || undefined });
        return redirect(res, `/${ek}/${eid}/customize`);
      }
      // Save a club/team/federation's photos (owner only) — preserves name/about/links.
      if (req.method === 'POST' && (entEdit = path.match(/^\/(club|team|association)\/([^/]+)\/photos$/))) {
        const ek = entEdit[1] as 'club' | 'team' | 'association', eid = entEdit[2];
        if (!await canEdit(ek, eid)) return redirect(res, `/${ek}/${eid}`);
        const f = await parseForm(req);
        const cur = await getBranding(db, ek, eid);
        await setBranding(db, ek, eid, { tagline: cur.tagline ?? undefined, links: cur.links, avatarUrl: (await storeImage(f.avatar, 'avatars')) || cur.avatarUrl || undefined, bannerUrl: (await storeImage(f.banner, 'banners')) || cur.bannerUrl || undefined });
        return redirect(res, `/${ek}/${eid}/customize`);
      }
      if ((m = path.match(/^\/club\/([^/]+)$/))) {
        const guest = viewerGuest;
        const club = await getClub(db, m[1]);
        if (!club) return html(res, '<p>Not found</p>', 404);
        const brand = await getBranding(db, 'club', m[1]);
        const teams = await getTeamsOfClub(db, m[1]);
        const primary = teams[0];
        let tableHtml = '', statLine, upcoming = null, attendance = null, notice = '';
        if (primary) {
          const model = await getClubPage(db, primary.id, FOOTBALL_TABLE);
          tableHtml = tableDark('League table', model.table.map(t => ({ rank: t.rank, team: t.team, played: t.played, wins: t.wins, draws: t.draws, losses: t.losses, goalDiff: t.goalDiff, points: t.points, me: t.teamId === primary.id })));
          const meRow = model.table.find(t => t.teamId === primary.id);
          if (meRow) statLine = { label: 'KREISLIGA A', value: `#${meRow.rank}`, sub: `${meRow.points} pts` };
          const nf = await getNextFixtureForTeam(db, primary.id);
          if (nf) { upcoming = { title: `${club.name} vs ${nf.opp}`, eventId: nf.eventId, date: nf.date, access: nf.access, ticketUrl: nf.ticketUrl, streamUrl: nf.streamUrl }; notice = `[Notice] Matchday: ${club.name} vs ${nf.opp} — ${nf.date ?? 'soon'}.`; attendance = guest ? null : await getAttendance(db, viewer, nf.eventId); }
        }
        const cp = await getLatestPost(db, 'club', m[1]);
        return html(res, renderEntityProfile({
          kindLabel: 'Club', entityId: m[1], isFollowing: (guest ? false : await isFollowing(db, viewer, 'club', m[1])), guest, fanId: guest ? null : viewer, name: club.name, nickname: club.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Shop', shop: true }],
          statLine, notice, post: cp ? { author: club.name, body: cp.body, date: cp.date } : undefined,
          upcoming, attendance, tableHtml, merch: true, backHref: '/', editAction: `/entity/club/${m[1]}/branding`, customizeHref: `/club/${m[1]}/customize`, canEdit: await canEdit('club', m[1]),
          ogTags: ogMeta({ title: `${club.name} on Horda`, description: brand.tagline || `Follow ${club.name} on Horda — matchdays, members-only news and tickets.`, url: `${origin}/club/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('club', m[1])) ? renderChecklist(await entityChecklist(db, 'club', m[1])) : '',
          events: await withMine(db, viewerGuest ? null : viewer, await listProfileEvents(db, 'club', m[1])), scheduleHref: `/host/club/${m[1]}/new`,
          members: { title: 'Teams', items: teams.map(t => ({ kind: 'team', label: t.name + (t.division ? ` · ${t.division}` : ''), href: `/team/${t.id}`, tag: t.gender || undefined })) },
        }));
      }
      if ((m = path.match(/^\/team\/([^/]+)$/))) {
        const guest = viewerGuest;
        const team = await getTeam(db, m[1]);
        if (!team) return html(res, '<p>Not found</p>', 404);
        const brand = await getBranding(db, 'team', m[1]);
        const roster = await getRoster(db, m[1]);
        const model = await getClubPage(db, m[1], FOOTBALL_TABLE);
        const tableHtml = tableDark('League table', model.table.map(t => ({ rank: t.rank, team: t.team, played: t.played, wins: t.wins, draws: t.draws, losses: t.losses, goalDiff: t.goalDiff, points: t.points, me: t.teamId === m![1] })));
        const meRow = model.table.find(t => t.teamId === m![1]);
        const statLine = meRow ? { label: 'KREISLIGA A', value: `#${meRow.rank}`, sub: `${meRow.points} pts` } : undefined;
        const nf = await getNextFixtureForTeam(db, m[1]);
        const upcoming = nf ? { title: `${team.name} vs ${nf.opp}`, eventId: nf.eventId, date: nf.date, access: nf.access, ticketUrl: nf.ticketUrl, streamUrl: nf.streamUrl } : null;
        const attendance = (!guest && nf) ? await getAttendance(db, viewer, nf.eventId) : null;
        return html(res, renderEntityProfile({
          kindLabel: 'Team', entityId: m[1], isFollowing: (guest ? false : await isFollowing(db, viewer, 'team', m[1])), guest, fanId: guest ? null : viewer, name: team.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          parent: { label: team.club_name, href: `/club/${team.club_id}` },
          about: `${team.sport} · ${[team.division, team.gender].filter(Boolean).join(' · ')}`,
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Shop', shop: true }],
          statLine, notice: nf ? `[Notice] Next match: ${team.name} vs ${nf.opp} — ${nf.date ?? 'soon'}.` : '',
          upcoming, attendance, tableHtml, merch: true, backHref: `/club/${team.club_id}`, editAction: `/entity/team/${m[1]}/branding`, customizeHref: `/team/${m[1]}/customize`, canEdit: await canEdit('team', m[1]),
          ogTags: ogMeta({ title: `${team.name} on Horda`, description: brand.tagline || `Follow ${team.name} on Horda — matchdays, members-only news and tickets.`, url: `${origin}/team/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('team', m[1])) ? renderChecklist(await entityChecklist(db, 'team', m[1])) : '',
          events: await withMine(db, viewerGuest ? null : viewer, await listProfileEvents(db, 'team', m[1])), scheduleHref: `/host/team/${m[1]}/new`,
          members: { title: 'Squad', items: roster.map(p => ({ kind: 'athlete', label: p.name, href: `/athlete/${p.id}`, tag: p.handle ? '@' + p.handle : undefined })) },
        }));
      }
      if ((m = path.match(/^\/association\/([^/]+)$/))) {
        const guest = viewerGuest;
        const assoc = await getAssociation(db, m[1]);
        if (!assoc) return html(res, '<p>Not found</p>', 404);
        const brand = await getBranding(db, 'association', m[1]);
        const leagues = await getAssociationLeagues(db, m[1]);
        const clubs = await getAssociationClubs(db, m[1]);
        return html(res, renderEntityProfile({
          kindLabel: 'Association', entityId: m[1], isFollowing: (guest ? false : await isFollowing(db, viewer, 'association', m[1])), guest, fanId: guest ? null : viewer, name: assoc.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          about: brand.tagline ?? undefined,
          tabs: [{ label: 'Highlight' }, { label: 'Members' }, { label: 'Competitions' }, { label: 'Notice' }],
          statLine: { label: 'MEMBER CLUBS', value: String(clubs.length), sub: 'in sanctioned leagues' },
          notice: `[Notice] ${assoc.name} sanctions ${leagues.length} competition(s).`,
          merch: false, backHref: '/', editAction: `/entity/association/${m[1]}/branding`, customizeHref: `/association/${m[1]}/customize`, canEdit: await canEdit('association', m[1]),
          ogTags: ogMeta({ title: `${assoc.name} on Horda`, description: brand.tagline || `${assoc.name} on Horda — the home for its clubs, competitions and fans.`, url: `${origin}/association/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('association', m[1])) ? renderChecklist(await entityChecklist(db, 'association', m[1])) : '',
          events: await withMine(db, viewerGuest ? null : viewer, await listProfileEvents(db, 'association', m[1])), scheduleHref: `/host/association/${m[1]}/new`,
          members: { title: 'Member clubs', items: clubs.map(c => ({ kind: 'club', label: c.name, href: `/club/${c.id}` })) },
          secondary: { title: 'Competitions', items: leagues.map(l => ({ kind: 'league', label: l.name, href: '#' })) },
        }));
      }
      html(res, '<p>Not found. <a href="/">Home</a></p>', 404);
    } catch (e: any) {
      // Report to the configured sink (webhook/Sentry/stderr), then show the user
      // a calm branded page — never a raw stack trace.
      reportError(e, { where: 'request', method: req.method, path: (req.url || '').split('?')[0] });
      try { html(res, errorPage(), 500); } catch { res.writeHead(500); res.end('Internal error'); }
    }
  });
}

// start a fully-seeded instance; returned by tests and by `node src/web/server.ts`
// reconstruct ids from an already-seeded (persistent) DB so restarts don't re-seed
async function loadDemoIds(db: Database): Promise<DemoIds> {
  const one = async (s: string, p: any[] = []) => (await db.query<any>(s, p)).rows[0];
  const many = async (s: string, p: any[] = []) => (await db.query<any>(s, p)).rows;
  const demoAccountId = (await one(`SELECT id FROM account WHERE email='demo@horda.app'`))?.id;
  const fanId = (await one(`SELECT id FROM fan WHERE account_id=$1 LIMIT 1`, [demoAccountId]))?.id;
  const athletes = (await many(`SELECT id, display_name name FROM athlete ORDER BY created_at LIMIT 2`)).map(a => ({ id: a.id, name: a.name }));
  const clubs = (await many(`SELECT id, name FROM club ORDER BY created_at LIMIT 1`)).map(c => ({ id: c.id, name: c.name }));
  const teams = (await many(`SELECT id, name FROM team ORDER BY created_at LIMIT 1`)).map(t => ({ id: t.id, name: t.name }));
  const assoc = await one(`SELECT id, name FROM association LIMIT 1`);
  const football = (await one(`SELECT id FROM sport WHERE key='football'`))?.id;
  const v11 = (await one(`SELECT v.id FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='11_a_side'`))?.id;
  return { fanId, demoAccountId, athletes, clubs, teams, association: { id: assoc?.id, name: assoc?.name }, football, v11 } as DemoIds;
}

export async function startServer(port = Number(process.env.PORT ?? 8787)): Promise<{ server: Server; db: Database; ids: DemoIds; port: number; close: () => Promise<void> }> {
  // Last line of defense: never let a stray async error (e.g. a late DB socket
  // drop) crash the whole web process and blank every page. Log loudly instead.
  process.on('unhandledRejection', (r) => reportError(r, { where: 'unhandledRejection' }));
  process.on('uncaughtException', (e) => reportError(e, { where: 'uncaughtException' }));
  const db = await openDatabase();   // DATABASE_URL → server Postgres (prod); else embedded PGlite (HORDA_DATA persists)
  const fresh = (await db.query<{ r: string | null }>(`SELECT to_regclass('public.account')::text r`)).rows[0].r === null;
  const pending = await applySchema(db);   // ALWAYS apply pending migrations (new + existing DBs alike)
  if (pending.length) console.log(`[migrations] applied: ${pending.join(', ')}`);
  // Seed the demo content ONLY when the demo fallback is on. In production
  // (HORDA_DEMO=0) a fresh database must come up EMPTY — otherwise wiping the DB
  // to clear seed data just re-creates the fake clubs on the next boot, which is
  // exactly the trap we hit on joinhorda.com. Tests don't set HORDA_DEMO, so they
  // still seed as before.
  const demoOn = process.env.HORDA_DEMO !== '0';
  const ids = (fresh && demoOn) ? await seedDemo(db) : await loadDemoIds(db);   // seed once; reuse on restart
  const server = await buildApp(db, ids);
  await new Promise<void>(r => server.listen(port, r));
  const addr = server.address();
  const realPort = typeof addr === 'object' && addr ? addr.port : port;
  return { server, db, ids, port: realPort, close: async () => { await new Promise<void>(r => server.close(() => r())); await db.close(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port, ids } = await startServer();
  console.log(`Horda running → http://localhost:${port}`);
  console.log(`  /                     home`);
  // These demo deep-links only exist when seeded (HORDA_DEMO!=0). On an empty
  // production DB there is no demo content, so guard every deref — a fresh,
  // demo-off boot must start cleanly, not crash on ids.athletes[0].
  if (ids.fanId) console.log(`  /fan/${ids.fanId}     your feed`);
  if (ids.athletes?.[0]) console.log(`  /athlete/${ids.athletes[0].id}  the idol`);
  if (ids.clubs?.[0]) console.log(`  /club/${ids.clubs[0].id}        the club`);
}
