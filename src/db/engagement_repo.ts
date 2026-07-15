// engagement_repo.ts — the fandom layer over the DB.
// Hub-and-spoke only: fans follow entities; entities broadcast to followers;
// fans predict real outcomes; the system notifies fans. No fan->fan path exists.
import type { Database } from './index.ts';
import { computeStanding } from '../engines/index.ts';
import { summarize } from '../engines/summarize.ts';
import type { ResultRow, StandingDef } from '../engines/types.ts';
import type { FanFeedItem, AthleteProfile, FanHome } from '../engagement/types.ts';

const sqlList = (ids: string[]) => ids.length ? ids.map(i => `'${i}'`).join(',') : `'00000000-0000-0000-0000-000000000000'`;

// ---- actors -------------------------------------------------------------
export async function createFan(db: Database, handle: string, name: string): Promise<string> {
  return (await db.query<{ id: string }>(`INSERT INTO fan (handle,display_name) VALUES ($1,$2) RETURNING id`, [handle, name])).rows[0].id;
}
export async function createAthlete(db: Database, name: string, handle?: string): Promise<string> {
  // source defaults to 'native' and the schema forbids 'ingested' — persons self-create.
  return (await db.query<{ id: string }>(`INSERT INTO athlete (display_name,handle) VALUES ($1,$2) RETURNING id`, [name, handle ?? null])).rows[0].id;
}
// Athlete edits their own surface (the levers that make a profile stand out).
export async function setAthleteProfile(db: Database, athleteId: string, p: { tagline?: string; avatarUrl?: string; bannerUrl?: string; links?: Record<string, string> }): Promise<void> {
  await db.query(
    `UPDATE athlete SET tagline=COALESCE($2,tagline), avatar_url=COALESCE($3,avatar_url),
            banner_url=COALESCE($4,banner_url), links=COALESCE($5::jsonb,links) WHERE id=$1`,
    [athleteId, p.tagline ?? null, p.avatarUrl ?? null, p.bannerUrl ?? null, p.links ? JSON.stringify(p.links) : null]);
}

