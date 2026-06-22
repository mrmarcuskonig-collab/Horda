// membership_repo.ts — paid supporter tiers + memberships + member checks.
// Monetizes closeness (access/depth); the shareable artifacts stay free.
import type { Database } from './index.ts';

export interface Tier { name: string; priceCents: number; currency: string; perks: string[] }

export async function setTier(db: Database, ownerKind: string, ownerId: string, t: Tier): Promise<void> {
  await db.query(
    `INSERT INTO membership_tier (owner_kind,owner_id,name,price_cents,currency,perks)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (owner_kind,owner_id) DO UPDATE SET name=$3, price_cents=$4, currency=$5, perks=$6::jsonb`,
    [ownerKind, ownerId, t.name, t.priceCents, t.currency, JSON.stringify(t.perks)]);
}
export async function getTier(db: Database, ownerKind: string, ownerId: string): Promise<Tier | null> {
  const r = (await db.query<any>(`SELECT name, price_cents, currency, perks FROM membership_tier WHERE owner_kind=$1 AND owner_id=$2`, [ownerKind, ownerId])).rows[0];
  return r ? { name: r.name, priceCents: r.price_cents, currency: r.currency, perks: r.perks ?? [] } : null;
}

export async function joinMembership(db: Database, fanId: string, ownerKind: string, ownerId: string): Promise<number> {
  const existing = (await db.query<any>(`SELECT member_no FROM membership WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3`, [fanId, ownerKind, ownerId])).rows[0];
  if (existing) return existing.member_no;
  const next = (await db.query<any>(`SELECT coalesce(max(member_no),0)+1 n FROM membership WHERE owner_kind=$1 AND owner_id=$2`, [ownerKind, ownerId])).rows[0].n;
  await db.query(`INSERT INTO membership (fan_id,owner_kind,owner_id,member_no) VALUES ($1,$2,$3,$4)`, [fanId, ownerKind, ownerId, next]);
  return next;
}
export async function getMembership(db: Database, fanId: string | null, ownerKind: string, ownerId: string): Promise<{ memberNo: number } | null> {
  if (!fanId) return null;
  const r = (await db.query<any>(`SELECT member_no FROM membership WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3 AND status='active'`, [fanId, ownerKind, ownerId])).rows[0];
  return r ? { memberNo: r.member_no } : null;
}
export async function memberCount(db: Database, ownerKind: string, ownerId: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM membership WHERE owner_kind=$1 AND owner_id=$2 AND status='active'`, [ownerKind, ownerId])).rows[0].n;
}
