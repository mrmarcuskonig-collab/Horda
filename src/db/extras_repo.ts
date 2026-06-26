// extras_repo.ts — the build-order growth + media surface: profile media grid,
// sponsors, newsletter opt-ins, handle reservations, and athlete banner styling.
import type { Database } from './index.ts';

// --- media grid -----------------------------------------------------------
export interface MediaItem { id: string; kind: string; url: string; caption: string | null }

export async function listMedia(db: Database, ownerKind: string, ownerId: string): Promise<MediaItem[]> {
  const r = await db.query<MediaItem>(
    `SELECT id, kind, url, caption FROM profile_media WHERE owner_kind=$1 AND owner_id=$2 ORDER BY ord, created_at`,
    [ownerKind, ownerId]);
  return r.rows;
}
export async function addMedia(db: Database, ownerKind: string, ownerId: string, kind: string, url: string, caption?: string): Promise<void> {
  const k = ['image', 'video', 'embed'].includes(kind) ? kind : 'image';
  await db.query(
    `INSERT INTO profile_media (owner_kind, owner_id, kind, url, caption, ord)
     VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(ord),0)+1 FROM profile_media WHERE owner_kind=$1 AND owner_id=$2))`,
    [ownerKind, ownerId, k, url, caption ?? null]);
}
export async function deleteMedia(db: Database, ownerKind: string, ownerId: string, id: string): Promise<void> {
  await db.query(`DELETE FROM profile_media WHERE id=$1 AND owner_kind=$2 AND owner_id=$3`, [id, ownerKind, ownerId]);
}

// --- sponsors -------------------------------------------------------------
export interface Sponsor { id: string; name: string; url: string | null; logoUrl: string | null }

export async function listSponsors(db: Database, ownerKind: string, ownerId: string): Promise<Sponsor[]> {
  const r = await db.query<{ id: string; name: string; url: string | null; logo_url: string | null }>(
    `SELECT id, name, url, logo_url FROM sponsor WHERE owner_kind=$1 AND owner_id=$2 ORDER BY ord, created_at`,
    [ownerKind, ownerId]);
  return r.rows.map(s => ({ id: s.id, name: s.name, url: s.url, logoUrl: s.logo_url }));
}
export async function addSponsor(db: Database, ownerKind: string, ownerId: string, name: string, url?: string, logoUrl?: string): Promise<void> {
  await db.query(
    `INSERT INTO sponsor (owner_kind, owner_id, name, url, logo_url, ord)
     VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(ord),0)+1 FROM sponsor WHERE owner_kind=$1 AND owner_id=$2))`,
    [ownerKind, ownerId, name.slice(0, 80), url || null, logoUrl || null]);
}
export async function deleteSponsor(db: Database, ownerKind: string, ownerId: string, id: string): Promise<void> {
  await db.query(`DELETE FROM sponsor WHERE id=$1 AND owner_kind=$2 AND owner_id=$3`, [id, ownerKind, ownerId]);
}

// --- shop -----------------------------------------------------------------
export interface ShopItem { id: string; kind: string; title: string; subtitle: string | null; url: string | null; priceCents: number | null }
const SHOP_KINDS = ['merch', 'gift_membership', 'discount', 'link'];
export async function listShopItems(db: Database, ownerKind: string, ownerId: string): Promise<ShopItem[]> {
  const r = await db.query<{ id: string; kind: string; title: string; subtitle: string | null; url: string | null; price_cents: number | null }>(
    `SELECT id, kind, title, subtitle, url, price_cents FROM shop_item WHERE owner_kind=$1 AND owner_id=$2 ORDER BY ord, created_at`,
    [ownerKind, ownerId]);
  return r.rows.map(s => ({ id: s.id, kind: s.kind, title: s.title, subtitle: s.subtitle, url: s.url, priceCents: s.price_cents }));
}
export async function addShopItem(db: Database, ownerKind: string, ownerId: string, o: { kind: string; title: string; subtitle?: string; url?: string; priceCents?: number | null }): Promise<void> {
  const kind = SHOP_KINDS.includes(o.kind) ? o.kind : 'merch';
  await db.query(
    `INSERT INTO shop_item (owner_kind, owner_id, kind, title, subtitle, url, price_cents, ord)
     VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(ord),0)+1 FROM shop_item WHERE owner_kind=$1 AND owner_id=$2))`,
    [ownerKind, ownerId, kind, o.title.slice(0, 80), o.subtitle || null, o.url || null, o.priceCents ?? null]);
}
export async function deleteShopItem(db: Database, ownerKind: string, ownerId: string, id: string): Promise<void> {
  await db.query(`DELETE FROM shop_item WHERE id=$1 AND owner_kind=$2 AND owner_id=$3`, [id, ownerKind, ownerId]);
}

