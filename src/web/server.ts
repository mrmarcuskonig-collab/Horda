// server.ts — a tiny zero-dependency SSR web app over the DB + engagement repo.
// Routes are thin: assemble data, render a page. Structured to lift into Next.js
// route handlers later (each handler is already a pure data->HTML function).
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { oauthProviders, authUrl as oauthAuthUrl, exchange as oauthExchange, isEnabled as oauthEnabled } from './oauth.ts';
import { renderAbout, renderAboutCreators, renderAboutFeatures, renderAboutPricing } from './pitch.ts';
import { openDatabase, applySchema } from '../db/index.ts';
import type { Database } from '../db/index.ts';
import { getClubPage } from '../db/repo.ts';
import {
  getAthleteProfile, getFanHome, getFollows, getUpcomingBout, getPrediction,
  followEntity, unfollowEntity, makePrediction, attend, getAttendance, getAffiliations, getLatestPost, setAthleteProfile, createAthlete, createPost,
} from '../db/engagement_repo.ts';
import {
  getBranding, setBranding, getClub, getTeamsOfClub, getTeam, getRoster,
  getAssociation, getAssociationLeagues, getAssociationClubs, getNextFixtureForTeam,
} from '../db/entity_repo.ts';
import { renderEntityProfile, tableDark } from './shell.ts';
import { FAVICON_SVG } from './brand.ts';
import { buildResultShare, buildFightShare, buildWeekDrop } from '../content/index.ts';
import { createScheduledEvent, rsvp, getRsvp, getEventDetail, getGuestList, listUpcomingByHost, listProfileEvents, hostName, icsFor, approveRegistration, markPaid, featureEvent, getTicketFor, giftTicket, listTicket, getListings, buyListing, priceLabel, getOrCreateShareToken, recordShareClick, shareAttribution, addParty, listParties, claimSide, removeParty, recordPromoClick, subEvents, parentOf, partyAttribution, myParty } from '../db/events_repo.ts';
import { getTier, getTiers, setTier, joinMembership, cancelMembershipBySub, getMembership, memberCount, recordLoyalty, loyaltyScore, isSuperfan, topSuperfans, type TierLevel } from '../db/membership_repo.ts';
import { signup, verifyLogin, createSession, sessionAccount, deleteSession, fanForAccount, owns, ownedEntities, grantOwnership, accountRole, setOnboarded, upsertOauthAccount, createPasswordReset, resetPassword, activateCreatorLayer, setBirthYear, accountFlags, isAdultYear, startLogin, consumeLogin } from '../db/auth_repo.ts';
import { getDiscover, REGIONS } from '../db/discover_repo.ts';
import { renderEventPage, renderCreateEvent, renderManage, renderCheckout, renderPayouts } from './events.ts';
import { seedDemo, type DemoIds } from './seed.ts';
import { renderIndex, renderDiscover, renderMap, renderAthletePage, renderCustomize, renderCompose, renderFanHome, renderSignup, renderLogin, renderForgot, renderReset, renderSharePage, renderMemberWelcome, renderClaimPending, renderClaimQueue, renderOnboardFan, renderAiPrompt, renderProfilePreview, renderOnboardClaim, renderCreatorEntry, renderClaimHandle, sportsLabel, renderSettings, renderPros, renderCreatePicker, renderCreateAge, renderMagicSent, renderFollowing } from './pages.ts';
import { getEmailer, resetEmail, loginEmail } from './email.ts';
import { ogMeta } from './layout.ts';
import { storeImage } from './storage.ts';
import { fanChecklist, athleteChecklist, entityChecklist, renderChecklist } from './activation.ts';
import { getAthleteSport, setAthleteSport, getAthleteSports, setAthleteSports, getAthleteLayout, setAthleteLayout, createFeatureRequest, getAthleteTheme, setAthleteTheme } from '../db/layout_repo.ts';
import { parseTheme, serializeTheme, autoContrast, bannerSvg, svgDataUri, THEME_PRESETS, defaultThemeForSport, renderThemeStudio, type ThemeSpec } from './theme_engine.ts';
import { listMedia, addMedia, deleteMedia, listSponsors, addSponsor, deleteSponsor, subscribeNewsletter, reserveHandle, getBannerStyle, setBannerStyle, listShopItems, addShopItem, deleteShopItem } from '../db/extras_repo.ts';
import { track, conversionRate, metricCounts, defaultRoomLabel, roomState, setRoomConfig, setResult, getRoomConfig, listRoomMessages, postRoomMessage, canSeeLiveRoom, createGoal, listGoals, activeGoalProgress, getGoal, maybeGoalSignup, trackConversion, roomPresence } from '../db/hook_repo.ts';
import { renderEventRoom, renderMediaStudio, renderInsights, goalBar } from './hook_web.ts';
import { spotsInfo, getClaim, createClaim, getPass, verifyPass, fanRecord, recordCount, crowdStanding, grantConsent, feedDoors, recentPresence } from '../db/claim_rail_repo.ts';
import { listFormats, addFormat, formatCounts, setClaimFormat, getFormat } from '../db/event_format_repo.ts';
import { notify, listNotifications, unreadCount, markAllRead } from '../db/notif_repo.ts';
import { parseSeasonLines, shiftDate } from '../db/events_repo.ts';
import { renderNotifications, renderConnections } from './pages.ts';
import { formatPicker } from './claim_web.ts';
import { requestLink, setLinkStatus, getLink, activeParents, parentsOf, childrenOf } from '../db/connection_repo.ts';
import { renderPass, renderRecord, renderCheckin, claimCta } from './claim_web.ts';
import { actionBar } from './theme.ts';
import { normLang } from './i18n.ts';
import { generateEventAssets, eventGraphic, supporterCard } from './mediagen.ts';
import { resolveLayout } from './sections.ts';
import { generateProfile, getModel, coverDataUri } from './profilegen.ts';
import { requestClaim, verifyByChannelCode, listClaimsForReviewer, decideClaim, officialDomain, isAdmin as accountIsAdmin, type ClaimKind } from '../db/claim_repo.ts';
import { getPayments, verifyWebhook } from './payments.ts';
import { getPayoutAccount, upsertPayoutAccount, setPayoutStatus, isPayoutsEnabled } from '../db/payouts_repo.ts';

