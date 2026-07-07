// event_format_repo.ts — the multi-format attendance layer. One event can be
// attended several ways: in person (tickets sold on Horda) and/or via one or
// more streams (TikTok Live, a sport-specific media provider). Every format's
// attendance is confirmed on Horda, so the organizer sees a clean per-format
// breakdown — exactly what to expect, and what to optimise for.
import type { Database } from './index.ts';

export interface EventFormat {
  id: string; eventId: string; kind: 'in_person' | 'stream' | string; label: string;
  channelUrl: string | null; requiresTicket: boolean; priceCents: number | null; capacity: number | null; sort: number;
}
export interface FormatCount extends EventFormat { going: number; revenueCents: number }

function map(r: any): EventFormat {
  return {
    id: r.id, eventId: r.event_id, kind: r.kind, label: r.label,
    channelUrl: r.channel_url ?? null, requiresTicket: !!r.requires_ticket,
    priceCents: r.price_cents ?? null, capacity: r.capacity ?? null, sort: r.sort ?? 0,
  };
}

export async function listFormats(db: Database, eventId: string): Promise<EventFormat[]> {
  return (await db.query<any>(`SELECT * FROM event_format WHERE event_id=$1 ORDER BY sort, created_at`, [eventId])).rows.map(map);
}

export async function addFormat(db: Database, o: {
  eventId: string; kind: string; label: string; channelUrl?: string | null;
  requiresTicket?: boolean; priceCents?: number | null; capacity?: number | null; sort?: number;
}): Promise<string> {
  const kind = o.kind === 'stream' ? 'stream' : 'in_person';
  const r = await db.query<{ id: string }>(
    `INSERT INTO event_format (event_id, kind, label, channel_url, requires_ticket, price_cents, capacity, sort)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [o.eventId, kind, o.label.slice(0, 80), o.channelUrl || null, !!o.requiresTicket,
     o.priceCents ?? null, o.capacity ?? null, o.sort ?? 0]);
  return r.rows[0].id;
}

export async function getFormat(db: Database, formatId: string): Promise<EventFormat | null> {
  const r = (await db.query<any>(`SELECT * FROM event_format WHERE id=$1`, [formatId])).rows[0];
  return r ? map(r) : null;
}

// bind a claim to the format the fan chose (single choice; switching allowed).
export async function setClaimFormat(db: Database, claimId: string, formatId: string | null): Promise<void> {
  await db.query(`UPDATE claim SET format_id=$2 WHERE id=$1`, [claimId, formatId]);
}

// The organizer breakdown: committed attendance + revenue per format. Clean
// single-count-per-fan, so seats vs streams never overlap.
export async function formatCounts(db: Database, eventId: string): Promise<FormatCount[]> {
  const formats = await listFormats(db, eventId);
  const rows = (await db.query<any>(
    `SELECT format_id, count(*)::int going, COALESCE(SUM(COALESCE(price_cents,0)),0)::int revenue
     FROM claim WHERE event_id=$1 AND status NOT IN ('refunded','no_show') GROUP BY format_id`, [eventId])).rows;
  const by: Record<string, { going: number; revenue: number }> = {};
  let unassigned = { going: 0, revenue: 0 };
  for (const r of rows) {
    if (r.format_id) by[r.format_id] = { going: r.going, revenue: r.revenue };
    else unassigned = { going: r.going, revenue: r.revenue };
  }
  const out: FormatCount[] = formats.map(f => ({ ...f, going: by[f.id]?.going ?? 0, revenueCents: by[f.id]?.revenue ?? 0 }));
  // fold legacy/format-less claims into the first in-person format if any
  if (unassigned.going && out.length) { out[0].going += unassigned.going; out[0].revenueCents += unassigned.revenue; }
  return out;
}
