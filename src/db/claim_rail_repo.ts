// claim_rail_repo.ts — the pivot's spine: claims, passes, verified presence,
// standing (earned access), and the fan Record. The atomic unit is the claim.
import { randomBytes } from 'node:crypto';
import type { Database } from './index.ts';

export interface ClaimEvent {
  id: string; title: string; capacity: number | null; tier: string;
  registrationMode: string; standingThreshold: number; isParticipation: boolean;
  presenceMode: string; hostKind: string | null; hostId: string | null;
  admission: string; priceCents: number | null; startsAt: string | null;
}

// Spots remaining — scarcity is the product. Counts active (non-refunded) claims.
export async function spotsInfo(db: Database, eventId: string, capacity: number | null): Promise<{ claimed: number; remaining: number | null; full: boolean }> {
  const claimed = (await db.query<{ n: number }>(
    `SELECT COALESCE(SUM(party_size),0)::int n FROM claim WHERE event_id=$1 AND status <> 'refunded' AND status <> 'no_show'`, [eventId])).rows[0].n;
  const remaining = capacity == null ? null : Math.max(0, capacity - claimed);
  return { claimed, remaining, full: remaining !== null && remaining <= 0 };
}

export async function getClaim(db: Database, eventId: string, fanId: string): Promise<{ id: string; status: string } | null> {
  const r = (await db.query<{ id: string; status: string }>(`SELECT id, status FROM claim WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0];
  return r ?? null;
}

// Create a claim (+ its pass). Waitlists when full; approval mode → 'approved'
// pending; standing mode is checked by the caller. Idempotent per (event,fan).
export async function createClaim(db: Database, o: {
  eventId: string; fanId: string; capacity: number | null; mode: string; partySize?: number; priceCents?: number | null; sourceEdge?: string;
}): Promise<{ claimId: string; passToken: string; status: string }> {
  const existing = (await db.query<{ id: string }>(`SELECT id FROM claim WHERE event_id=$1 AND fan_id=$2`, [o.eventId, o.fanId])).rows[0];
  if (existing) {
    const p = (await db.query<{ token: string; status: string }>(
      `SELECT pa.token, c.status FROM claim c JOIN pass pa ON pa.claim_id=c.id WHERE c.id=$1`, [existing.id])).rows[0];
    return { claimId: existing.id, passToken: p?.token ?? '', status: p?.status ?? 'claimed' };
  }
  const info = await spotsInfo(db, o.eventId, o.capacity);
  const party = Math.max(1, o.partySize ?? 1);
  const status = info.full ? 'waitlisted' : (o.mode === 'approval' ? 'approved' : 'claimed');
  const claim = (await db.query<{ id: string }>(
    `INSERT INTO claim (event_id, fan_id, status, party_size, price_cents, source_edge) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [o.eventId, o.fanId, status, party, o.priceCents ?? null, o.sourceEdge ?? null])).rows[0];
  const token = randomBytes(16).toString('hex');
  await db.query(`INSERT INTO pass (claim_id, fan_id, token) VALUES ($1,$2,$3)`, [claim.id, o.fanId, token]);
  return { claimId: claim.id, passToken: token, status };
}

export interface PassView {
  token: string; claimId: string; fanId: string; status: string; eventId: string;
  eventTitle: string; startsAt: string | null; hostKind: string | null; hostId: string | null; verified: boolean;
  formatKind: string | null; formatLabel: string | null; channelUrl: string | null;
  accessMode: string; location: string | null; locationKind: string;
}
export async function getPass(db: Database, token: string): Promise<PassView | null> {
  const r = (await db.query<any>(
    `SELECT pa.token, pa.claim_id, pa.fan_id, c.status, c.event_id, e.name event_title, e.starts_at, e.host_kind, e.host_id,
            e.access_mode, e.location, e.location_kind,
            ef.kind fmt_kind, ef.label fmt_label, ef.channel_url,
            EXISTS (SELECT 1 FROM presence pr WHERE pr.claim_id=c.id) verified
     FROM pass pa JOIN claim c ON c.id=pa.claim_id JOIN event e ON e.id=c.event_id
     LEFT JOIN event_format ef ON ef.id=c.format_id WHERE pa.token=$1`, [token])).rows[0];
  if (!r) return null;
  return { token: r.token, claimId: r.claim_id, fanId: r.fan_id, status: r.status, eventId: r.event_id, eventTitle: r.event_title, startsAt: r.starts_at ?? null, hostKind: r.host_kind, hostId: r.host_id, verified: !!r.verified, formatKind: r.fmt_kind ?? null, formatLabel: r.fmt_label ?? null, channelUrl: r.channel_url ?? null, accessMode: r.access_mode ?? 'ticket', location: r.location ?? null, locationKind: r.location_kind ?? 'in_person' };
}

// Verify a pass at the gate → records presence (idempotent) + bumps standing.
export async function verifyPass(db: Database, token: string, byAccount: string | null, fidelity: 'in_room' | 'online' = 'in_room'): Promise<{ ok: boolean; already?: boolean; fanName?: string }> {
  const p = await getPass(db, token);
  if (!p) return { ok: false };
  const fanName = (await db.query<{ n: string }>(`SELECT display_name n FROM fan WHERE id=$1`, [p.fanId])).rows[0]?.n ?? 'A fan';
  if (p.verified) return { ok: true, already: true, fanName };
  await db.query(`INSERT INTO presence (claim_id, fan_id, event_id, fidelity, verified_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (claim_id) DO NOTHING`,
    [p.claimId, p.fanId, p.eventId, fidelity, byAccount]);
  await db.query(`UPDATE claim SET status='verified' WHERE id=$1`, [p.claimId]);
  if (p.hostKind && p.hostId) {
    await db.query(
      `INSERT INTO standing (fan_id, owner_kind, owner_id, presences) VALUES ($1,$2,$3,1)
       ON CONFLICT (fan_id, owner_kind, owner_id) DO UPDATE SET presences = standing.presences + 1, updated_at = now()`,
      [p.fanId, p.hostKind, p.hostId]);
  }
  return { ok: true, fanName };
}