export async function followEntity(db: Database, fanId: string, targetType: 'club' | 'team' | 'athlete', targetId: string): Promise<void> {
  await db.query(`INSERT INTO follow (fan_id,target_type,target_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [fanId, targetType, targetId]);
}
export async function unfollowEntity(db: Database, fanId: string, targetType: string, targetId: string): Promise<void> {
  await db.query(`DELETE FROM follow WHERE fan_id=$1 AND target_type::text=$2 AND target_id=$3`, [fanId, targetType, targetId]);
}

// ---- the hub speaks: a post broadcasts to followers + notifies them ------
export async function createPost(db: Database, authorType: 'athlete' | 'club' | 'team', authorId: string, body: string, eventId?: string, visibility: 'public' | 'members' | 'supporter' | 'clubhouse' = 'public'): Promise<string> {
  const post = (await db.query<{ id: string }>(
    `INSERT INTO post (author_type,author_id,body,event_id,visibility) VALUES ($1,$2,$3,$4,$5::post_visibility) RETURNING id`,
    [authorType, authorId, body, eventId ?? null, visibility])).rows[0].id;
  const author = await entityName(db, authorType, authorId);
  await db.query(
    `INSERT INTO notification (fan_id,kind,headline,event_id)
     SELECT fan_id,'post',$1,$2 FROM follow WHERE target_type=$3 AND target_id=$4`,
    [`${author}: ${body}`, eventId ?? null, authorType, authorId]);
  return post;
}

// ---- a real fixture, then a fan's call on it -----------------------------
export async function createBout(db: Database, sportId: string, variantId: string, aId: string, bId: string, startsAt: string, aName: string, bName: string): Promise<string> {
  const ev = (await db.query<{ id: string }>(
    `INSERT INTO event (name,sport_id,variant_id,starts_at,source) VALUES ($1,$2,$3,$4::timestamptz,'native') RETURNING id`,
    [`${aName} vs ${bName}`, sportId, variantId, startsAt])).rows[0].id;
  for (const pid of [aId, bId]) {
    await db.query(`INSERT INTO event_participant (event_id,participant_type,participant_id,source,status) VALUES ($1,'individual',$2,'direct','selected')`, [ev, pid]);
  }
  return ev;
}
export async function makePrediction(db: Database, fanId: string, eventId: string, pickId: string): Promise<void> {
  await db.query(`INSERT INTO prediction (fan_id,event_id,pick_participant_id) VALUES ($1,$2,$3) ON CONFLICT (fan_id,event_id) DO UPDATE SET pick_participant_id=$3`, [fanId, eventId, pickId]);
}

// ---- the outcome lands: store result, settle predictions, notify ---------
export async function commitBoutResult(
  db: Database, eventId: string, variantId: string,
  winnerId: string, loserId: string, names: Record<string, string>, detail: { method?: string; round?: number } = {},
): Promise<{ settled: number; notified: number }> {
  const oppOf = (meId: string, oppId: string) => () => ({ eventId, participantId: oppId, participantType: 'individual' as const, outcome: 'loss' as const, detail });
  const labelOf = names;
  const hWin = summarize({ eventId, participantId: winnerId, participantType: 'individual', outcome: 'win', detail }, { shape: 'matchup', labelOf, opponentOf: oppOf(winnerId, loserId) });
  const hLoss = summarize({ eventId, participantId: loserId, participantType: 'individual', outcome: 'loss', detail }, { shape: 'matchup', labelOf, opponentOf: oppOf(loserId, winnerId) });
  await db.query(`INSERT INTO result (event_id,variant_id,participant_id,participant_type,outcome,headline,detail,source) VALUES ($1,$2,$3,'individual','win',$4,$5::jsonb,'native')`, [eventId, variantId, winnerId, hWin, JSON.stringify(detail)]);
  await db.query(`INSERT INTO result (event_id,variant_id,participant_id,participant_type,outcome,headline,detail,source) VALUES ($1,$2,$3,'individual','loss',$4,$5::jsonb,'native')`, [eventId, variantId, loserId, hLoss, JSON.stringify(detail)]);

  // settle: fan vs the result — correct iff they picked the winner
  const settled = await db.query<{ n: number }>(
    `WITH upd AS (
       UPDATE prediction SET status = (CASE WHEN pick_participant_id=$2 THEN 'correct' ELSE 'incorrect' END)::prediction_status, settled_at=now()
       WHERE event_id=$1 AND status='open' RETURNING 1)
     SELECT count(*)::int n FROM upd`, [eventId, winnerId]);

  // notify everyone following either fighter that the result is in
  const notified = await db.query<{ n: number }>(
    `WITH ins AS (
       INSERT INTO notification (fan_id,kind,headline,event_id)
       SELECT DISTINCT fan_id,'result'::notification_kind,$1,$2::uuid FROM follow WHERE target_type='athlete' AND target_id IN (${sqlList([winnerId, loserId])})
       RETURNING 1)
     SELECT count(*)::int n FROM ins`, [hWin, eventId]);
  return { settled: settled.rows[0].n, notified: notified.rows[0].n };
}

// ---- reads --------------------------------------------------------------
export async function getFanFeed(db: Database, fanId: string): Promise<FanFeedItem[]> {
  const follows = (await db.query<{ target_type: string; target_id: string }>(`SELECT target_type,target_id FROM follow WHERE fan_id=$1`, [fanId])).rows;
  const followedAthletes = follows.filter(f => f.target_type === 'athlete').map(f => f.target_id);
  let followedTeams = follows.filter(f => f.target_type === 'team').map(f => f.target_id);
  const followedClubs = follows.filter(f => f.target_type === 'club').map(f => f.target_id);
  if (followedClubs.length) { // a club follow fans out to all its teams
    const teams = (await db.query<{ id: string }>(`SELECT id FROM team WHERE club_id IN (${sqlList(followedClubs)})`)).rows.map(r => r.id);
    followedTeams = [...followedTeams, ...teams];
  }
  const authorIds = [...followedAthletes, ...followedTeams, ...followedClubs];
  const participantIds = [...followedAthletes, ...followedTeams];

  const posts = (await db.query<any>(
    `SELECT to_char(created_at,'YYYY-MM-DD') date, body, author_type, author_id FROM post WHERE author_id IN (${sqlList(authorIds)}) ORDER BY created_at DESC`)).rows;
  const results = (await db.query<any>(
    `SELECT DISTINCT to_char(e.starts_at,'YYYY-MM-DD') date, r.headline FROM result r JOIN event e ON e.id=r.event_id
     WHERE r.participant_id IN (${sqlList(participantIds)}) ORDER BY 1 DESC NULLS LAST`)).rows;
  const fixtures = (await db.query<any>(
    `SELECT DISTINCT e.id, to_char(e.starts_at,'YYYY-MM-DD') date, e.name FROM event e JOIN event_participant ep ON ep.event_id=e.id
     WHERE ep.participant_id IN (${sqlList(participantIds)}) AND NOT EXISTS (SELECT 1 FROM result r WHERE r.event_id=e.id) ORDER BY 2`)).rows;

  const feed: FanFeedItem[] = [
    ...await Promise.all(posts.map(async p => ({ kind: 'post' as const, date: p.date, headline: p.body, sub: await entityName(db, p.author_type, p.author_id) }))),
    ...results.map(r => ({ kind: 'result' as const, date: r.date, headline: r.headline, sub: 'Full time' })),
    ...fixtures.map(f => ({ kind: 'fixture' as const, date: f.date, headline: f.name, sub: f.date ? `Upcoming · ${f.date}` : 'Upcoming' })),
  ];
  return feed.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export async function getAthleteProfile(db: Database, athleteId: string): Promise<AthleteProfile> {
  const a = (await db.query<any>(`SELECT display_name, handle, tagline, avatar_url, banner_url, links FROM athlete WHERE id=$1`, [athleteId])).rows[0];
  const name = a.display_name;
  const res = (await db.query<any>(`SELECT e.id event_id, to_char(e.starts_at,'YYYY-MM-DD') date, r.outcome, r.headline FROM result r JOIN event e ON e.id=r.event_id WHERE r.participant_id=$1 ORDER BY e.starts_at DESC NULLS LAST`, [athleteId])).rows;

  // record via the same win_loss_record engine used everywhere else
  const rows: ResultRow[] = res.map((r, i) => ({ eventId: `e${i}`, participantId: athleteId, participantType: 'individual', outcome: r.outcome, detail: {} }));
  const std: StandingDef = { name: 'Career record', unit: 'individual', engine: 'win_loss_record', scope: 'career', config: {} };
  const standing = computeStanding(std, rows, {});
  const me = standing.find(s => s.unitId === athleteId);

  const followers = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE target_type='athlete' AND target_id=$1`, [athleteId])).rows[0].n;
  const posts = (await db.query<any>(`SELECT to_char(created_at,'YYYY-MM-DD') date, body, visibility FROM post WHERE author_type='athlete' AND author_id=$1 ORDER BY created_at DESC LIMIT 5`, [athleteId])).rows;
  const next = (await db.query<any>(
    `SELECT to_char(e.starts_at,'YYYY-MM-DD') date, e.name FROM event e JOIN event_participant ep ON ep.event_id=e.id
     WHERE ep.participant_id=$1 AND NOT EXISTS (SELECT 1 FROM result r WHERE r.event_id=e.id) ORDER BY e.starts_at LIMIT 1`, [athleteId])).rows[0];

  return {
    athleteId, name,
    handle: a.handle ?? null, tagline: a.tagline ?? null, avatarUrl: a.avatar_url ?? null, bannerUrl: a.banner_url ?? null,
    links: a.links ?? {},
    record: { wins: me?.wins ?? 0, losses: me?.losses ?? 0, draws: me?.draws ?? 0 },
    followers,
    recentResults: res.slice(0, 5).map(r => ({ headline: r.headline, date: r.date, eventId: r.event_id })),
    posts: posts.map(p => ({ body: p.body, date: p.date, visibility: p.visibility })),
    nextEvent: next ? { opponent: next.name, date: next.date } : undefined,
  };
}

