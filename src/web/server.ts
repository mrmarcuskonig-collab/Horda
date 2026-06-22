// server.ts — a tiny zero-dependency SSR web app over the DB + engagement repo.
// Routes are thin: assemble data, render a page. Structured to lift into Next.js
// route handlers later (each handler is already a pure data->HTML function).
import { createServer, type Server } from 'node:http';
import { PGliteDatabase } from '../db/index.ts';
import type { Database } from '../db/index.ts';
import { getClubPage } from '../db/repo.ts';
import {
  getAthleteProfile, getFanHome, getFollows, getUpcomingBout, getPrediction,
  followEntity, makePrediction, attend, getAttendance, getAffiliations, getLatestPost, setAthleteProfile,
} from '../db/engagement_repo.ts';
import {
  getBranding, setBranding, getClub, getTeamsOfClub, getTeam, getRoster,
  getAssociation, getAssociationLeagues, getAssociationClubs, getNextFixtureForTeam,
} from '../db/entity_repo.ts';
import { renderEntityProfile, tableDark } from './shell.ts';
import { FAVICON_SVG } from './brand.ts';
import { buildResultShare, buildFightShare, buildWeekDrop } from '../content/index.ts';
import { createScheduledEvent, rsvp, getRsvp, getEventDetail, getGuestList, listUpcomingByHost, listProfileEvents, hostName, icsFor, approveRegistration, markPaid, featureEvent, getTicketFor, giftTicket, listTicket, getListings, buyListing } from '../db/events_repo.ts';
import { getTier, joinMembership, getMembership, memberCount } from '../db/membership_repo.ts';
import { signup, verifyLogin, createSession, sessionAccount, deleteSession, fanForAccount, owns, ownedEntities, grantOwnership } from '../db/auth_repo.ts';
import { getDiscover, REGIONS } from '../db/discover_repo.ts';
import { renderEventPage, renderCreateEvent, renderManage, renderCheckout } from './events.ts';
import { seedDemo, type DemoIds } from './seed.ts';
import { renderIndex, renderDiscover, renderAthletePage, renderFanHome, renderSignup, renderLogin, renderSharePage, renderMemberWelcome } from './pages.ts';

const DEMO_FALLBACK = process.env.HORDA_DEMO !== '0';  // default on: usable without login
const parseCookies = (h?: string): Record<string, string> => Object.fromEntries((h ?? '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
import type { StandingDef } from '../engines/types.ts';

const FOOTBALL_TABLE: StandingDef = { name: 'League table', unit: 'team', engine: 'points_table', scope: 'season', config: { win: 3, draw: 1, loss: 0, tiebreakers: ['goal_diff', 'goals_for'] } };

const html = (res: any, body: string, code = 200) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); };
const redirect = (res: any, to: string) => { res.writeHead(303, { location: to }); res.end(); };

