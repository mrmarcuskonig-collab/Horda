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
  followEntity, makePrediction, attend, getAttendance, getAffiliations, getLatestPost, setAthleteProfile, createAthlete, createPost,
} from '../db/engagement_repo.ts';
import {
  getBranding, setBranding, getClub, getTeamsOfClub, getTeam, getRoster,
  getAssociation, getAssociationLeagues, getAssociationClubs, getNextFixtureForTeam,
} from '../db/entity_repo.ts';
import { renderEntityProfile, tableDark } from './shell.ts';
import { FAVICON_SVG } from './brand.ts';
import { buildResultShare, buildFightShare, buildWeekDrop } from '../content/index.ts';
import { createScheduledEvent, rsvp, getRsvp, getEventDetail, getGuestList, listUpcomingByHost, listProfileEvents, hostName, icsFor, approveRegistration, markPaid, featureEvent, getTicketFor, giftTicket, listTicket, getListings, buyListing } from '../db/events_repo.ts';
import { getTier, getTiers, setTier, joinMembership, cancelMembershipBySub, getMembership, memberCount, recordLoyalty, loyaltyScore, isSuperfan, topSuperfans, type TierLevel } from '../db/membership_repo.ts';
import { signup, verifyLogin, createSession, sessionAccount, deleteSession, fanForAccount, owns, ownedEntities, grantOwnership, accountRole, setOnboarded, upsertOauthAccount, createPasswordReset, resetPassword, activateCreatorLayer, setBirthYear, accountFlags, isAdultYear } from '../db/auth_repo.ts';
import { getDiscover, REGIONS } from '../db/discover_repo.ts';
import { renderEventPage, renderCreateEvent, renderManage, renderCheckout } from './events.ts';
import { seedDemo, type DemoIds } from './seed.ts';
import { renderIndex, renderDiscover, renderMap, renderAthletePage, renderCustomize, renderCompose, renderFanHome, renderSignup, renderLogin, renderForgot, renderReset, renderSharePage, renderMemberWelcome, renderClaimPending, renderClaimQueue, renderOnboardFan, renderAiPrompt, renderProfilePreview, renderOnboardClaim, renderCreatorEntry, renderClaimHandle, sportsLabel, renderSettings, renderPros } from './pages.ts';
import { getEmailer, resetEmail } from './email.ts';
import { ogMeta } from './layout.ts';
import { storeImage } from './storage.ts';
import { fanChecklist, athleteChecklist, entityChecklist, renderChecklist } from './activation.ts';
import { getAthleteSport, setAthleteSport, getAthleteSports, setAthleteSports, getAthleteLayout, setAthleteLayout, createFeatureRequest, getAthleteTheme, setAthleteTheme } from '../db/layout_repo.ts';
import { parseTheme, serializeTheme, autoContrast, bannerSvg, svgDataUri, THEME_PRESETS, defaultThemeForSport, renderThemeStudio, type ThemeSpec } from './theme_engine.ts';
import { listMedia, addMedia, deleteMedia, listSponsors, addSponsor, deleteSponsor, subscribeNewsletter, reserveHandle, getBannerStyle, setBannerStyle, listShopItems, addShopItem, deleteShopItem } from '../db/extras_repo.ts';
import { track, conversionRate, metricCounts, defaultRoomLabel, roomState, setRoomConfig, setResult, getRoomConfig, listRoomMessages, postRoomMessage, canSeeLiveRoom, createGoal, listGoals, activeGoalProgress, getGoal, maybeGoalSignup, trackConversion, roomPresence } from '../db/hook_repo.ts';
import { renderEventRoom, renderMediaStudio, renderInsights, goalBar } from './hook_web.ts';
import { generateEventAssets, eventGraphic, supporterCard } from './mediagen.ts';
import { resolveLayout } from './sections.ts';
import { generateProfile, getModel, coverDataUri } from './profilegen.ts';
import { requestClaim, verifyByChannelCode, listClaimsForReviewer, decideClaim, officialDomain, isAdmin as accountIsAdmin, type ClaimKind } from '../db/claim_repo.ts';
import { getPayments, verifyWebhook } from './payments.ts';