export async function getFanHome(db: Database, fanId: string): Promise<FanHome> {
  const feed = await getFanFeed(db, fanId);
  const predictions = (await db.query<any>(
    `SELECT e.name event, p.status,
            COALESCE((SELECT display_name FROM athlete WHERE id=p.pick_participant_id),
                     (SELECT name FROM team WHERE id=p.pick_participant_id)) pick
     FROM prediction p JOIN event e ON e.id=p.event_id WHERE p.fan_id=$1 ORDER BY p.created_at DESC`, [fanId])).rows
    .map(r => ({ event: r.event, pick: r.pick, status: r.status }));
  const notifications = (await db.query<any>(`SELECT kind,headline,read FROM notification WHERE fan_id=$1 ORDER BY created_at DESC`, [fanId])).rows
    .map(r => ({ kind: r.kind, headline: r.headline, read: r.read }));
  return { feed, predictions, notifications };
}

// --- view helpers used by the web layer ----------------------------------
export interface UpcomingBout { eventId: string; opponentId: string | null; opponentName: string | null; date?: string; access: 'free' | 'paid_ticket'; ticketUrl: string | null; streamUrl: string | null; }
export async function getUpcomingBout(db: Database, athleteId: string): Promise<UpcomingBout | null> {
  const r = await db.query<any>(
    `SELECT e.id event_id, to_char(e.starts_at,'YYYY-MM-DD') date, e.spectator_access access, e.ticket_url, e.stream_url,
            (SELECT participant_id FROM event_participant ep2 WHERE ep2.event_id=e.id AND ep2.participant_id<>$1 LIMIT 1) opp_id
     FROM event e JOIN event_participant ep ON ep.event_id=e.id
     WHERE ep.participant_id=$1 AND NOT EXISTS (SELECT 1 FROM result r WHERE r.event_id=e.id)
     ORDER BY e.starts_at LIMIT 1`, [athleteId]);
  const row = r.rows[0];
  if (!row) return null;
  const opp = row.opp_id ? (await db.query<any>(`SELECT display_name FROM athlete WHERE id=$1`, [row.opp_id])).rows[0]?.display_name : null;
  return { eventId: row.event_id, opponentId: row.opp_id, opponentName: opp ?? null, date: row.date ?? undefined, access: row.access, ticketUrl: row.ticket_url ?? null, streamUrl: row.stream_url ?? null };
}

