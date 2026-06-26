// hook_repo.ts — Build Order #3 "The Hook": event rooms, collective/rivalry
// goals, and typed analytics. Extends the existing event + tier model.
import type { Database } from './index.ts';
import { memberCount, isSuperfan, tierRank } from './membership_repo.ts';

// --- analytics ------------------------------------------------------------
export async function track(db: Database, name: string, o: { ownerKind?: string; ownerId?: string; fanId?: string | null; eventId?: string; props?: Record<string, unknown> } = {}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO analytics_event (name, owner_kind, owner_id, fan_id, event_id, props) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [name, o.ownerKind ?? null, o.ownerId ?? null, o.fanId ?? null, o.eventId ?? null, JSON.stringify(o.props ?? {})]);
  } catch { /* analytics must never break a request */ }
}
export interface MetricRow { name: string; n: number }
export async function metricCounts(db: Database, names: string[], ownerKind?: string, ownerId?: string): Promise<Record<string, number>> {
  const rows = (await db.query<MetricRow>(
    `SELECT name, count(*)::int n FROM analytics_event
     WHERE name = ANY($1)${ownerKind ? ' AND owner_kind=$2 AND owner_id=$3' : ''} GROUP BY name`,
    ownerKind ? [names, ownerKind, ownerId] : [names])).rows;
  const out: Record<string, number> = {};
  for (const n of names) out[n] = 0;
  for (const r of rows) out[r.name] = r.n;
  return out;
}
// Event-day conversion = superfan_converted events whose props mark room_live, over event_room_open.
export async function conversionRate(db: Database, ownerKind?: string, ownerId?: string): Promise<{ conversions: number; opens: number; rate: number }> {
  const c = await metricCounts(db, ['event_day_conversion', 'event_room_open'], ownerKind, ownerId);
  const rate = c.event_room_open ? Math.round((c.event_day_conversion / c.event_room_open) * 100) : 0;
  return { conversions: c.event_day_conversion, opens: c.event_room_open, rate };
}

// --- event room -----------------------------------------------------------
export type RoomState = 'upcoming' | 'live' | 'recap';
export interface RoomConfig { enabled: boolean; label: string | null; tier: string; stateOverride: string; result: string | null; startsAt: string | null }

const DEFAULT_LABEL: Record<string, string> = {
  boxing: 'Fight Night', mma: 'Fight Night', kickboxing: 'Fight Night', muay_thai: 'Fight Night',
  running: 'Race Day', triathlon: 'Race Day', cycling: 'Race Day', swimming: 'Race Day', athletics: 'Race Day',
};
export function defaultRoomLabel(sport: string | null | undefined): string {
  return DEFAULT_LABEL[(sport || '').toLowerCase()] ?? 'Matchday';
}

// Lifecycle: explicit override wins; else derive from time + result. Live window
// = 1h before start through 4h after (or until a result is posted → recap).
export function roomState(c: { stateOverride: string; result: string | null; startsAt: string | null }, now = new Date()): RoomState {
  if (c.stateOverride === 'live') return 'live';
  if (c.stateOverride === 'recap' || c.result) return 'recap';
  if (!c.startsAt) return 'upcoming';
  const t = new Date(c.startsAt).getTime();
  const ms = now.getTime();
  if (ms < t - 60 * 60 * 1000) return 'upcoming';
  if (ms > t + 4 * 60 * 60 * 1000) return 'recap';
  return 'live';
}

export async function setRoomConfig(db: Database, eventId: string, o: { enabled?: boolean; label?: string | null; tier?: string; stateOverride?: string }): Promise<void> {
  const sets: string[] = []; const vals: unknown[] = [eventId]; let i = 2;
  if (o.enabled !== undefined) { sets.push(`room_enabled=$${i++}`); vals.push(o.enabled); }
  if (o.label !== undefined) { sets.push(`room_label=$${i++}`); vals.push(o.label); }
  if (o.tier !== undefined) { sets.push(`room_tier=$${i++}`); vals.push(['public', 'supporter', 'clubhouse'].includes(o.tier) ? o.tier : 'supporter'); }
  if (o.stateOverride !== undefined) { sets.push(`room_state=$${i++}`); vals.push(['auto', 'live', 'recap'].includes(o.stateOverride) ? o.stateOverride : 'auto'); }
  if (sets.length) await db.query(`UPDATE event SET ${sets.join(', ')} WHERE id=$1`, vals);
}
export async function setResult(db: Database, eventId: string, result: string): Promise<void> {
  await db.query(`UPDATE event SET result=$2 WHERE id=$1`, [eventId, result]);
}
export async function getRoomConfig(db: Database, eventId: string): Promise<RoomConfig | null> {
  const r = (await db.query<any>(
    `SELECT room_enabled, room_label, room_tier, room_state, result, starts_at FROM event WHERE id=$1`, [eventId])).rows[0];
  if (!r) return null;
  return { enabled: r.room_enabled, label: r.room_label, tier: r.room_tier ?? 'supporter', stateOverride: r.room_state ?? 'auto', result: r.result, startsAt: r.starts_at ?? null };
}

