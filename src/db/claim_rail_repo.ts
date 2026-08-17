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

// Spots remaining — scarcity is the product, and this number decides whether a
// real person is turned away at a real door. Two exclusions, both load-bearing:
//
//   voided_at IS NULL — a claim transferred away (0042) belongs to whoever it was
//     reissued to. Counting both would double-book the room.
//
//   status IN (claimed, approved, verified) — this used to be `<> 'refunded' AND
//     <> 'no_show'`, which COUNTED THE WAITLIST against capacity. A waitlisted
//     person is not holding a seat, they're hoping for one — so a sold-out event
//     stayed sold out no matter how many people left, because the seats read as
//     taken by the very people queuing for them. The waitlist could never drain.
//     formatSpots (the per-door path) already had this right; the event-level
//     path did not, and every legacy event without doors used it.
export async function spotsInfo(db: Database, eventId: string, capacity: number | null): Promise<{ claimed: number; remaining: number | null; full: boolean }> {
  const claimed = (await db.query<{ n: number }>(
    `SELECT COALESCE(SUM(party_size),0)::int n FROM claim
     WHERE event_id=$1 AND status IN ('claimed','approved','verified') AND voided_at IS NULL`, [eventId])).rows[0].n;
  const remaining = capacity == null ? null : Math.max(0, capacity - claimed);
  return { claimed, remaining, full: remaining !== null && remaining <= 0 };
}

// A voided claim is history, not a spot. Someone who gave their ticket away must
// read as "not attending" everywhere — and must be able to claim again.
export async function getClaim(db: Database, eventId: string, fanId: string): Promise<{ id: string; status: string } | null> {
  const r = (await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM claim WHERE event_id=$1 AND fan_id=$2 AND voided_at IS NULL ORDER BY created_at DESC LIMIT 1`, [eventId, fanId])).rows[0];
  return r ?? null;
}

// Create a claim (+ its pass). Waitlists when full; approval mode → 'approved'
// pending; standing mode is checked by the caller. Idempotent per (event,fan).
/**
 * Spots left in ONE way-in. Capacity is per format — 100 seats in the hall,
 * unlimited on the stream — so counting event-wide would let the hall selling
 * out slam the stream shut too. Counts party_size, not claims: one person
 * taking four tickets consumes four seats.
 */
export async function formatSpots(db: Database, formatId: string, capacity: number | null): Promise<{ taken: number; remaining: number | null; full: boolean }> {
  const taken = (await db.query<{ n: number }>(
    `SELECT COALESCE(sum(party_size),0)::int n FROM claim WHERE format_id=$1 AND status IN ('claimed','approved','verified') AND voided_at IS NULL`,
    [formatId])).rows[0]?.n ?? 0;
  if (capacity == null) return { taken, remaining: null, full: false };
  return { taken, remaining: Math.max(0, capacity - taken), full: taken >= capacity };
}

export async function createClaim(db: Database, o: {
  eventId: string; fanId: string; capacity: number | null; mode: string; partySize?: number; priceCents?: number | null; sourceEdge?: string;
  /** The way-in the fan chose. Drives per-format capacity + the max-per-person cap. */
  formatId?: string | null;
  /** Per-format ceiling on how many spots one person may take (organiser's choice). */
  maxPerPerson?: number;
}): Promise<{ claimId: string; passToken: string; status: string; partySize: number }> {
  const existing = (await db.query<{ id: string; party_size: number }>(
    `SELECT id, party_size FROM claim WHERE event_id=$1 AND fan_id=$2 AND voided_at IS NULL`, [o.eventId, o.fanId])).rows[0];
  if (existing) {
    const p = (await db.query<{ token: string; status: string }>(
      `SELECT pa.token, c.status FROM claim c JOIN pass pa ON pa.claim_id=c.id WHERE c.id=$1`, [existing.id])).rows[0];
    return { claimId: existing.id, passToken: p?.token ?? '', status: p?.status ?? 'claimed', partySize: existing.party_size };
  }
  // Clamp server-side. The quantity picker is a <select>, and a <select> is a
  // suggestion — anyone can post party_size=500 at a 4-ticket event.
  const cap = Math.max(1, o.maxPerPerson ?? 1);
  const party = Math.min(cap, Math.max(1, o.partySize ?? 1));
  // Per-format capacity when a format was chosen; event-level otherwise (legacy
  // events, and events with no formats defined).
  const info = o.formatId
    ? await formatSpots(db, o.formatId, o.capacity)
    : await spotsInfo(db, o.eventId, o.capacity);
  const status = info.full ? 'waitlisted' : (o.mode === 'approval' ? 'approved' : 'claimed');
  const claim = (await db.query<{ id: string }>(
    `INSERT INTO claim (event_id, fan_id, status, party_size, price_cents, source_edge, format_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [o.eventId, o.fanId, status, party, o.priceCents ?? null, o.sourceEdge ?? null, o.formatId ?? null])).rows[0];
  const token = randomBytes(16).toString('hex');
  await db.query(`INSERT INTO pass (claim_id, fan_id, token) VALUES ($1,$2,$3)`, [claim.id, o.fanId, token]);
  return { claimId: claim.id, passToken: token, status, partySize: party };
}

