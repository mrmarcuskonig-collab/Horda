// membership_repo.ts — Substack-style tiers tailored to sport.
//   Follow (free) · Supporter (paid, monthly/annual) · Clubhouse (premium).
// "Superfan" is a STATUS, not a tier: held by Clubhouse members OR earned for
// free via a decaying loyalty score (attend / predict / share). Shareable
// artifacts stay free; tiers monetize depth + exclusivity.
import type { Database } from './index.ts';

export type TierLevel = 'supporter' | 'clubhouse';
export interface Tier { level: TierLevel; name: string; priceCents: number; priceAnnualCents: number | null; currency: string; perks: string[] }

const rowToTier = (r: any): Tier => ({ level: r.level, name: r.name, priceCents: r.price_cents, priceAnnualCents: r.price_annual_cents ?? null, currency: r.currency, perks: r.perks ?? [] });

export async function setTier(db: Database, ownerKind: string, ownerId: string, t: Tier): Promise<void> {
  await db.query(
    `INSERT INTO membership_tier (owner_kind,owner_id,level,name,price_cents,price_annual_cents,currency,perks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (owner_kind,owner_id,level) DO UPDATE SET name=$4, price_cents=$5, price_annual_cents=$6, currency=$7, perks=$8::jsonb`,
    [ownerKind, ownerId, t.level, t.name, t.priceCents, t.priceAnnualCents ?? null, t.currency, JSON.stringify(t.perks)]);
}
export async function getTiers(db: Database, ownerKind: string, ownerId: string): Promise<Tier[]> {
  const rows = (await db.query<any>(`SELECT level,name,price_cents,price_annual_cents,currency,perks FROM membership_tier WHERE owner_kind=$1 AND owner_id=$2 ORDER BY (level='clubhouse')`, [ownerKind, ownerId])).rows;
  return rows.map(rowToTier);
}
export async function getTier(db: Database, ownerKind: string, ownerId: string, level: TierLevel = 'supporter'): Promise<Tier | null> {
  const r = (await db.query<any>(`SELECT level,name,price_cents,price_annual_cents,currency,perks FROM membership_tier WHERE owner_kind=$1 AND owner_id=$2 AND level=$3`, [ownerKind, ownerId, level])).rows[0];
  return r ? rowToTier(r) : null;
}

const RANK: Record<string, number> = { supporter: 1, clubhouse: 2 };

export async function joinMembership(db: Database, fanId: string, ownerKind: string, ownerId: string, tierLevel: TierLevel = 'supporter', billing = 'free', subscriptionId: string | null = null): Promise<number> {
  const existing = (await db.query<any>(`SELECT member_no, tier_level FROM membership WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3`, [fanId, ownerKind, ownerId])).rows[0];
  if (existing) {
    const level = (RANK[tierLevel] ?? 1) >= (RANK[existing.tier_level] ?? 1) ? tierLevel : existing.tier_level;  // upgrade, never silent downgrade
    await db.query(`UPDATE membership SET tier_level=$4, billing=$5, status='active', stripe_subscription_id=coalesce($6, stripe_subscription_id) WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3`, [fanId, ownerKind, ownerId, level, billing, subscriptionId]);
    return existing.member_no;
  }
  const next = (await db.query<any>(`SELECT coalesce(max(member_no),0)+1 n FROM membership WHERE owner_kind=$1 AND owner_id=$2`, [ownerKind, ownerId])).rows[0].n;
  await db.query(`INSERT INTO membership (fan_id,owner_kind,owner_id,member_no,tier_level,billing,stripe_subscription_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [fanId, ownerKind, ownerId, next, tierLevel, billing, subscriptionId]);
  return next;
}

// Stripe told us a subscription ended (cancellation, failed payment, etc.).
// Deactivate the matching membership → access reverts to free Follow on next read.
export async function cancelMembershipBySub(db: Database, subscriptionId: string): Promise<boolean> {
  if (!subscriptionId) return false;
  const r = await db.query<{ fan_id: string }>(`UPDATE membership SET status='canceled', tier_level='supporter' WHERE stripe_subscription_id=$1 AND status='active' RETURNING fan_id`, [subscriptionId]);
  return r.rows.length > 0;
}

export interface MembershipRec { memberNo: number; tierLevel: TierLevel; billing: string }
export async function getMembership(db: Database, fanId: string | null, ownerKind: string, ownerId: string): Promise<MembershipRec | null> {
  if (!fanId) return null;
  const r = (await db.query<any>(`SELECT member_no, tier_level, billing FROM membership WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3 AND status='active'`, [fanId, ownerKind, ownerId])).rows[0];
  return r ? { memberNo: r.member_no, tierLevel: r.tier_level, billing: r.billing } : null;
}
export async function memberCount(db: Database, ownerKind: string, ownerId: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM membership WHERE owner_kind=$1 AND owner_id=$2 AND status='active'`, [ownerKind, ownerId])).rows[0].n;
}