// --- attendance options + attendance + affiliations ----------------------
export async function setEventSpectator(db: Database, eventId: string, access: 'free' | 'paid_ticket', ticketUrl?: string, streamUrl?: string): Promise<void> {
  await db.query(`UPDATE event SET spectator_access=$2, ticket_url=$3, stream_url=$4 WHERE id=$1`, [eventId, access, ticketUrl ?? null, streamUrl ?? null]);
}
export async function attend(db: Database, fanId: string, eventId: string, mode: 'going' | 'ticket' | 'stream'): Promise<void> {
  await db.query(`INSERT INTO attendance (fan_id,event_id,mode) VALUES ($1,$2,$3) ON CONFLICT (fan_id,event_id) DO UPDATE SET mode=$3`, [fanId, eventId, mode]);
}
export async function getAttendance(db: Database, fanId: string, eventId: string): Promise<{ mode: string } | null> {
  const r = await db.query<any>(`SELECT mode FROM attendance WHERE fan_id=$1 AND event_id=$2`, [fanId, eventId]);
  return r.rows[0] ? { mode: r.rows[0].mode } : null;
}
export async function addAffiliation(db: Database, athleteId: string, kind: string, label: string, href?: string, order = 0): Promise<void> {
  await db.query(`INSERT INTO athlete_affiliation (athlete_id,kind,label,href,display_order) VALUES ($1,$2,$3,$4,$5)`, [athleteId, kind, label, href ?? null, order]);
}
export async function getAffiliations(db: Database, athleteId: string): Promise<{ kind: string; label: string; href: string | null }[]> {
  return (await db.query<any>(`SELECT kind,label,href FROM athlete_affiliation WHERE athlete_id=$1 ORDER BY display_order, label`, [athleteId])).rows;
}

export async function getPrediction(db: Database, fanId: string, eventId: string): Promise<{ pick: string; status: string } | null> {
  const r = await db.query<any>(`SELECT pick_participant_id pick, status FROM prediction WHERE fan_id=$1 AND event_id=$2`, [fanId, eventId]);
  return r.rows[0] ? { pick: r.rows[0].pick, status: r.rows[0].status } : null;
}

export async function isFollowing(db: Database, fanId: string, targetType: string, targetId: string): Promise<boolean> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE fan_id=$1 AND target_type=$2 AND target_id=$3`, [fanId, targetType, targetId]);
  return r.rows[0].n > 0;
}

export async function getLatestPost(db: Database, authorType: 'athlete' | 'club' | 'team', authorId: string): Promise<{ body: string; date?: string } | null> {
  const r = (await db.query<any>(`SELECT body, to_char(created_at,'YYYY-MM-DD') date FROM post WHERE author_type=$1 AND author_id=$2 ORDER BY created_at DESC LIMIT 1`, [authorType, authorId])).rows[0];
  return r ? { body: r.body, date: r.date ?? undefined } : null;
}

export async function getFollows(db: Database, fanId: string): Promise<{ type: string; id: string; name: string }[]> {
  const rows = (await db.query<any>(`SELECT target_type type, target_id id FROM follow WHERE fan_id=$1`, [fanId])).rows;
  const out: { type: string; id: string; name: string }[] = [];
  for (const f of rows) out.push({ type: f.type, id: f.id, name: await entityName(db, f.type, f.id) });
  return out;
}

// ---- helper -------------------------------------------------------------
async function entityName(db: Database, type: string, id: string): Promise<string> {
  const tbl = type === 'athlete' ? 'athlete' : type === 'team' ? 'team' : 'club';
  const col = type === 'athlete' ? 'display_name' : 'name';
  const r = await db.query<any>(`SELECT ${col} AS n FROM ${tbl} WHERE id=$1`, [id]);
  return r.rows[0]?.n ?? id;
}