// --- newsletter -----------------------------------------------------------
// Returns true if this is a newly-added subscriber (false if already on the list).
export async function subscribeNewsletter(db: Database, ownerKind: string, ownerId: string, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  const r = await db.query<{ id: string }>(
    `INSERT INTO newsletter_subscriber (owner_kind, owner_id, email) VALUES ($1,$2,$3)
     ON CONFLICT (owner_kind, owner_id, email) DO NOTHING RETURNING id`,
    [ownerKind, ownerId, e]);
  return r.rows.length > 0;
}
export async function newsletterCount(db: Database, ownerKind: string, ownerId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM newsletter_subscriber WHERE owner_kind=$1 AND owner_id=$2`, [ownerKind, ownerId]);
  return r.rows[0].n;
}

// --- handle reservation (vitality campaign) -------------------------------
export async function reserveHandle(db: Database, handle: string, email: string, kind?: string): Promise<{ ok: boolean; reason?: string }> {
  const h = handle.trim().toLowerCase().replace(/^@/, '');
  const e = email.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,30}$/.test(h)) return { ok: false, reason: 'invalid' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, reason: 'email' };
  // already a live page on that handle? then it's taken.
  const taken = (await db.query(`SELECT 1 FROM athlete WHERE lower(handle)=$1`, [h])).rows.length > 0;
  if (taken) return { ok: false, reason: 'taken' };
  const r = await db.query<{ id: string }>(
    `INSERT INTO handle_reservation (handle, email, kind) VALUES ($1,$2,$3) ON CONFLICT (handle) DO NOTHING RETURNING id`,
    [h, e, kind ?? null]);
  return r.rows.length > 0 ? { ok: true } : { ok: false, reason: 'taken' };
}

// --- athlete banner styling (reposition + video) --------------------------
export interface BannerStyle { pos: { x: number; y: number; zoom: number } | null; videoUrl: string | null }

export async function getBannerStyle(db: Database, athleteId: string): Promise<BannerStyle> {
  const r = await db.query<{ banner_pos: string | null; banner_video_url: string | null }>(
    `SELECT banner_pos, banner_video_url FROM athlete WHERE id=$1`, [athleteId]);
  const row = r.rows[0];
  let pos: BannerStyle['pos'] = null;
  if (row?.banner_pos) { try { const p = JSON.parse(row.banner_pos); if (p && typeof p.x === 'number') pos = { x: p.x, y: p.y, zoom: p.zoom || 1 }; } catch { /* ignore */ } }
  return { pos, videoUrl: row?.banner_video_url ?? null };
}
export async function setBannerStyle(db: Database, athleteId: string, o: { pos?: { x: number; y: number; zoom: number } | null; videoUrl?: string | null }): Promise<void> {
  if (o.pos !== undefined) {
    const v = o.pos ? JSON.stringify({ x: clamp(o.pos.x), y: clamp(o.pos.y), zoom: Math.min(3, Math.max(1, o.pos.zoom || 1)) }) : null;
    await db.query(`UPDATE athlete SET banner_pos=$2 WHERE id=$1`, [athleteId, v]);
  }
  if (o.videoUrl !== undefined) {
    const u = o.videoUrl && /^(https?:|data:|\/)/.test(o.videoUrl) ? o.videoUrl : null;
    await db.query(`UPDATE athlete SET banner_video_url=$2 WHERE id=$1`, [athleteId, u]);
  }
}
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(Number(n) || 50)));