export interface RoomMessage { id: string; authorKind: string; kind: string; body: string; name: string; date: string }
export async function listRoomMessages(db: Database, eventId: string, limit = 200): Promise<RoomMessage[]> {
  const rows = (await db.query<any>(
    `SELECT rm.id, rm.author_kind, rm.kind, rm.body, to_char(rm.created_at,'DD Mon HH24:MI') date,
            COALESCE(f.display_name, '') fan_name
     FROM room_message rm LEFT JOIN fan f ON f.id=rm.fan_id
     WHERE rm.event_id=$1 ORDER BY rm.created_at LIMIT $2`, [eventId, limit])).rows;
  return rows.map(r => ({ id: r.id, authorKind: r.author_kind, kind: r.kind, body: r.body, name: r.author_kind === 'athlete' ? 'host' : (r.fan_name || 'A fan'), date: r.date }));
}
// Live presence (the Spotify "Friend Activity" lesson) — who's actually here.
// `now` = distinct fans active (chat/react) in the last 30 min; `total` = everyone
// who's been in this room. No websockets: derived honestly from room_message.
export async function roomPresence(db: Database, eventId: string): Promise<{ now: number; total: number; names: string[] }> {
  const now = (await db.query<{ n: number }>(`SELECT count(DISTINCT fan_id)::int n FROM room_message WHERE event_id=$1 AND author_kind='fan' AND created_at > now() - interval '30 minutes'`, [eventId])).rows[0].n;
  const total = (await db.query<{ n: number }>(`SELECT count(DISTINCT fan_id)::int n FROM room_message WHERE event_id=$1 AND author_kind='fan'`, [eventId])).rows[0].n;
  const names = (await db.query<{ name: string }>(`SELECT DISTINCT COALESCE(f.display_name,'A fan') name FROM room_message rm JOIN fan f ON f.id=rm.fan_id WHERE rm.event_id=$1 AND rm.author_kind='fan' ORDER BY 1 LIMIT 5`, [eventId])).rows.map(r => r.name);
  return { now, total, names };
}
export async function postRoomMessage(db: Database, eventId: string, o: { authorKind: 'fan' | 'athlete'; fanId: string | null; kind: string; body: string }): Promise<void> {
  const kind = ['chat', 'bts', 'reaction'].includes(o.kind) ? o.kind : 'chat';
  const body = (o.body || '').slice(0, 600).trim();
  if (!body) return;
  await db.query(
    `INSERT INTO room_message (event_id, author_kind, fan_id, kind, body) VALUES ($1,$2,$3,$4,$5)`,
    [eventId, o.authorKind, o.fanId, kind, body]);
}
// Can this viewer see the LIVE room? Tiered: owner always; else viewer tier >= room_tier.
export async function canSeeLiveRoom(db: Database, fanId: string | null, ownerKind: string, ownerId: string, roomTier: string, isOwner: boolean): Promise<boolean> {
  if (isOwner) return true;
  if (roomTier === 'public') return true;
  if (!fanId) return false;
  const sf = await isSuperfan(db, fanId, ownerKind, ownerId);
  if (sf) return true;
  // fall back to explicit membership tier rank
  const m = (await db.query<{ tier_level: string }>(`SELECT tier_level FROM membership WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3 AND status='active'`, [fanId, ownerKind, ownerId])).rows[0];
  return tierRank(m?.tier_level) >= tierRank(roomTier);
}