// The fan Record — verified presence history (a passport of stamps).
export interface RecordRow { eventId: string; title: string; date: string; fidelity: string; hostKind: string | null; hostId: string | null; hostName: string }
export async function fanRecord(db: Database, fanId: string): Promise<RecordRow[]> {
  const rows = (await db.query<any>(
    `SELECT pr.event_id, e.name title, to_char(pr.verified_at,'DD Mon YYYY') date, pr.fidelity, e.host_kind, e.host_id
     FROM presence pr JOIN event e ON e.id=pr.event_id WHERE pr.fan_id=$1 ORDER BY pr.verified_at DESC`, [fanId])).rows;
  return rows.map(r => ({ eventId: r.event_id, title: r.title, date: r.date, fidelity: r.fidelity, hostKind: r.host_kind, hostId: r.host_id, hostName: '' }));
}
export async function recordCount(db: Database, fanId: string): Promise<{ total: number; inRoom: number }> {
  const r = (await db.query<{ total: number; in_room: number }>(
    `SELECT count(*)::int total, count(*) FILTER (WHERE fidelity='in_room')::int in_room FROM presence WHERE fan_id=$1`, [fanId])).rows[0];
  return { total: r?.total ?? 0, inRoom: r?.in_room ?? 0 };
}

// Morning-after: the most recent verified presence in the last 48h (the primary
// retention surface — arrives a few times a month, top-five open-rate metric).
export async function recentPresence(db: Database, fanId: string): Promise<{ title: string; date: string; hostKind: string | null; hostId: string | null } | null> {
  const r = (await db.query<any>(
    `SELECT e.name title, to_char(pr.verified_at,'DD Mon') date, e.host_kind, e.host_id
     FROM presence pr JOIN event e ON e.id=pr.event_id
     WHERE pr.fan_id=$1 AND pr.verified_at > now() - interval '48 hours' ORDER BY pr.verified_at DESC LIMIT 1`, [fanId])).rows[0];
  return r ? { title: r.title, date: r.date, hostKind: r.host_kind, hostId: r.host_id } : null;
}

export async function crowdStanding(db: Database, fanId: string | null, ownerKind: string, ownerId: string): Promise<number> {
  if (!fanId) return 0;
  return (await db.query<{ p: number }>(`SELECT COALESCE(presences,0) p FROM standing WHERE fan_id=$1 AND owner_kind=$2 AND owner_id=$3`, [fanId, ownerKind, ownerId])).rows[0]?.p ?? 0;
}

// --- consent (crowd-join = the consent action) ----------------------------
export async function grantConsent(db: Database, fanId: string, ownerKind: string, ownerId: string, channels: string[], provenance = 'crowd_join'): Promise<void> {
  for (const ch of channels) {
    if (!['email', 'sms', 'whatsapp', 'push'].includes(ch)) continue;
    await db.query(
      `INSERT INTO consent (fan_id, owner_kind, owner_id, channel, class, granted_at, provenance)
       VALUES ($1,$2,$3,$4,'marketing',now(),$5)
       ON CONFLICT (fan_id, owner_kind, owner_id, channel, class) DO UPDATE SET granted_at=now(), revoked_at=NULL, provenance=$5`,
      [fanId, ownerKind, ownerId, ch, provenance]);
  }
}
// The feed-of-doors: upcoming CLAIMABLE events from the crowds a fan follows.
// Every row terminates in a claim — never content. Finite by nature (a fan has a
// bounded set of followed crowds with upcoming events).
export interface Door { eventId: string; title: string; date: string | null; hostKind: string | null; hostId: string | null; hostName: string; remaining: number | null; tier: string; mine: boolean }
export async function feedDoors(db: Database, fanId: string, limit = 40): Promise<Door[]> {
  const rows = (await db.query<any>(
    `SELECT e.id, e.name title, to_char(e.starts_at,'Dy DD Mon · HH24:MI') date, e.host_kind, e.host_id, e.capacity, e.tier,
            EXISTS (SELECT 1 FROM claim c WHERE c.event_id=e.id AND c.fan_id=$1) mine
     FROM event e
     WHERE e.starts_at > now()
       AND EXISTS (SELECT 1 FROM follow f WHERE f.fan_id=$1 AND f.target_type::text=e.host_kind::text AND f.target_id=e.host_id)
     ORDER BY e.starts_at ASC LIMIT $2`, [fanId, limit])).rows;
  const out: Door[] = [];
  for (const r of rows) {
    const info = await spotsInfo(db, r.id, r.capacity ?? null);
    out.push({ eventId: r.id, title: r.title, date: r.date ?? null, hostKind: r.host_kind, hostId: r.host_id, hostName: '', remaining: info.remaining, tier: r.tier ?? 'gathering', mine: !!r.mine });
  }
  return out;
}

export async function consentedReach(db: Database, ownerKind: string, ownerId: string): Promise<number> {
  return (await db.query<{ n: number }>(
    `SELECT count(DISTINCT fan_id)::int n FROM consent WHERE owner_kind=$1 AND owner_id=$2 AND class='marketing' AND granted_at IS NOT NULL AND revoked_at IS NULL`,
    [ownerKind, ownerId])).rows[0].n;
}
