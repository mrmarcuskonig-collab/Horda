// event_format_repo.ts — the multi-format attendance layer. One event can be
// attended several ways: in person (tickets sold on Horda) and/or via one or
// more streams (TikTok Live, a sport-specific media provider). Every format's
// attendance is confirmed on Horda, so the organizer sees a clean per-format
// breakdown — exactly what to expect, and what to optimise for.
import type { Database } from './index.ts';

export interface EventFormat {
  id: string; eventId: string; kind: 'in_person' | 'stream' | string; label: string;
  channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; capacity: number | null; sort: number;
  /** How many spots ONE person may take in this way-in. 1 = just themselves.
   *  Per format on purpose: 4 tickets at the door is normal, 4 stream seats is
   *  meaningless. */
  maxPerPerson: number;
}
export interface FormatCount extends EventFormat { going: number; revenueCents: number; waiting: number }

function map(r: any): EventFormat {
  return {
    id: r.id, eventId: r.event_id, kind: r.kind, label: r.label,
    channelUrl: r.channel_url ?? null, requiresTicket: !!r.requires_ticket,
    priceCents: r.price_cents ?? null, capacity: r.capacity ?? null, sort: r.sort ?? 0,
    maxPerPerson: r.max_per_person ?? 1,
  };
}

export async function listFormats(db: Database, eventId: string): Promise<EventFormat[]> {
  return (await db.query<any>(`SELECT * FROM event_format WHERE event_id=$1 ORDER BY sort, created_at`, [eventId])).rows.map(map);
}

export async function addFormat(db: Database, o: {
  eventId: string; kind: string; label: string; channelUrl?: string | null;
  requiresTicket?: boolean; priceCents?: number | null; capacity?: number | null; sort?: number;
  maxPerPerson?: number;
}): Promise<string> {
  const kind = o.kind === 'stream' ? 'stream' : 'in_person';
  // Clamp to >=1: a 0 would make the format silently unclaimable and the
  // organiser would never work out why nobody came.
  const maxPP = Math.max(1, Math.min(50, o.maxPerPerson ?? 1));
  const r = await db.query<{ id: string }>(
    `INSERT INTO event_format (event_id, kind, label, channel_url, requires_ticket, price_cents, capacity, sort, max_per_person)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [o.eventId, kind, o.label.slice(0, 80), o.channelUrl || null, !!o.requiresTicket,
     o.priceCents ?? null, o.capacity ?? null, o.sort ?? 0, maxPP]);
  return r.rows[0].id;
}

export async function getFormat(db: Database, formatId: string): Promise<EventFormat | null> {
  const r = (await db.query<any>(`SELECT * FROM event_format WHERE id=$1`, [formatId])).rows[0];
  return r ? map(r) : null;
}

// The people attending, grouped by the format they chose — so the organiser can
// expand a way-in and see exactly who's coming. Each attendee links to their public
// profile ONLY when one exists: a fan who also owns an athlete/club/association page.
// A plain fan (claimed a spot with just a name) has no public page, so it's name-only.
export interface FormatAttendee { fanId: string; name: string; handle: string | null; partySize: number; profile: { kind: string; id: string } | null }
export async function formatAttendees(db: Database, eventId: string): Promise<Record<string, FormatAttendee[]>> {
  const rows = (await db.query<any>(
    `SELECT c.format_id, c.party_size, f.id fan_id, f.display_name name, f.handle,
            o.owner_kind ekind, o.owner_id eid
     FROM claim c JOIN fan f ON f.id = c.fan_id
     LEFT JOIN LATERAL (
       SELECT owner_kind, owner_id FROM ownership ow
       WHERE f.account_id IS NOT NULL AND ow.account_id = f.account_id
       ORDER BY CASE owner_kind WHEN 'athlete' THEN 0 WHEN 'club' THEN 1 WHEN 'team' THEN 2 WHEN 'association' THEN 3 ELSE 4 END
       LIMIT 1
     ) o ON true
     WHERE c.event_id = $1 AND c.status IN ('claimed','approved','verified') AND c.voided_at IS NULL
     ORDER BY f.display_name`, [eventId])).rows;
  const out: Record<string, FormatAttendee[]> = {};
  for (const r of rows) {
    const key = r.format_id ?? '__unassigned';
    (out[key] ??= []).push({ fanId: r.fan_id, name: r.name, handle: r.handle ?? null, partySize: r.party_size ?? 1, profile: r.eid ? { kind: r.ekind, id: r.eid } : null });
  }
  return out;
}

// bind a claim to the format the fan chose (single choice; switching allowed).
export async function setClaimFormat(db: Database, claimId: string, formatId: string | null): Promise<void> {
  await db.query(`UPDATE claim SET format_id=$2 WHERE id=$1`, [claimId, formatId]);
}

// The organizer breakdown: committed attendance + revenue per format. Clean
// single-count-per-fan, so seats vs streams never overlap.
export async function formatCounts(db: Database, eventId: string): Promise<FormatCount[]> {
  const formats = await listFormats(db, eventId);
  // going counts PEOPLE, not claims: one fan bringing three mates is four
  // attendees and four tickets' worth of money. Counting claims would under-report
  // both the room and the revenue.
  //
  // And "going" must EXCLUDE the waitlist. A waitlisted person is not coming —
  // they're hoping. This number is what an organiser orders catering and books
  // stewards against; inflating it with the waitlist is worse than useless.
  // Waiting is reported separately, because it's real demand and worth seeing.
  const rows = (await db.query<any>(
    `SELECT format_id,
            COALESCE(SUM(party_size) FILTER (WHERE status IN ('claimed','approved','verified')),0)::int going,
            COALESCE(SUM(party_size) FILTER (WHERE status='waitlisted'),0)::int waiting,
            COALESCE(SUM(COALESCE(price_cents,0) * party_size) FILTER (WHERE status IN ('claimed','approved','verified')),0)::int revenue
     FROM claim WHERE event_id=$1 AND status NOT IN ('refunded','no_show') GROUP BY format_id`, [eventId])).rows;
  const by: Record<string, { going: number; revenue: number; waiting: number }> = {};
  let unassigned = { going: 0, revenue: 0, waiting: 0 };
  for (const r of rows) {
    const v = { going: r.going, revenue: r.revenue, waiting: r.waiting };
    if (r.format_id) by[r.format_id] = v; else unassigned = v;
  }
  const out: FormatCount[] = formats.map(f => ({
    ...f,
    going: by[f.id]?.going ?? 0,
    revenueCents: by[f.id]?.revenue ?? 0,
    waiting: by[f.id]?.waiting ?? 0,
  }));
  // fold legacy/format-less claims into the first in-person format if any
  if ((unassigned.going || unassigned.waiting) && out.length) {
    out[0].going += unassigned.going; out[0].revenueCents += unassigned.revenue; out[0].waiting += unassigned.waiting;
  }
  return out;
}
