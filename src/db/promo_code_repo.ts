// promo_code_repo.ts — an organiser's discount codes for an event's paid tickets.
//
// A code is a memorable string (case-insensitive) with a percent_off in
// {10, 20, 50, 100}. 100 = free. Several codes per event; `uses` counts
// redemptions so the organiser sees what's working. Application (discounting the
// price at claim time) lives in the server; this repo is storage + validation.
import type { Database } from './index.ts';

export interface PromoCode { id: string; code: string; percentOff: number; maxUses: number | null; uses: number }

// Only these discounts are offered — the product picks them, not free-form % that
// invites typos and weird pricing. 100 = a free code.
export const PROMO_PERCENTS = [10, 20, 50, 100] as const;
export const isValidPercent = (n: number) => (PROMO_PERCENTS as readonly number[]).includes(n);

// Codes are what a fan types: letters, numbers, hyphens; 2–24 chars; stored and
// compared upper-cased so "derby10" and "DERBY10" are the same code.
export function normalizeCode(raw: string): string { return (raw || '').trim().toUpperCase().replace(/\s+/g, ''); }
export function isValidCode(code: string): boolean { return /^[A-Z0-9-]{2,24}$/.test(code); }

const map = (r: any): PromoCode => ({ id: r.id, code: r.code, percentOff: r.percent_off, maxUses: r.max_uses ?? null, uses: r.uses });

export async function listPromoCodes(db: Database, eventId: string): Promise<PromoCode[]> {
  const r = await db.query<any>(`SELECT id, code, percent_off, max_uses, uses FROM promo_code WHERE event_id=$1 ORDER BY created_at`, [eventId]);
  return r.rows.map(map);
}

export interface CreatePromoResult { ok: boolean; code?: PromoCode; error?: string }
export async function createPromoCode(db: Database, eventId: string, rawCode: string, percentOff: number, maxUses: number | null = null): Promise<CreatePromoResult> {
  const code = normalizeCode(rawCode);
  if (!isValidCode(code)) return { ok: false, error: 'Codes are 2–24 letters, numbers or hyphens.' };
  if (!isValidPercent(percentOff)) return { ok: false, error: 'Pick a 10%, 20%, 50% or free discount.' };
  const exists = (await db.query(`SELECT 1 FROM promo_code WHERE event_id=$1 AND lower(code)=lower($2)`, [eventId, code])).rows[0];
  if (exists) return { ok: false, error: 'That code already exists for this event.' };
  const r = await db.query<any>(
    `INSERT INTO promo_code (event_id, code, percent_off, max_uses) VALUES ($1,$2,$3,$4)
     RETURNING id, code, percent_off, max_uses, uses`,
    [eventId, code, percentOff, maxUses]);
  return { ok: true, code: map(r.rows[0]) };
}

export async function deletePromoCode(db: Database, eventId: string, id: string): Promise<void> {
  await db.query(`DELETE FROM promo_code WHERE id=$1 AND event_id=$2`, [id, eventId]);
}

// Resolve a code a fan typed for this event. Returns null if unknown or fully used.
export async function getPromoCode(db: Database, eventId: string, rawCode: string): Promise<PromoCode | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const r = await db.query<any>(`SELECT id, code, percent_off, max_uses, uses FROM promo_code WHERE event_id=$1 AND lower(code)=lower($2)`, [eventId, code]);
  const p = r.rows[0] ? map(r.rows[0]) : null;
  if (!p) return null;
  if (p.maxUses != null && p.uses >= p.maxUses) return null;   // exhausted
  return p;
}

// Apply a percentage discount to a price, rounding to whole cents, never below 0.
export function applyPercent(priceCents: number, percentOff: number): number {
  if (!priceCents || !percentOff) return priceCents;
  return Math.max(0, Math.round(priceCents * (100 - percentOff) / 100));
}

// Count a redemption (best-effort; a race that over-counts by one is harmless).
export async function recordPromoUse(db: Database, id: string): Promise<void> {
  await db.query(`UPDATE promo_code SET uses = uses + 1 WHERE id=$1`, [id]);
}