// --- loyalty → earned Superfan -------------------------------------------------
// Sharing is weighted highest — spread is the whole game. Score decays over a
// rolling 90-day window so it reflects *current* loyalty, not all-time.
export const LOYALTY_POINTS: Record<string, number> = { follow: 5, rsvp: 10, attend: 20, predict: 5, predict_correct: 10, share: 15, weekly: 5 };
export const SUPERFAN_THRESHOLD = 200;

export async function recordLoyalty(db: Database, fanId: string | null, ownerKind: string, ownerId: string, kind: string): Promise<void> {
  const pts = LOYALTY_POINTS[kind];
  if (!pts || !fanId) return;
  await db.query(`INSERT INTO loyalty_event (fan_id,owner_kind,owner_id,kind,points) VALUES ($1,$2,$3,$4,$5)`, [fanId, ownerKind, ownerId, kind, pts]);
}
export async function loyaltyScore(db: Database, fanId: string | null, ownerKind: string, ownerId: string): Promise<number> {
  if (!fanId) return 0;
  return (await db.query<{ n: number }>(`SELECT coalesce(sum(points),0)::int n FROM loyalty_event WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3 AND created_at > now() - interval '90 days'`, [fanId, ownerKind, ownerId])).rows[0].n;
}
export async function isSuperfan(db: Database, fanId: string | null, ownerKind: string, ownerId: string): Promise<boolean> {
  if (!fanId) return false;
  const m = await getMembership(db, fanId, ownerKind, ownerId);
  if (m?.tierLevel === 'clubhouse') return true;
  return (await loyaltyScore(db, fanId, ownerKind, ownerId)) >= SUPERFAN_THRESHOLD;
}
export async function topSuperfans(db: Database, ownerKind: string, ownerId: string, limit = 5): Promise<{ fanId: string; name: string; score: number }[]> {
  const rows = (await db.query<any>(
    `SELECT le.fan_id, f.display_name name, sum(le.points)::int score
     FROM loyalty_event le JOIN fan f ON f.id=le.fan_id
     WHERE le.owner_kind=$1 AND le.owner_id=$2 AND le.created_at > now() - interval '90 days'
     GROUP BY le.fan_id, f.display_name HAVING sum(le.points) >= $3 ORDER BY score DESC LIMIT $4`,
    [ownerKind, ownerId, SUPERFAN_THRESHOLD, limit])).rows;
  return rows.map(r => ({ fanId: r.fan_id, name: r.name, score: r.score }));
}

// --- post tier gating ----------------------------------------------------------
// 'members' is the legacy value = supporter-and-up.
export function tierRank(level: string | null | undefined): number {
  return level === 'clubhouse' ? 2 : (level === 'supporter' || level === 'members') ? 1 : 0;
}
export function canSeePost(viewerTier: string | null | undefined, visibility: string): boolean {
  return tierRank(viewerTier) >= tierRank(visibility);
}