export interface PassView {
  token: string; claimId: string; fanId: string; status: string; eventId: string;
  eventTitle: string; startsAt: string | null; hostKind: string | null; hostId: string | null; verified: boolean;
  formatKind: string | null; formatLabel: string | null; channelUrl: string | null;
  accessMode: string; location: string | null; locationKind: string;
  /** Venue zone — the ticket must state the time AT THE VENUE. */
  timezone: string | null;
}
/**
 * Normalise a pass code the way a human hands it over. The code is lowercase
 * hex, but the pass page shows it in spaced groups of four and an organiser
 * retyping it at the door produces "A1B2 C3D4 …" — which used to miss the exact
 * `pa.token = $1` match and read back as "Not a valid pass" with a valid ticket
 * in the fan's hand. Normalising the PARAMETER (not the column) keeps the index
 * on pass.token usable.
 */
const normalizeToken = (t: string): string => (t || '').replace(/\s+/g, '').toLowerCase();

export async function getPass(db: Database, tokenRaw: string): Promise<PassView | null> {
  const token = normalizeToken(tokenRaw);
  if (!token) return null;
  const r = (await db.query<any>(
    `SELECT pa.token, pa.claim_id, pa.fan_id, c.status, c.event_id, e.name event_title, e.starts_at, e.host_kind, e.host_id,
            e.access_mode, e.location, e.location_kind, e.timezone,
            ef.kind fmt_kind, ef.label fmt_label, ef.channel_url,
            EXISTS (SELECT 1 FROM presence pr WHERE pr.claim_id=c.id) verified
     FROM pass pa JOIN claim c ON c.id=pa.claim_id JOIN event e ON e.id=c.event_id
     LEFT JOIN event_format ef ON ef.id=c.format_id WHERE pa.token=$1`, [token])).rows[0];
  if (!r) return null;
  return { token: r.token, claimId: r.claim_id, fanId: r.fan_id, status: r.status, eventId: r.event_id, eventTitle: r.event_title, startsAt: r.starts_at ?? null, hostKind: r.host_kind, hostId: r.host_id, verified: !!r.verified, formatKind: r.fmt_kind ?? null, formatLabel: r.fmt_label ?? null, channelUrl: r.channel_url ?? null, accessMode: r.access_mode ?? 'ticket', location: r.location ?? null, locationKind: r.location_kind ?? 'in_person', timezone: r.timezone ?? null };
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

/**
 * Who actually came through the door — the organiser's answer to "you say 14
 * checked in, WHICH 14?". Newest first, because at a live door the useful view
 * is the last person scanned, not the first.
 *
 * The time is rendered in the VENUE's zone (same rule as every other timestamp
 * in this app): an organiser reading a Berlin door log must not see UTC.
 * Profile resolution mirrors formatAttendees — a fan who also owns an athlete
 * or club page links to it, so the organiser recognises a face, not a string.
 */
export interface CheckedIn {
  fanId: string; name: string; handle: string | null; partySize: number;
  fidelity: string; at: string; profile: { kind: string; id: string } | null;
}
export async function checkedInList(db: Database, eventId: string): Promise<CheckedIn[]> {
  const rows = (await db.query<any>(
    `SELECT f.id fan_id, f.display_name name, f.handle, pr.fidelity,
            COALESCE(c.party_size, 1) party_size,
            to_char(pr.verified_at AT TIME ZONE COALESCE(e.timezone,'UTC'), 'DD Mon · HH24:MI') at,
            o.owner_kind ekind, o.owner_id eid
     FROM presence pr
     JOIN fan f ON f.id = pr.fan_id
     JOIN event e ON e.id = pr.event_id
     LEFT JOIN claim c ON c.id = pr.claim_id
     LEFT JOIN LATERAL (
       SELECT owner_kind, owner_id FROM ownership ow
       WHERE f.account_id IS NOT NULL AND ow.account_id = f.account_id
       ORDER BY CASE owner_kind WHEN 'athlete' THEN 0 WHEN 'club' THEN 1 WHEN 'team' THEN 2 WHEN 'association' THEN 3 ELSE 4 END
       LIMIT 1
     ) o ON true
     WHERE pr.event_id = $1
     ORDER BY pr.verified_at DESC`, [eventId])).rows;
  return rows.map(r => ({
    fanId: r.fan_id, name: r.name, handle: r.handle ?? null, partySize: r.party_size ?? 1,
    fidelity: r.fidelity, at: r.at ?? '', profile: r.eid ? { kind: r.ekind, id: r.eid } : null,
  }));
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
    `SELECT e.id, e.name title, to_char(e.starts_at AT TIME ZONE COALESCE(e.timezone,'UTC'),'Dy DD Mon · HH24:MI') date, e.host_kind, e.host_id, e.capacity, e.tier,
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

/**
 * Events this fan HAS A SPOT AT — the "you're going to these" list.
 *
 * Distinct from feedDoors (events they COULD claim) and from the pages they run
 * (events they're RESPONSIBLE for). Those three were previously blurred into one
 * "Your doors" feed, which is how an organiser ends up scanning past the event
 * they're supposed to be running.
 *
 * Carries the pass token so the row's action is "View pass" and not another trip
 * through the event page to find it.
 */
export interface AttendingRow {
  eventId: string; title: string; date: string | null; startsAt: string | null;
  hostKind: string | null; hostId: string | null; hostName: string;
  status: string; passToken: string | null; partySize: number; formatLabel: string | null;
}
export async function attendingEvents(db: Database, fanId: string, limit = 20): Promise<AttendingRow[]> {
  const rows = (await db.query<any>(
    `SELECT e.id, e.name title, to_char(e.starts_at AT TIME ZONE COALESCE(e.timezone,'UTC'),'Dy DD Mon · HH24:MI') date,
            e.starts_at, e.host_kind, e.host_id, c.status, c.party_size, pa.token, ef.label fmt_label
     FROM claim c
     JOIN event e ON e.id = c.event_id
     LEFT JOIN pass pa ON pa.claim_id = c.id
     LEFT JOIN event_format ef ON ef.id = c.format_id
     WHERE c.fan_id = $1
       AND c.voided_at IS NULL
       AND c.status IN ('claimed','approved','verified','waitlisted')
       AND e.starts_at > now() - interval '3 hours'
     ORDER BY e.starts_at ASC LIMIT $2`, [fanId, limit])).rows;
  return rows.map(r => ({
    eventId: r.id, title: r.title, date: r.date ?? null, startsAt: r.starts_at ?? null,
    hostKind: r.host_kind, hostId: r.host_id, hostName: '',
    status: r.status, passToken: r.token ?? null, partySize: r.party_size ?? 1,
    formatLabel: r.fmt_label ?? null,
  }));
}

/**
 * Which of these events does this fan already hold a spot at?
 *
 * One query for a whole list — the entity pages render 5–50 events, and asking
 * per row would be a page-load's worth of round-trips for a tick mark.
 */
export async function myClaimedIn(db: Database, fanId: string | null, eventIds: string[]): Promise<Set<string>> {
  if (!fanId || !eventIds.length) return new Set();
  const rows = (await db.query<{ event_id: string }>(
    `SELECT event_id FROM claim
     WHERE fan_id=$1 AND event_id = ANY($2) AND voided_at IS NULL
       AND status IN ('claimed','approved','verified','waitlisted')`, [fanId, eventIds])).rows;
  return new Set(rows.map(r => r.event_id));
}

export async function consentedReach(db: Database, ownerKind: string, ownerId: string): Promise<number> {
  return (await db.query<{ n: number }>(
    `SELECT count(DISTINCT fan_id)::int n FROM consent WHERE owner_kind=$1 AND owner_id=$2 AND class='marketing' AND granted_at IS NOT NULL AND revoked_at IS NULL`,
    [ownerKind, ownerId])).rows[0].n;
}