const payments = getPayments();
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

      if (path === '/favicon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(FAVICON_SVG); return; }

      // --- auth ---
      if (req.method === 'POST' && path === '/signup') {
        const f = await parseForm(req);
        const next = f.next || '';
        // everyone signs up as a person (fan by default); the creator entrance routes via ?next
        const role = next.includes('/onboarding/athlete') ? 'athlete' : next.includes('/onboarding/claim') ? 'club' : 'fan';
        const r = await signup(db, (f.email || '').toLowerCase().trim(), f.name || 'Fan', f.password || '', role);
        if (!r) return redirect(res, '/login');
        // §1b: /pros (athlete-intent) auto-activates the creator layer, unverified
        // until light verification (Featured is gated on verified). Club-invite path
        // pre-verifies (the club vouches). Plain fans get a base account only.
        if (f.intent === 'pro' || next.includes('/onboarding/athlete')) await activateCreatorLayer(db, r.accountId, f.invited === '1');
        const token = await createSession(db, r.accountId);
        let dest = (next && next !== '/') ? next : '/onboarding/fan';
        // carry a "follow this creator" intent (from a Follow CTA) into the follow picker
        if (f.follow && (dest === '/onboarding/fan' || dest.startsWith('/onboarding/fan'))) dest = `/onboarding/fan?follow=${encodeURIComponent(f.follow)}`;
        res.writeHead(303, { 'set-cookie': `hz_session=${token}; Path=/; HttpOnly; SameSite=Lax`, location: dest }); res.end(); return;
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
        res.writeHead(303, { 'set-cookie': `hz_session=${token}; Path=/; HttpOnly; SameSite=Lax`, location: f.next || '/' }); res.end(); return;
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
        res.writeHead(303, { 'set-cookie': [`hz_session=${token}; Path=/; HttpOnly; SameSite=Lax`, 'hz_oauth=; Path=/; Max-Age=0'], location: next || '/onboarding/fan' }); res.end(); return;
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
        const id = await createScheduledEvent(db, {
          hostKind: f.host_kind as any, hostId: f.host_id, title: f.title || 'Untitled event',
          startsAt: f.starts_at || new Date().toISOString(), location: f.location, description: f.description,
          coverUrl: (await storeImage(f.cover, 'events')) || undefined, admission: (f.admission as any) || 'open',
          priceCents: f.price ? Math.round(Number(f.price) * 100) : undefined, streams,
          capacity: f.capacity ? Number(f.capacity) : undefined,
          locationKind: f.location_kind, recurrence: f.recurrence,
        });
        // Event Room config (Build Order #3) — extends the event, no parallel system.
        if (f.room_enabled === '1') {
          const sport = f.host_kind === 'athlete' ? await getAthleteSport(db, f.host_id) : null;
          await setRoomConfig(db, id, { enabled: true, label: (f.room_label || '').trim() || defaultRoomLabel(sport), tier: f.room_tier || 'supporter' });
          await track(db, 'event_room_open', { ownerKind: f.host_kind, ownerId: f.host_id, eventId: id, props: { tier: f.room_tier || 'supporter' } });
        }
        return redirect(res, f.room_enabled === '1' ? `/e/${id}/room` : `/e/${id}`);
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
      let cm;
      if (req.method === 'POST' && (cm = path.match(/^\/e\/([^/]+)\/pay$/))) {
        const f = await parseForm(req);
        const evId = cm[1];
        if (payments.enabled) {
          const d = await getEventDetail(db, evId);
          const { url } = await payments.createCheckout({
            mode: 'payment', amountCents: d?.priceCents ?? 0, currency: d?.currency || 'EUR',
            productName: `Ticket · ${d?.title ?? 'Event'}`,
            successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/e/${evId}`,
            metadata: { kind: 'ticket', event_id: evId, fan_id: viewer },
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
        const myRsvp = guest ? null : await getRsvp(db, viewer, em[1]);
        const myEntities = guest ? [] : await ownedEntities(db, account?.id ?? null);
        const myTicket = guest ? null : await getTicketFor(db, em[1], viewer);
        const listings = await getListings(db, em[1]);
        const isHost = await canEdit(d.hostKind ?? '', d.hostId ?? '');
        const rc = await getRoomConfig(db, em[1]);
        const roomCta = rc?.enabled ? `<div class="card" style="border-color:var(--bone)"><strong>${esc(rc.label || 'Event Room')}</strong> — countdown, live reactions and the host's behind-the-scenes.<div class="row" style="margin-top:8px"><a class="btn" href="/e/${em[1]}/room">Enter the ${esc(rc.label || 'room')} →</a></div></div>` : '';
        return html(res, renderEventPage(d, { guest, fanId: guest ? null : viewer, myRsvp, isHost, myEntities, myTicket, listings, extraTop: roomCta }));
      }
      if ((em = path.match(/^\/manage\/([^/]+)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        if (!await canEdit(d.hostKind ?? '', d.hostId ?? '')) return redirect(res, `/e/${em[1]}`);  // guest list is owner-only
        return html(res, renderManage(d, await getGuestList(db, em[1])));
      }
      if ((em = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/new$/))) {
        return html(res, renderCreateEvent(em[1], em[2], await hostName(db, em[1], em[2])));
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
      if (path === '/create') {
        return html(res, renderCreatorEntry({ guest: viewerGuest }));
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

      if (path === '/') {
        const sport = url.searchParams.get('sport') || undefined;
        const region = url.searchParams.get('region') || undefined;
        const data = await getDiscover(db, { sport, region });
        return html(res, renderDiscover({ guest: viewerGuest, fanId: viewer, sport, region, data, regions: REGIONS }));
      }
      if (path === '/map') {
        const data = await getDiscover(db, {});
        const points = [
          ...data.athletes.filter(a => a.region).map(a => ({ name: a.name, region: a.region, href: `/athlete/${a.id}`, kind: 'athlete', avatar: a.avatar || a.banner || null })),
          ...data.clubs.filter(c => c.region).map(c => ({ name: c.name, region: c.region, href: `/club/${c.id}`, kind: 'club', avatar: c.avatar || null })),
        ];
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
        const conv = await conversionRate(db, 'athlete', m[1]);
        const mc = await metricCounts(db, ['next_event_return', 'goal_signup', 'artifact_share', 'ai_asset_posted', 'event_room_open'], 'athlete', m[1]);
        const prof = await getAthleteProfile(db, m[1]);
        return html(res, renderInsights({ name: prof.name, athleteId: m[1], conversion: conv, returnRate: conv.opens ? Math.round((mc.next_event_return / conv.opens) * 100) : 0, goalSignups: mc.goal_signup, artifactShares: mc.artifact_share, aiAdoption: mc.ai_asset_posted, events: mc.event_room_open }));
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
        return html(res, renderFanHome({ fanId: m[1], fanName: 'You', home, follows, activation: fanAct, pages: ownPages, createHref: viewerCreateHref }));
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
        return html(res, renderAthletePage({ guest, fanId, profile, upcoming, attendance, affiliations, events, scheduleHref: `/host/athlete/${m[1]}/new`, tiers, membership, superfan, loyalty: fanId ? { score: lscore, threshold: 200 } : null, memberCount: members, canEdit: athOwner, activation: athAct, sections: athSections, ogTags: athOg, previewAsFan: realOwner && asFan, media: athMedia, sponsors: athSponsors, banner: athBanner, goalsHtml, sportsLabel: athSportsLabel, createHref: viewerCreateHref, shop: athShop, themedBanner: athThemedBanner }));
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