// --- goals ----------------------------------------------------------------
export interface Goal {
  id: string; ownerKind: string; ownerId: string; metric: string; threshold: number;
  reward: string; rewardPostId: string | null; status: string;
  rivalKind: string | null; rivalId: string | null; windowStart: string | null; windowEnd: string | null;
}
export async function createGoal(db: Database, o: { ownerKind: string; ownerId: string; metric: string; threshold: number; reward: string; rewardPostId?: string | null; rivalKind?: string; rivalId?: string }): Promise<string> {
  const metric = ['superfans', 'members', 'support'].includes(o.metric) ? o.metric : 'superfans';
  const r = await db.query<{ id: string }>(
    `INSERT INTO goal (owner_kind, owner_id, metric, threshold, reward, reward_post_id, rival_kind, rival_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [o.ownerKind, o.ownerId, metric, Math.max(1, Math.round(o.threshold || 1)), (o.reward || 'a reward').slice(0, 200), o.rewardPostId ?? null, o.rivalKind ?? null, o.rivalId ?? null]);
  return r.rows[0].id;
}
function mapGoal(r: any): Goal {
  return { id: r.id, ownerKind: r.owner_kind, ownerId: r.owner_id, metric: r.metric, threshold: r.threshold, reward: r.reward, rewardPostId: r.reward_post_id, status: r.status, rivalKind: r.rival_kind, rivalId: r.rival_id, windowStart: r.window_start, windowEnd: r.window_end };
}
export async function listGoals(db: Database, ownerKind: string, ownerId: string): Promise<Goal[]> {
  return (await db.query<any>(`SELECT * FROM goal WHERE owner_kind=$1 AND owner_id=$2 ORDER BY created_at DESC`, [ownerKind, ownerId])).rows.map(mapGoal);
}
// Current value of a goal's metric for an owner.
export async function metricValue(db: Database, metric: string, ownerKind: string, ownerId: string): Promise<number> {
  if (metric === 'members') return memberCount(db, ownerKind, ownerId);
  if (metric === 'support') {
    return (await db.query<{ n: number }>(
      `SELECT COALESCE(SUM(price_cents),0)::int n FROM membership WHERE owner_kind=$1 AND owner_id=$2 AND status='active'`, [ownerKind, ownerId])).rows[0].n;
  }
  // superfans: active clubhouse members + loyalty-earned superfans (distinct fans)
  return (await db.query<{ n: number }>(
    `SELECT count(DISTINCT fan_id)::int n FROM (
        SELECT fan_id FROM membership WHERE owner_kind=$1 AND owner_id=$2 AND status='active' AND tier_level='clubhouse'
        UNION
        SELECT fan_id FROM loyalty_event WHERE owner_kind=$1 AND owner_id=$2 AND created_at > now() - interval '90 days'
          GROUP BY fan_id HAVING sum(points) >= 200
     ) s`, [ownerKind, ownerId])).rows[0].n;
}
export interface GoalProgress { goal: Goal; value: number; pct: number; reached: boolean; rivalValue?: number }
// Reads progress and auto-unlocks the reward on first hit (idempotent).
export async function progressAndSettle(db: Database, g: Goal): Promise<GoalProgress> {
  const value = await metricValue(db, g.metric, g.ownerKind, g.ownerId);
  const reached = value >= g.threshold;
  if (reached && g.status !== 'reached') {
    await db.query(`UPDATE goal SET status='reached', reached_at=now() WHERE id=$1 AND status<>'reached'`, [g.id]);
    if (g.rewardPostId) await db.query(`UPDATE post SET visibility='public' WHERE id=$1`, [g.rewardPostId]);
    await track(db, 'goal_reached', { ownerKind: g.ownerKind, ownerId: g.ownerId, props: { goal_id: g.id, metric: g.metric } });
    g.status = 'reached';
  }
  const out: GoalProgress = { goal: g, value, pct: Math.min(100, Math.round((value / g.threshold) * 100)), reached };
  if (g.rivalKind && g.rivalId) out.rivalValue = await metricValue(db, g.metric, g.rivalKind, g.rivalId);
  return out;
}
export async function activeGoalProgress(db: Database, ownerKind: string, ownerId: string): Promise<GoalProgress[]> {
  const goals = await listGoals(db, ownerKind, ownerId);
  const out: GoalProgress[] = [];
  for (const g of goals) out.push(await progressAndSettle(db, g));
  return out;
}
// goal_signup: a follow/conversion happened while the owner has an active goal.
export async function maybeGoalSignup(db: Database, ownerKind: string, ownerId: string, fanId: string | null, via: string): Promise<void> {
  const active = (await db.query(`SELECT 1 FROM goal WHERE owner_kind=$1 AND owner_id=$2 AND status='active' LIMIT 1`, [ownerKind, ownerId])).rows[0];
  if (active) await track(db, 'goal_signup', { ownerKind, ownerId, fanId, props: { via } });
}
// Called when a fan becomes a member/superfan. Records the conversion and — if a
// room for this owner is live right now — the event-day conversion (the key metric).
export async function trackConversion(db: Database, ownerKind: string, ownerId: string, fanId: string | null): Promise<void> {
  await track(db, 'superfan_converted', { ownerKind, ownerId, fanId });
  const ev = (await db.query<any>(`SELECT room_state, result, starts_at FROM event WHERE host_kind=$1 AND host_id=$2 AND room_enabled=true`, [ownerKind, ownerId])).rows;
  if (ev.some(e => roomState({ stateOverride: e.room_state, result: e.result, startsAt: e.starts_at }) === 'live')) {
    await track(db, 'event_day_conversion', { ownerKind, ownerId, fanId });
  }
  await maybeGoalSignup(db, ownerKind, ownerId, fanId, 'conversion');
}
export async function getGoal(db: Database, id: string): Promise<Goal | null> {
  const r = (await db.query<any>(`SELECT * FROM goal WHERE id=$1`, [id])).rows[0];
  return r ? mapGoal(r) : null;
}
