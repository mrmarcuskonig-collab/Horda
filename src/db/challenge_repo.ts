// challenge_repo.ts — the eligibility ledger for attendance challenges.
//
// A challenge links to SPECIFIC events (one, a selected series, or — for a sponsor —
// an event the issuer doesn't organise) via `challenge_event`. Furia computes WHO
// qualified from real presence at those linked events; the issuer fulfils the reward
// manually (raffle-style). Progress is always computed on read — never a counter.
import type { Database } from './index.ts';
import { PRODUCT_SOURCE } from './product.ts';

export type HostKind = 'athlete' | 'club' | 'team' | 'association';
export interface Challenge {
  id: string; issuerKind: HostKind; issuerId: string; title: string; metric: string;
  threshold: number; windowStart: string | null; windowEnd: string | null; rewardText: string; createdAt: string;
}
const map = (r: any): Challenge => ({
  id: r.id, issuerKind: r.issuer_kind, issuerId: r.issuer_id, title: r.title, metric: r.metric,
  threshold: r.threshold, windowStart: r.window_start, windowEnd: r.window_end, rewardText: r.reward_text, createdAt: r.created_at,
});

// Create a challenge and link the events that count toward it.
export async function createChallenge(db: Database, o: {
  issuerKind: HostKind; issuerId: string; title: string; threshold: number;
  eventIds: string[]; rewardText?: string;
}): Promise<string> {
  const th = Math.max(1, Math.round(Number(o.threshold) || 1));
  const id = (await db.query<{ id: string }>(
    `INSERT INTO challenge (issuer_kind, issuer_id, title, metric, threshold, reward_text, source)
     VALUES ($1,$2,$3,'attendance',$4,$5,$6) RETURNING id`,
    [o.issuerKind, o.issuerId, o.title.trim().slice(0, 140) || 'Challenge', th, (o.rewardText ?? '').trim().slice(0, 300), PRODUCT_SOURCE])).rows[0].id;
  for (const ev of [...new Set(o.eventIds)].filter(Boolean)) {
    await db.query(`INSERT INTO challenge_event (challenge_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, ev]);
  }
  return id;
}

export async function getChallenge(db: Database, id: string): Promise<Challenge | null> {
  const r = (await db.query(`SELECT * FROM challenge WHERE id=$1`, [id])).rows[0];
  return r ? map(r) : null;
}

export async function listChallengesForHost(db: Database, kind: HostKind, id: string): Promise<Challenge[]> {
  return (await db.query(`SELECT * FROM challenge WHERE issuer_kind=$1 AND issuer_id=$2 ORDER BY created_at DESC`, [kind, id])).rows.map(map);
}

// The issuer's most recent challenge — what the fan-facing hero strip highlights.
export async function topChallengeForHost(db: Database, kind: HostKind, id: string): Promise<Challenge | null> {
  const r = (await db.query(`SELECT * FROM challenge WHERE issuer_kind=$1 AND issuer_id=$2 ORDER BY created_at DESC LIMIT 1`, [kind, id])).rows[0];
  return r ? map(r) : null;
}

// The events a challenge counts (titles for display).
export async function getChallengeEvents(db: Database, challengeId: string): Promise<{ id: string; title: string }[]> {
  return (await db.query<{ id: string; title: string }>(
    `SELECT e.id, e.name title FROM challenge_event ce JOIN event e ON e.id=ce.event_id WHERE ce.challenge_id=$1 ORDER BY e.starts_at`, [challengeId])).rows;
}

// The issuer's own events — what the create form offers to tick.
export async function listLinkableEvents(db: Database, kind: HostKind, id: string, limit = 50): Promise<{ id: string; title: string; startsAt: string | null }[]> {
  return (await db.query<{ id: string; title: string; starts_at: string | null }>(
    `SELECT id, name title, starts_at FROM event WHERE host_kind=$1 AND host_id=$2 ORDER BY starts_at DESC NULLS LAST LIMIT $3`, [kind, id, limit]))
    .rows.map(r => ({ id: r.id, title: r.title, startsAt: r.starts_at }));
}

// How many of the challenge's LINKED events this fan verifiably attended.
export async function attendanceCount(db: Database, challengeId: string, fanId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(DISTINCT p.event_id)::int n
       FROM presence p JOIN challenge_event ce ON ce.event_id = p.event_id
      WHERE ce.challenge_id=$1 AND p.fan_id=$2`, [challengeId, fanId]);
  return r.rows[0].n;
}

export async function progressFor(db: Database, challengeId: string, fanId: string): Promise<{ count: number; threshold: number; met: boolean } | null> {
  const c = await getChallenge(db, challengeId);
  if (!c) return null;
  const count = await attendanceCount(db, challengeId, fanId);
  return { count, threshold: c.threshold, met: count >= c.threshold };
}

// Everyone at/above the threshold — the list the issuer fulfils manually.
export async function qualifiers(db: Database, challengeId: string): Promise<{ fanId: string; count: number }[]> {
  const c = await getChallenge(db, challengeId);
  if (!c) return [];
  const r = await db.query<{ fan_id: string; n: number }>(
    `SELECT p.fan_id, count(DISTINCT p.event_id)::int n
       FROM presence p JOIN challenge_event ce ON ce.event_id = p.event_id
      WHERE ce.challenge_id=$1
      GROUP BY p.fan_id HAVING count(DISTINCT p.event_id) >= $2
      ORDER BY n DESC`, [challengeId, c.threshold]);
  return r.rows.map(x => ({ fanId: x.fan_id, count: x.n }));
}