async function parseForm(req: any): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
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
      const canEdit = (kind: string, id: string) => viewerGuest ? Promise.resolve(false) : owns(db, account?.id ?? null, kind, id);

      if (path === '/favicon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(FAVICON_SVG); return; }

      // --- auth ---
      if (req.method === 'POST' && path === '/signup') {
        const f = await parseForm(req);
        const r = await signup(db, (f.email || '').toLowerCase().trim(), f.name || 'Fan', f.password || '');
        if (!r) return redirect(res, '/login');
        const token = await createSession(db, r.accountId);
        res.writeHead(303, { 'set-cookie': `hz_session=${token}; Path=/; HttpOnly; SameSite=Lax`, location: f.next || '/' }); res.end(); return;
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
      let claimM;
      if ((claimM = path.match(/^\/claim\/(athlete|club|team|association)\/([^/]+)$/))) {
        if (!account) return redirect(res, '/signup');
        await grantOwnership(db, account.id, claimM[1], claimM[2]);
        const tbl = claimM[1] === 'association' ? 'association' : claimM[1] === 'team' ? 'team' : 'club';
        if (claimM[1] !== 'athlete') await db.query(`UPDATE ${tbl} SET claim_status='claimed' WHERE id=$1`, [claimM[2]]);
        return redirect(res, claimM[1] === 'athlete' ? `/athlete/${claimM[2]}` : `/${claimM[1]}/${claimM[2]}`);
      }

      if (req.method === 'POST' && path === '/follow') {
        const f = await parseForm(req);
        await followEntity(db, f.fan_id, f.target_type as any, f.target_id);
        return redirect(res, req.headers.referer ?? `/athlete/${f.target_id}`);
      }
      if (req.method === 'POST' && path === '/predict') {
        const f = await parseForm(req);
        await makePrediction(db, f.fan_id, f.event_id, f.pick);
        return redirect(res, req.headers.referer ?? '/');
      }
      // ---- Luma-style scheduled events ----
      if (req.method === 'POST' && path === '/rsvp') {
        const f = await parseForm(req);
        await rsvp(db, f.fan_id, f.event_id, f.response as any);
        return redirect(res, req.headers.referer ?? `/e/${f.event_id}`);
      }
      if (req.method === 'POST' && path === '/events') {
        const f = await parseForm(req);
        const streams: any = {};
        if (f.youtube) streams.youtube = f.youtube;
        if (f.twitch) streams.twitch = f.twitch;
        if (f.discord) streams.discord = f.discord;
        const id = await createScheduledEvent(db, {
          hostKind: f.host_kind as any, hostId: f.host_id, title: f.title || 'Untitled event',
          startsAt: f.starts_at || new Date().toISOString(), location: f.location, description: f.description,
          coverUrl: f.cover || undefined, admission: (f.admission as any) || 'open',
          priceCents: f.price ? Math.round(Number(f.price) * 100) : undefined, streams,
          capacity: f.capacity ? Number(f.capacity) : undefined,
        });
        return redirect(res, `/e/${id}`);
      }
      if (req.method === 'POST' && path === '/join') {
        const f = await parseForm(req);
        await joinMembership(db, f.fan_id, f.owner_kind, f.owner_id);
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
        const f = await parseForm(req); await buyListing(db, f.ticket_id, f.fan_id);
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
        await featureEvent(db, f.feat_kind, f.feat_id, f.event_id);
        return redirect(res, req.headers.referer ?? `/e/${f.event_id}`);
      }
      let cm;
      if (req.method === 'POST' && (cm = path.match(/^\/e\/([^/]+)\/pay$/))) {
        const f = await parseForm(req);
        await markPaid(db, cm[1], f.fan_id);
        return redirect(res, `/e/${cm[1]}`);
      }
      if (req.method === 'POST' && (cm = path.match(/^\/e\/([^/]+)\/approve$/))) {
        const f = await parseForm(req);
        await approveRegistration(db, cm[1], f.fan_id);
        return redirect(res, `/manage/${cm[1]}`);
      }
      if ((cm = path.match(/^\/e\/([^/]+)\/checkout$/))) {
        const d = await getEventDetail(db, cm[1]);
        if (!d) return html(res, 'Not found', 404);
        return html(res, renderCheckout(d, viewer));
      }
      let em;
      if ((em = path.match(/^\/e\/([^/]+)\/ics$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="horda-event.ics"' });
        res.end(icsFor(d)); return;
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
        return html(res, renderEventPage(d, { guest, fanId: guest ? null : viewer, myRsvp, isHost, myEntities, myTicket, listings }));
      }
      if ((em = path.match(/^\/manage\/([^/]+)$/))) {
        const d = await getEventDetail(db, em[1]);
        if (!d) return html(res, 'Not found', 404);
        return html(res, renderManage(d, await getGuestList(db, em[1])));
      }
      if ((em = path.match(/^\/host\/(athlete|club|team|association)\/([^/]+)\/new$/))) {
        return html(res, renderCreateEvent(em[1], em[2], await hostName(db, em[1], em[2])));
      }

      if (req.method === 'POST' && path === '/attend') {
        const f = await parseForm(req);
        await attend(db, f.fan_id, f.event_id, (f.mode as any) ?? 'going');
        return redirect(res, req.headers.referer ?? '/');
      }
      if (path === '/signup') {
        return html(res, renderSignup(url.searchParams.get('next') ?? req.headers.referer ?? '/'));
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
      let m;
      if (req.method === 'POST' && (m = path.match(/^\/athlete\/([^/]+)\/branding$/))) {
        const f = await parseForm(req);
        await setAthleteProfile(db, m[1], { avatarUrl: f.avatar || undefined, bannerUrl: f.banner || undefined });
        return redirect(res, `/athlete/${m[1]}`);
      }
      if (req.method === 'POST' && (m = path.match(/^\/entity\/(club|team|association)\/([^/]+)\/branding$/))) {
        const f = await parseForm(req);
        const cur = await getBranding(db, m[1], m[2]);
        await setBranding(db, m[1] as any, m[2], { tagline: cur.tagline ?? undefined, links: cur.links, avatarUrl: f.avatar || cur.avatarUrl || undefined, bannerUrl: f.banner || cur.bannerUrl || undefined });
        return redirect(res, `/${m[1]}/${m[2]}`);
      }
      if ((m = path.match(/^\/fan\/([^/]+)$/))) {
        const home = await getFanHome(db, m[1]);
        const follows = await getFollows(db, m[1]);
        return html(res, renderFanHome({ fanId: m[1], fanName: 'You', home, follows }));
      }
      if ((m = path.match(/^\/athlete\/([^/]+)$/))) {
        const guest = viewerGuest;
        const fanId = guest ? null : viewer;
        const profile = await getAthleteProfile(db, m[1]);
        const upcoming = await getUpcomingBout(db, m[1]);
        const attendance = (!guest && upcoming) ? await getAttendance(db, viewer, upcoming.eventId) : null;
        const affiliations = await getAffiliations(db, m[1]);
        const events = await listProfileEvents(db, 'athlete', m[1]);
        const tier = await getTier(db, 'athlete', m[1]);
        const membership = await getMembership(db, fanId, 'athlete', m[1]);
        const members = await memberCount(db, 'athlete', m[1]);
        return html(res, renderAthletePage({ guest, fanId, profile, upcoming, attendance, affiliations, events, scheduleHref: `/host/athlete/${m[1]}/new`, tier, membership, memberCount: members, canEdit: await canEdit('athlete', m[1]) }));
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
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Table' }, { label: 'Shop', shop: true }],
          statLine, notice, post: cp ? { author: club.name, body: cp.body, date: cp.date } : undefined,
          upcoming, attendance, tableHtml, merch: true, backHref: '/', editAction: `/entity/club/${m[1]}/branding`, canEdit: await canEdit('club', m[1]),
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
          tabs: [{ label: 'Highlight' }, { label: 'Squad' }, { label: 'Fixtures' }, { label: 'Table' }, { label: 'Shop', shop: true }],
          statLine, notice: nf ? `[Notice] Next match: ${team.name} vs ${nf.opp} — ${nf.date ?? 'soon'}.` : '',
          upcoming, attendance, tableHtml, merch: true, backHref: `/club/${team.club_id}`, editAction: `/entity/team/${m[1]}/branding`, canEdit: await canEdit('team', m[1]),
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
  const db = await PGliteDatabase.open(process.env.HORDA_DATA || undefined);   // HORDA_DATA → persist to disk
  const fresh = (await db.query<{ r: string | null }>(`SELECT to_regclass('public.account')::text r`)).rows[0].r === null;
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