const payments = getPayments();
const TAKE_RATE = 0.10;   // Horda's flat 10% platform fee on paid tickets (locked)

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
      // --- identity: resolve the session account (demo fallback keeps it usable without login) ---
      const cookies = parseCookies(req.headers.cookie);
      // Language: an explicit cookie wins; otherwise default by region — German for
      // the DACH area (via CDN country header, else Accept-Language), English elsewhere.
      const lang = (cookies.hz_lang === 'de' || cookies.hz_lang === 'en') ? cookies.hz_lang : defaultLangFor(req.headers);
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
        const f = await parseForm(req);
        const next = f.next || '';
        // everyone signs up as a person (fan by default); the creator entrance routes via ?next
        const role = next.includes('/onboarding/athlete') ? 'athlete' : next.includes('/onboarding/claim') ? 'club' : 'fan';
        const r = await signup(db, (f.email || '').toLowerCase().trim(), f.name || 'Fan', f.password || '', role);
        if (!r) return redirect(res, '/login');
        // auto-follow the sport/region the guest was filtering (their filter → their feed)
        const filt = f.sport || f.region ? `${f.sport || ''}|${f.region || ''}` : (cookies.hz_filter ? decodeURIComponent(cookies.hz_filter) : '');
        if (filt) { const [sp, rg] = filt.split('|'); if (sp) await db.query(`INSERT INTO fan_interest (fan_id,kind,value) VALUES ($1,'sport',$2) ON CONFLICT DO NOTHING`, [r.fanId, sp]); if (rg) await db.query(`INSERT INTO fan_interest (fan_id,kind,value) VALUES ($1,'region',$2) ON CONFLICT DO NOTHING`, [r.fanId, rg]); }
        // §1b: /pros (athlete-intent) auto-activates the creator layer, unverified
        // until light verification (Featured is gated on verified). Club-invite path
        // pre-verifies (the club vouches). Plain fans get a base account only.
        if (f.intent === 'pro' || next.includes('/onboarding/athlete')) await activateCreatorLayer(db, r.accountId, f.invited === '1');
        const token = await createSession(db, r.accountId);
        let dest = (next && next !== '/') ? next : '/onboarding/fan';
        // carry a "follow this creator" intent (from a Follow CTA) into the follow picker
        if (f.follow && (dest === '/onboarding/fan' || dest.startsWith('/onboarding/fan'))) dest = `/onboarding/fan?follow=${encodeURIComponent(f.follow)}`;
        res.writeHead(303, { 'set-cookie': sessionCookie(token), location: dest }); res.end(); return;
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
        // §1a 18+ gate: a person-level Creathor page requires 18+ (base accounts are exempt).
        const by = Number(f.birth_year);
        if (Number.isFinite(by)) await setBirthYear(db, account.id, by);
        const flags = await accountFlags(db, account.id);
        if (!isAdultYear(Number.isFinite(by) ? by : flags.birthYear)) {
          return html(res, renderAiPrompt({ title: 'Create my page', lead: 'Athlete pages on Horda are for people 18 or older. Youth athletes appear only under their club, without names. Enter your birth year to continue.', placeholder: 'Describe yourself in a sentence…', generateAction: '/onboarding/athlete/generate', hidden: '', back: '/', altLink: '' }));
        }
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
        await activateCreatorLayer(db, account.id, flags.creatorVerified);   // publishing = you're a Creathor
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
        // reusable args so recurrence + season children are identical to the base
        const baseArgs = {
          hostKind: f.host_kind as any, hostId: f.host_id, title: f.title || 'Untitled event',
          startsAt: f.starts_at || new Date().toISOString(), location: f.location, description: f.description,
          coverUrl, admission: (f.admission as any) || 'open',
          priceCents: f.price ? Math.round(Number(f.price) * 100) : undefined, streams,
          capacity: f.capacity ? Number(f.capacity) : undefined,
          locationKind: f.location_kind, accessMode: f.access_mode,
          archetype: ['single', 'versus', 'multi'].includes(f.archetype) ? f.archetype : 'single',
        };
        // Attendance formats (multi-format): in-person (ticketed on Horda) + up to
        // two streams (e.g. TikTok Live, a media provider). Every format's
        // attendance is confirmed on Horda → clean per-format organizer counts.
        const toCents = (s?: string) => { const v = parseFloat((s || '').replace(',', '.')); return isFinite(v) && v > 0 ? Math.round(v * 100) : null; };
        const specs: { kind: string; label: string; channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; capacity: number | null }[] = [];
        if (f.fmt_inperson === '1') { const p = toCents(f.fmt_inperson_price); specs.push({ kind: 'in_person', label: 'In person', channelUrl: null, requiresTicket: !!p, priceCents: p, capacity: f.fmt_inperson_cap ? Number(f.fmt_inperson_cap) : null }); }
        for (const [lab, u] of [[f.fmt_stream1_label, f.fmt_stream1_url], [f.fmt_stream2_label, f.fmt_stream2_url]] as [string, string][]) {
          if ((u || '').trim()) specs.push({ kind: 'stream', label: (lab || 'Live stream').trim(), channelUrl: u.trim(), requiresTicket: false, priceCents: null, capacity: null });
        }
        const applyFormats = async (evId: string) => { let i = 0; for (const s of specs) await addFormat(db, { eventId: evId, sort: i++, ...s }); };

        const parentId = (f.parent_id || '').trim() || undefined;
        const id = await createScheduledEvent(db, { ...baseArgs, recurrence: f.recurrence, parentEventId: parentId });
        await applyFormats(id);
        // Multi-party spine: the host is always an organizer; versus events get two
        // sides (side A = host, side B = an unclaimed rival to be claimed by joining);
        // an optional roster of attending athletes seeds unclaimed slots. Every party
        // auto-gets a promo link. Measurement only — no money moves.
        await addParty(db, { eventId: id, role: 'organizer', entityKind: f.host_kind, entityId: f.host_id, status: 'accepted' });
        if (baseArgs.archetype === 'versus') {
          await addParty(db, { eventId: id, role: 'side', side: 'A', entityKind: f.host_kind, entityId: f.host_id, status: 'accepted' });
          const sideB = (f.side_b_name || '').trim();
          if (sideB) await addParty(db, { eventId: id, role: 'side', side: 'B', placeholder: sideB, status: 'unclaimed' });
        }
        for (const nm of (f.roster || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)) {
          await addParty(db, { eventId: id, role: 'attending_athlete', placeholder: nm, status: 'unclaimed' });
        }
        // Event Room config (Build Order #3) — extends the event, no parallel system.
        if (f.room_enabled === '1') {
          const sport = f.host_kind === 'athlete' ? await getAthleteSport(db, f.host_id) : null;
          await setRoomConfig(db, id, { enabled: true, label: (f.room_label || '').trim() || defaultRoomLabel(sport), tier: f.room_tier || 'supporter' });
          await track(db, 'event_room_open', { ownerKind: f.host_kind, ownerId: f.host_id, eventId: id, props: { tier: f.room_tier || 'supporter' } });
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
      if (req.method === 'POST' && path === '/join') {
        const f = await parseForm(req);
        const level: TierLevel = f.level === 'clubhouse' ? 'clubhouse' : 'supporter';
        const billing = f.billing === 'annual' ? 'annual' : 'monthly';
        const tier = await getTier(db, f.owner_kind, f.owner_id, level);
        const amount = tier ? (billing === 'annual' ? (tier.priceAnnualCents ?? tier.priceCents * 10) : tier.priceCents) : 0;
        if (payments.enabled && tier && amount > 0) {
          const nm = await hostName(db, f.owner_kind, f.owner_id);
          const back = f.owner_kind === 'athlete' ? `/athlete/${f.owner_id}` : f.owner_kind === 'team' ? `/team/${f.owner_id}` : f.owner_kind === 'association' ? `/association/${f.owner_id}` : `/club/${f.owner_id}`;
          const { url } = await payments.createCheckout({
            mode: 'subscription', amountCents: amount, currency: tier.currency || 'EUR',
            interval: billing === 'annual' ? 'year' : 'month',
            productName: `${tier.name} (${level}) · ${nm}`,
            successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}${back}`,
            metadata: { kind: 'membership', owner_kind: f.owner_kind, owner_id: f.owner_id, fan_id: viewer, tier_level: level, billing },
          });
          return redirect(res, url);
        }
        await joinMembership(db, viewer, f.owner_kind, f.owner_id, level, payments.enabled ? billing : (amount > 0 ? billing : 'free'));
        await trackConversion(db, f.owner_kind, f.owner_id, viewer);
        return redirect(res, `/member/${f.owner_kind}/${f.owner_id}`);
      }
      if (req.method === 'POST' && path === '/ticket/gift') {
        const f = await parseForm(req); await giftTicket(db, f.ticket_id, f.to_handle || '');
        return redirect(res, `/e/${f.event_id}`);
      }
      if (req.method === 'POST' && path === '/ticket/list') {
        const f = await parseForm(req); await listTicket(db, f.ticket_id, Math.round(Number(f.price || 0) * 100));
        return redirect(res, `/e/${f.event_id}`);
      }
      if (req.method === 'POST' && path === '/ticket/buy') {
        const f = await parseForm(req); await buyListing(db, f.ticket_id, viewer);
        return redirect(res, `/e/${f.event_id}`);
      }
      let mm;
      if ((mm = path.match(/^\/member\/(athlete|club|team|association)\/([^/]+)$/))) {
        const mem = await getMembership(db, viewer, mm[1], mm[2]);
        const tier = await getTier(db, mm[1], mm[2]);
        const name = await hostName(db, mm[1], mm[2]);
        const href = mm[1] === 'athlete' ? `/athlete/${mm[2]}` : mm[1] === 'team' ? `/team/${mm[2]}` : mm[1] === 'association' ? `/association/${mm[2]}` : `/club/${mm[2]}`;
        return html(res, renderMemberWelcome({ name, tierName: tier?.name ?? 'Membership', memberNo: mem?.memberNo ?? 1, href }));
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
          const feeCents = Math.round((d?.priceCents ?? 0) * TAKE_RATE);
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
            else if (m.kind === 'membership' && m.fan_id) { await joinMembership(db, m.fan_id, m.owner_kind, m.owner_id, (m.tier_level as TierLevel) || 'supporter', m.billing || 'monthly', subId); await trackConversion(db, m.owner_kind, m.owner_id, m.fan_id); }
          } else if (event.type === 'customer.subscription.deleted') {
            const sub = event.data?.object ?? {};
            if (sub.id) await cancelMembershipBySub(db, sub.id);
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
          if (m.kind === 'membership' && m.fan_id) { await joinMembership(db, m.fan_id, m.owner_kind, m.owner_id, (m.tier_level as TierLevel) || 'supporter', m.billing || 'monthly', sess.subscriptionId); await trackConversion(db, m.owner_kind, m.owner_id, m.fan_id); return redirect(res, `/member/${m.owner_kind}/${m.owner_id}`); }
        }
        return redirect(res, '/');
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
      // Claim a spot. Account folds into the claim: a guest supplies name +
      // contact and gets a passwordless base account (passkey lands with Wallet).
      if (req.method === 'POST' && (em = path.match(/^\/claim\/([^/]+)$/))) {
        const eid = em[1];
        const d = await getEventDetail(db, eid);
        if (!d) return redirect(res, '/');
        const f = await parseForm(req);   // parse once — carries format_id and guest fields
        const formatId = f.format_id || null;
        let claimFan = viewer, claimAcct = account?.id ?? null;
        if (viewerGuest) {
          const contact = (f.contact || '').trim().toLowerCase();
          if (!f.name || !contact) return redirect(res, `/e/${eid}`);
          const email = contact.includes('@') ? contact : `${contact.replace(/[^0-9+]/g, '')}@phone.horda`;
          const r = await upsertOauthAccount(db, email, f.name);   // passwordless base account
          claimAcct = r.accountId; claimFan = r.fanId ?? (await fanForAccount(db, r.accountId)) ?? viewer;
          const token = await createSession(db, r.accountId);
          res.setHeader('set-cookie', sessionCookie(token));
        }
        // price comes from the chosen format (in-person ticket) if any, else event-level.
        let priceCents: number | null = d.admission === 'paid' ? d.priceCents : null;
        let fmtLabel = '';
        if (formatId) { const fmt = await getFormat(db, formatId); if (fmt) { priceCents = fmt.requiresTicket ? (fmt.priceCents ?? null) : null; fmtLabel = fmt.label; } }
        const evRow = (await db.query<any>(`SELECT capacity, registration_mode FROM event WHERE id=$1`, [eid])).rows[0];
        // Attribution: a participant promo link (?p=) takes precedence over a fan
        // share (?via=). source_edge is what the attribution roll-ups count.
        const promo = url.searchParams.get('p');
        const via = url.searchParams.get('via');
        const sourceEdge = promo ? `party:${promo}` : via ? `via:${via}` : 'direct';
        const cl = await createClaim(db, { eventId: eid, fanId: claimFan, capacity: evRow?.capacity ?? null, mode: evRow?.registration_mode ?? 'open', priceCents, sourceEdge });
        if (formatId) await setClaimFormat(db, cl.id, formatId);
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
      }
      if ((em = path.match(/^\/pass\/([^/]+)$/))) {
        const p = await getPass(db, em[1]);
        if (!p) return html(res, '<p>Pass not found. <a href="/">Home</a></p>', 404);
        return html(res, renderPass({ pass: p, verifyUrl: `${origin}/pass/${em[1]}`, guest: viewerGuest, fanId: viewerGuest ? null : viewer }));
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
        if (viewerGuest) return redirect(res, '/login');
        return html(res, renderRecord({ fanId: viewer, name: account?.displayName || 'You', rows: await fanRecord(db, viewer), count: await recordCount(db, viewer) }));
      }
      if (path === '/notifications') {
        if (viewerGuest) return redirect(res, '/login');
        const items = await listNotifications(db, viewer);
        await markAllRead(db, viewer);   // opening the page clears the unread badge
        return html(res, renderNotifications({ fanId: viewer, createHref: viewerCreateHref, items }));
      }
      // --- entity connections (athlete↔club↔league) --------------------------
      if ((em = path.match(/^\/(athlete|club)\/([^/]+)\/connections$/))) {
        if (viewerGuest) return redirect(res, '/login');
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
        if (viewerGuest) return redirect(res, '/login');
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
        if (viewerGuest) return redirect(res, '/login');
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
        const canLive = await canSeeLiveRoom(db, viewerGuest ? null : viewer, d.hostKind ?? '', d.hostId ?? '', rc.tier, isOwner);
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
        const canLive = await canSeeLiveRoom(db, viewer, d.hostKind ?? '', d.hostId ?? '', rc?.tier ?? 'supporter', isOwner);
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
        return html(res, renderMediaStudio({ eventId: em[1], athleteId: d.hostId ?? '', title: d.title, label: rc?.label || brief.label, hasResult: !!rc?.result, assets }));
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
      if ((em = path.match(/^\/e\/([^/]+)$/))) {
        const guest = viewerGuest;
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, '<p>Event not found. <a href="/">Home</a></p>', 404);
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
        const rc = await getRoomConfig(db, em[1]);
        const roomCta = rc?.enabled ? `<div class="card" style="border-color:var(--bone)"><strong>${esc(rc.label || 'Event Room')}</strong> — countdown, live reactions and the host's behind-the-scenes.<div class="row" style="margin-top:8px"><a class="btn" href="/e/${em[1]}/room">Enter the ${esc(rc.label || 'room')} →</a></div></div>` : '';
        // The claim rail (the pivot): the primary CTA on every event is "Claim your spot".
        const evRow = (await db.query<any>(`SELECT capacity, registration_mode, standing_threshold FROM event WHERE id=$1`, [em[1]])).rows[0];
        const spots = await spotsInfo(db, em[1], evRow?.capacity ?? null);
        const mineClaim = guest ? null : await getClaim(db, em[1], viewer);
        let minePass: { status: string; token: string } | null = null;
        if (mineClaim) { const pv = (await db.query<{ token: string }>(`SELECT token FROM pass WHERE claim_id=$1`, [mineClaim.id])).rows[0]; minePass = { status: mineClaim.status, token: pv?.token ?? '' }; }
        const standHave = (!guest && d.hostKind) ? await crowdStanding(db, viewer, d.hostKind, d.hostId!) : 0;
        // Multi-format: if the organizer offered formats, fans pick how they'll attend.
        const evFormats = await formatCounts(db, em[1]);
        const mineFormatId = mineClaim ? ((await db.query<{ format_id: string | null }>(`SELECT format_id FROM claim WHERE id=$1`, [mineClaim.id])).rows[0]?.format_id ?? null) : null;
        const claimBlock = isHost
          ? `<div class="card"><strong>You host this.</strong><div class="row" style="margin-top:8px"><a class="btn" href="/e/${em[1]}/check-in">Open check-in →</a><a class="btn ghost" href="/manage/${em[1]}">Manage &amp; attendance →</a></div></div>`
          : evFormats.length
            ? formatPicker({ eventId: em[1], guest, full: spots.full, fanId: guest ? null : viewer, via: viaTok, promo: promoTok, formats: evFormats, mine: minePass ? { status: minePass.status, token: minePass.token, formatId: mineFormatId } : null })
            : claimCta({ eventId: em[1], remaining: spots.remaining, full: spots.full, mine: minePass, guest, priceLabel: d.admission === 'paid' ? priceLabel(d) : 'Free', mode: evRow?.registration_mode ?? 'open', accessMode: d.accessMode, via: viaTok, promo: promoTok, standing: { have: standHave, need: evRow?.standing_threshold ?? 0 } });
        // Persistent primary-action bar (the IG/TikTok pattern) — scarcity + one tap.
        const barSub = spots.remaining == null ? (d.admission === 'paid' ? priceLabel(d) : 'Free') : (spots.full ? 'Full — join the waitlist' : `${spots.remaining} spot${spots.remaining === 1 ? '' : 's'} left${d.admission === 'paid' ? ' · ' + priceLabel(d) : ''}`);
        const stickyCta = isHost
          ? actionBar({ title: d.title, sub: `${spots.claimed} claimed`, cta: `<a class="btn" href="/e/${em[1]}/check-in">Check-in</a>` })
          : minePass
            ? actionBar({ title: "You're in", sub: minePass.status === 'waitlisted' ? 'On the waitlist' : 'Pass ready', cta: `<a class="btn" href="/pass/${minePass.token}">View pass</a>` })
            : actionBar({ title: d.title, sub: barSub, cta: `<a class="btn" href="#claim">${spots.full ? 'Join waitlist' : 'Claim your spot'}</a>` });
        // Past events: the door is closed. Replace the claim rail with a clear note
        // (the event still lives on host/co-host/sharer profiles under "Past").
        const ended = !!d.startsAt && Date.now() >= new Date(d.startsAt).getTime() + 3 * 3600 * 1000;
        const pastCard = `<div class="card"><strong>This event is in the past.</strong> <span class="mut">Claims are closed.${minePass ? ` You can still view your pass.` : ''}</span>${minePass ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="/pass/${minePass.token}">View your pass</a></div>` : ''}${isHost ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="/manage/${em[1]}">See who came →</a></div>` : ''}</div>`;
        const topBlock = ended ? pastCard + roomCta : claimBlock + roomCta;
        const barBlock = ended ? '' : stickyCta;
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
        const canClaim = !guest && myEntities.length > 0;
        // A participant sees their own promo link + draw.
        const mine = guest ? null : await myParty(db, em[1], myEntities);
        const myPromoToken = mine?.promoToken ?? null;
        const myPromoDraw = myPromoToken ? (await partyAttribution(db, em[1])).rows.find(r => r.token === myPromoToken) : undefined;
        return html(res, renderEventPage(d, { guest, fanId: guest ? null : viewer, myRsvp, isHost, myEntities, myTicket, listings, extraTop: topBlock, stickyCta: barBlock, hasAccess, shareRef, hostLinks, parties, subs, parent, canClaim, myPromoToken, myPromoDraw: myPromoDraw ? { identities: myPromoDraw.identities, ticketBuyers: myPromoDraw.ticketBuyers } : undefined }));
      }
      if ((em = path.match(/^\/manage\/([^/]+)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);  // guest list is owner-only
        const payoutAcct = (d.hostKind && d.hostId) ? await getPayoutAccount(db, d.hostKind, d.hostId) : null;
        return html(res, renderManage(d, await getGuestList(db, em[1]), await formatCounts(db, em[1]), await shareAttribution(db, em[1]), await partyAttribution(db, em[1]), (d.hostKind && d.hostId) ? { hostKind: d.hostKind, hostId: d.hostId, connected: !!payoutAcct?.chargesEnabled } : undefined));
      }
      if ((em = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/new$/))) {
        const parentId = url.searchParams.get('parent');
        const pe = parentId ? await getEventDetail(db, parentId) : null;
        const parent = pe ? { id: pe.id, title: pe.title } : undefined;
        return html(res, renderCreateEvent(em[1], em[2], await hostName(db, em[1], em[2]), parent));
      }
      // Multi-party: claim an unclaimed side/roster slot (the two-sided growth loop).
      const pmClaim = path.match(/^\/e\/([^/]+)\/party\/([^/]+)\/claim$/);
      if (req.method === 'POST' && pmClaim) {
        if (viewerGuest || !account) return redirect(res, `/signup?next=/e/${pmClaim[1]}`);
        const f = await parseForm(req);
        const owned = await ownedEntities(db, account.id);
        const pick = (f.entity_kind && f.entity_id) ? owned.find(o => o.kind === f.entity_kind && o.id === f.entity_id) : owned[0];
        if (pick) await claimSide(db, pmClaim[2], pick.kind, pick.id);
        return redirect(res, `/e/${pmClaim[1]}`);
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

      if (req.method === 'POST' && path === '/attend') {
        const f = await parseForm(req);
        await attend(db, f.fan_id, f.event_id, (f.mode as any) ?? 'going');
        await loyaltyForEvent(f.fan_id, f.event_id, 'rsvp');
        return redirect(res, req.headers.referer ?? '/');
      }
      if (path === '/about') return html(res, renderAbout(viewerGuest));
      if (path === '/about/creators') return html(res, renderAboutCreators(viewerGuest));
      if (path === '/about/features') return html(res, renderAboutFeatures(viewerGuest));
      if (path === '/about/pricing') return html(res, renderAboutPricing(viewerGuest));
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
      // Owns pages → pick which hosts it; owns none → spin up a personal page (18+).
      if (path === '/create' || (req.method === 'POST' && path === '/create')) {
        if (viewerGuest || !account) return redirect(res, '/signup?next=/create');
        const hostable = await ownedEntities(db, account.id);
        // POST = they just submitted the one-time birth-year check to create a personal page.
        if (req.method === 'POST') {
          const f = await parseForm(req);
          const by = Number(f.birth_year);
          if (Number.isFinite(by)) await setBirthYear(db, account.id, by);
          const flags = await accountFlags(db, account.id);
          if (!isAdultYear(Number.isFinite(by) ? by : flags.birthYear)) return html(res, renderCreateAge({ name: account.displayName || 'You', error: true }));
          const aId = await createAthlete(db, account.displayName || 'My events');
          await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [account.id, aId]);
          await grantOwnership(db, account.id, 'athlete', aId);
          await activateCreatorLayer(db, account.id, false);
          return redirect(res, `/host/athlete/${aId}/new`);
        }
        if (hostable.length === 1) return redirect(res, `/host/${hostable[0].kind}/${hostable[0].id}/new`);
        if (hostable.length > 1) return html(res, renderCreatePicker({ fanId: viewer, pages: hostable }));
        // no page yet → confirm 18+ once, then auto-provision a personal host page
        const flags = await accountFlags(db, account.id);
        if (!isAdultYear(flags.birthYear)) return html(res, renderCreateAge({ name: account.displayName || 'You' }));
        const aId = await createAthlete(db, account.displayName || 'My events');
        await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [account.id, aId]);
        await grantOwnership(db, account.id, 'athlete', aId);
        await activateCreatorLayer(db, account.id, false);
        return redirect(res, `/host/athlete/${aId}/new`);
      }
      if (path === '/settings') {
        if (viewerGuest) return redirect(res, '/login');
        const editHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/customize` : undefined;
        const insHref = ownedAthleteForNav ? `/athlete/${ownedAthleteForNav.id}/insights` : undefined;
        return html(res, renderSettings({ fanId: viewer, fanName: account?.displayName || 'You', email: account?.email, editPageHref: editHref, insightsHref: insHref, createHref: viewerCreateHref }));
      }
      if (path === '/signup') {
        return html(res, renderSignup(url.searchParams.get('next') ?? '/', url.searchParams.get('follow') ?? ''));
      }
      // PUBLIC share pages (the acquisition loop) — open to everyone, like Shop.
      let sm;
      if ((sm = path.match(/^\/share\/result\/([^/]+)$/))) {
        const a = await buildResultShare(db, sm[1]);
        return a ? html(res, renderSharePage(a)) : html(res, '<p>Not found</p>', 404);
      }
      if ((sm = path.match(/^\/share\/fight\/([^/]+)$/))) {
        const a = await buildFightShare(db, sm[1]);
        return a ? html(res, renderSharePage(a)) : html(res, '<p>Not found</p>', 404);
      }
      if ((sm = path.match(/^\/share\/week\/([^/]+)$/))) {
        const a = await buildWeekDrop(db, sm[1]);
        return html(res, renderSharePage(a));
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
        if (viewerGuest) return redirect(res, '/login');
        const follows = await getFollows(db, viewer);
        const q = (url.searchParams.get('q') || '').trim();
        let results: { kind: string; id: string; name: string; region: string | null }[] = [];
        if (q) {
          const like = '%' + q.toLowerCase() + '%';
          const ath = (await db.query<any>(`SELECT id, display_name name, region FROM athlete WHERE lower(display_name) LIKE $1 ORDER BY display_name LIMIT 8`, [like])).rows.map(r => ({ kind: 'athlete', id: r.id, name: r.name, region: r.region ?? null }));
          const cl = (await db.query<any>(`SELECT id, name, region FROM club WHERE lower(name) LIKE $1 ORDER BY name LIMIT 8`, [like])).rows.map(r => ({ kind: 'club', id: r.id, name: r.name, region: r.region ?? null }));
          results = [...ath, ...cl];
        }
        return html(res, renderFollowing({ fanId: viewer, createHref: viewerCreateHref, follows, q, results }));
      }
      if (req.method === 'POST' && path === '/unfollow') {
        if (viewerGuest) return redirect(res, '/login');
        const f = await parseForm(req);
        await unfollowEntity(db, viewer, f.target_type, f.target_id);
        return redirect(res, req.headers.referer ?? '/following');
      }
      if (path === '/') {
        const sport = url.searchParams.get('sport') || undefined;
        const region = url.searchParams.get('region') || undefined;
        const data = await getDiscover(db, { sport, region });
        const unread = viewerGuest ? 0 : await unreadCount(db, viewer);
        // Remember a guest's filter so, when they sign up, it becomes their feed
        // (auto-follow the sport + region they were browsing).
        if (viewerGuest && (sport || region)) res.setHeader('set-cookie', `hz_filter=${encodeURIComponent((sport || '') + '|' + (region || ''))}; Path=/; Max-Age=1800; SameSite=Lax`);
        // Logged-in home leads with the viewer's own feed of upcoming events from
        // the crowds they follow (the "events I prefer").
        const rawDoors = viewerGuest ? [] : await feedDoors(db, viewer);
        const doors = await Promise.all(rawDoors.map(async x => ({ eventId: x.eventId, title: x.title, date: x.date, hostName: x.hostName || (x.hostKind && x.hostId ? await hostName(db, x.hostKind, x.hostId) : ''), remaining: x.remaining, mine: x.mine })));
        return html(res, renderDiscover({ guest: viewerGuest, fanId: viewer, sport, region, data, regions: REGIONS, lang, unread, doors }));
      }
      if (path === '/map') {
        // Event map: plot public events at their host's region, cover image as the pin.
        const evRows = (await db.query<any>(
          `SELECT e.id, e.name title, e.cover_url,
                  COALESCE(a.region, cl.region) region,
                  COALESCE(e.cover_url, a.avatar_url) avatar
           FROM event e
           LEFT JOIN athlete a ON e.host_kind::text='athlete' AND a.id::text=e.host_id::text
           LEFT JOIN club cl  ON e.host_kind::text='club'    AND cl.id::text=e.host_id::text
           WHERE e.host_kind IS NOT NULL AND e.starts_at IS NOT NULL
           ORDER BY e.starts_at LIMIT 80`)).rows;
        const points = evRows.filter(r => r.region).map(r => ({ name: r.title, region: r.region, href: `/e/${r.id}`, kind: 'event', avatar: r.avatar || null }));
        return html(res, renderMap({ guest: viewerGuest, fanId: viewer, points }));
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
        const cTiers = await getTiers(db, 'athlete', m[1]);
        const cBanner = await getBannerStyle(db, m[1]);
        const cMedia = await listMedia(db, 'athlete', m[1]);
        const cSponsors = await listSponsors(db, 'athlete', m[1]);
        const cSports = await getAthleteSports(db, m[1]);
        const cShop = await listShopItems(db, 'athlete', m[1]);
        const cTheme = autoContrast(parseTheme(await getAthleteTheme(db, m[1]), cSports[0] ?? sport));
        const cThemeStudio = renderThemeStudio(m[1], prof.name, cTheme);
        return html(res, renderCustomize({ athleteId: m[1], fanId: viewer, sport, sports: cSports, sections, links: prof.links, tiers: cTiers, bannerUrl: prof.bannerUrl, banner: cBanner, media: cMedia, sponsors: cSponsors, shop: cShop, themeStudioHtml: cThemeStudio }));
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
        await createGoal(db, { ownerKind: 'athlete', ownerId: m[1], metric: f.metric || 'superfans', threshold: threshold || 1, reward: f.reward || 'a reward', rivalKind: f.rival_id ? 'athlete' : undefined, rivalId: f.rival_id || undefined });
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
        return html(res, renderSharePage({ title: `Backing ${nm}`, card, body: `I'm backing ${nm} on Horda. Get closer to the athletes you love.`, shareText: `I'm backing ${nm} on Horda — joinhorda.com` }, sm[1] === 'athlete' ? `/athlete/${sm[2]}` : `/${sm[1]}/${sm[2]}`));
      }
      // save a membership tier (Supporter/Clubhouse) — owner only; wired to Stripe
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/tiers$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const f = await parseForm(req);
        const level: TierLevel = f.level === 'clubhouse' ? 'clubhouse' : 'supporter';
        // Accept comma OR dot decimals (e.g. "4,99" or "4.99") and any € amount.
        const toCents = (v: string) => { const n = Math.round(Number(String(v).replace(',', '.').replace(/[^0-9.]/g, '')) * 100); return Number.isFinite(n) && n >= 0 ? n : 0; };
        const perks = (f.perks || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
        const monthly = toCents(f.price || '0');
        let annual = f.annual ? toCents(f.annual) : null;
        // Guardrail: annual must be a real discount — never more than 12× monthly.
        if (annual !== null && monthly > 0 && annual > monthly * 12) annual = monthly * 12;
        await setTier(db, 'athlete', m[1], {
          level, name: (f.name || (level === 'clubhouse' ? 'Clubhouse' : 'Supporter')).slice(0, 60),
          priceCents: monthly, priceAnnualCents: annual,
          currency: 'EUR', perks,
        });
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
      // "+" composer (owner) — create menu; new drop with per-tier visibility
      if ((m = path.match(/^\/athlete\/([^/]+)\/compose$/))) {
        if (!await canEdit('athlete', m[1])) return redirect(res, `/athlete/${m[1]}`);
        const hasPaid = (await getTiers(db, 'athlete', m[1])).some(t => t.priceCents > 0 || (t.priceAnnualCents ?? 0) > 0);
        return html(res, renderCompose({ athleteId: m[1], fanId: viewer, hasPaidTiers: hasPaid }));
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
        await notifyWebhook(`💡 Feature request${f.sport ? ` [${f.sport}]` : ''}: ${(f.body || '').slice(0, 400)}`);
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
        if (viewerGuest) return redirect(res, '/login');
        if (m[1] !== viewer) return html(res, '<p>This feed is private. <a href="/">Home</a></p>', 403);
        const home = await getFanHome(db, m[1]);
        const follows = await getFollows(db, m[1]);
        const fanAct = renderChecklist(await fanChecklist(db, m[1]));
        // "Your pages": the creator side of the SAME account — switch here, and
        // manage the events each page runs. Only on the owner's own fan home.
        const ownPages = (account && m[1] === viewer)
          ? await Promise.all((await ownedEntities(db, account.id)).map(async e => ({ ...e, events: await listProfileEvents(db, e.kind, e.id) })))
          : [];
        const doors = await feedDoors(db, m[1]);
        const rp = await recentPresence(db, m[1]);
        const morningAfter = rp ? { title: rp.title, date: rp.date, recordTotal: (await recordCount(db, m[1])).total } : null;
        return html(res, renderFanHome({ fanId: m[1], fanName: 'You', home, follows, activation: fanAct, pages: ownPages, createHref: viewerCreateHref, doors, morningAfter }));
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
        const events = await listProfileEvents(db, 'athlete', m[1]);
        const tiers = await getTiers(db, 'athlete', m[1]);
        const membership = await getMembership(db, fanId, 'athlete', m[1]);
        const members = await memberCount(db, 'athlete', m[1]);
        const superfan = await isSuperfan(db, fanId, 'athlete', m[1]);
        const lscore = fanId ? await loyaltyScore(db, fanId, 'athlete', m[1]) : 0;
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
        return html(res, renderAthletePage({ guest, fanId, profile, upcoming, attendance, affiliations, events, connections: athConnections, scheduleHref: `/host/athlete/${m[1]}/new`, tiers, membership, superfan, loyalty: fanId ? { score: lscore, threshold: 200 } : null, memberCount: members, canEdit: athOwner, activation: athAct, sections: athSections, ogTags: athOg, previewAsFan: realOwner && asFan, media: athMedia, sponsors: athSponsors, banner: athBanner, goalsHtml, sportsLabel: athSportsLabel, createHref: viewerCreateHref, shop: athShop, themedBanner: athThemedBanner }));
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
          kindLabel: 'Club', guest, fanId: guest ? null : viewer, name: club.name, nickname: club.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Shop', shop: true }],
          statLine, notice, post: cp ? { author: club.name, body: cp.body, date: cp.date } : undefined,
          upcoming, attendance, tableHtml, merch: true, backHref: '/', editAction: `/entity/club/${m[1]}/branding`, canEdit: await canEdit('club', m[1]),
          ogTags: ogMeta({ title: `${club.name} on Horda`, description: brand.tagline || `Follow ${club.name} on Horda — matchdays, members-only news and tickets.`, url: `${origin}/club/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('club', m[1])) ? renderChecklist(await entityChecklist(db, 'club', m[1])) : '',
          events: await listProfileEvents(db, 'club', m[1]), scheduleHref: `/host/club/${m[1]}/new`,
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
          kindLabel: 'Team', guest, fanId: guest ? null : viewer, name: team.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          parent: { label: team.club_name, href: `/club/${team.club_id}` },
          about: `${team.sport} · ${[team.division, team.gender].filter(Boolean).join(' · ')}`,
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Shop', shop: true }],
          statLine, notice: nf ? `[Notice] Next match: ${team.name} vs ${nf.opp} — ${nf.date ?? 'soon'}.` : '',
          upcoming, attendance, tableHtml, merch: true, backHref: `/club/${team.club_id}`, editAction: `/entity/team/${m[1]}/branding`, canEdit: await canEdit('team', m[1]),
          ogTags: ogMeta({ title: `${team.name} on Horda`, description: brand.tagline || `Follow ${team.name} on Horda — matchdays, members-only news and tickets.`, url: `${origin}/team/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('team', m[1])) ? renderChecklist(await entityChecklist(db, 'team', m[1])) : '',
          events: await listProfileEvents(db, 'team', m[1]), scheduleHref: `/host/team/${m[1]}/new`,
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
          kindLabel: 'Association', guest, fanId: guest ? null : viewer, name: assoc.name,
          tagline: brand.tagline, avatarUrl: brand.avatarUrl, bannerUrl: brand.bannerUrl, links: brand.links,
          about: brand.tagline ?? undefined,
          tabs: [{ label: 'Highlight' }, { label: 'Members' }, { label: 'Competitions' }, { label: 'Notice' }],
          statLine: { label: 'MEMBER CLUBS', value: String(clubs.length), sub: 'in sanctioned leagues' },
          notice: `[Notice] ${assoc.name} sanctions ${leagues.length} competition(s).`,
          merch: false, backHref: '/', editAction: `/entity/association/${m[1]}/branding`, canEdit: await canEdit('association', m[1]),
          ogTags: ogMeta({ title: `${assoc.name} on Horda`, description: brand.tagline || `${assoc.name} on Horda — the home for its clubs, competitions and fans.`, url: `${origin}/association/${m[1]}`, image: brand.bannerUrl || brand.avatarUrl, type: 'profile' }),
          activation: (await canEdit('association', m[1])) ? renderChecklist(await entityChecklist(db, 'association', m[1])) : '',
          events: await listProfileEvents(db, 'association', m[1]), scheduleHref: `/host/association/${m[1]}/new`,
          members: { title: 'Member clubs', items: clubs.map(c => ({ kind: 'club', label: c.name, href: `/club/${c.id}` })) },
          secondary: { title: 'Competitions', items: leagues.map(l => ({ kind: 'league', label: l.name, href: '#' })) },
        }));
      }
      html(res, '<p>Not found. <a href="/">Home</a></p>', 404);
    } catch (e: any) {
      html(res, `<pre>${e?.stack ?? e}</pre>`, 500);
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
  process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
  process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
  const db = await openDatabase();   // DATABASE_URL → server Postgres (prod); else embedded PGlite (HORDA_DATA persists)
  const fresh = (await db.query<{ r: string | null }>(`SELECT to_regclass('public.account')::text r`)).rows[0].r === null;
  const pending = await applySchema(db);   // ALWAYS apply pending migrations (new + existing DBs alike)
  if (pending.length) console.log(`[migrations] applied: ${pending.join(', ')}`);
  const ids = fresh ? await seedDemo(db) : await loadDemoIds(db);              // seed once; reuse on restart
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
  console.log(`  /fan/${ids.fanId}     your feed`);
  console.log(`  /athlete/${ids.athletes[0].id}  the idol`);
  console.log(`  /club/${ids.clubs[0].id}        the club`);
}
