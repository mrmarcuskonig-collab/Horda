// events_repo.ts — Luma-style scheduled events hosted by athlete/club/team/
// association, and fan RSVPs (going / not_going / stream / interested).
import type { Database } from './index.ts';

export type RsvpResponse = 'going' | 'not_going' | 'stream' | 'interested';
export type Admission = 'open' | 'register' | 'apply' | 'paid';
export interface Streams { youtube?: string; twitch?: string; discord?: string }

export interface EventDetail {
  id: string; title: string; description: string | null; coverUrl: string | null;
  date?: string; time?: string; startsAt: string | null; location: string | null;
  admission: Admission; priceCents: number | null; currency: string; streams: Streams; ticketUrl: string | null;
  hostKind: string | null; hostId: string | null; hostName: string; capacity: number | null;
  locationKind: string; recurrence: string; accessMode: string;
  counts: Record<RsvpResponse, number> & { pending: number };
}
export const priceLabel = (d: { priceCents: number | null; currency: string }) =>
  d.priceCents ? `${d.currency === 'EUR' ? '€' : d.currency + ' '}${(d.priceCents / 100).toFixed(2).replace(/\.00$/, '')}` : 'Free';

export async function hostName(db: Database, kind: string, id: string): Promise<string> {
  const tbl = kind === 'athlete' ? 'athlete' : kind === 'association' ? 'association' : kind === 'team' ? 'team' : 'club';
  const col = kind === 'athlete' ? 'display_name' : 'name';
  return (await db.query<any>(`SELECT ${col} n FROM ${tbl} WHERE id=$1`, [id])).rows[0]?.n ?? 'Host';
}

export async function createScheduledEvent(db: Database, o: {
  hostKind: 'athlete' | 'club' | 'team' | 'association'; hostId: string;
  title: string; startsAt: string; location?: string; description?: string; coverUrl?: string;
  admission?: Admission; priceCents?: number; currency?: string; streams?: Streams;
  ticketUrl?: string; capacity?: number; sportId?: string;
  locationKind?: string; recurrence?: string; recurrenceUntil?: string; accessMode?: string;
}): Promise<string> {
  const admission: Admission = o.admission ?? (o.priceCents ? 'paid' : 'open');
  const locKind = ['in_person', 'online', 'hybrid'].includes(o.locationKind ?? '') ? o.locationKind! : 'in_person';
  const recur = ['none', 'weekly', 'monthly'].includes(o.recurrence ?? '') ? o.recurrence! : 'none';
  // 'ticket' = register → QR → scan at door; 'link' = just receive the details.
  // Default: online events send a link, in-person events issue a scannable ticket.
  const access = o.accessMode === 'link' || o.accessMode === 'ticket' ? o.accessMode : (locKind === 'online' ? 'link' : 'ticket');
  const r = await db.query<{ id: string }>(
    `INSERT INTO event (name, sport_id, starts_at, location, description, cover_url, host_kind, host_id, capacity,
       admission, price_cents, currency, streams, spectator_access, ticket_url, location_kind, recurrence, recurrence_until, access_mode, source)
     VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18::timestamptz,$19,'native') RETURNING id`,
    [o.title, o.sportId ?? null, o.startsAt, o.location ?? null, o.description ?? null, o.coverUrl ?? null,
     o.hostKind, o.hostId, o.capacity ?? null, admission, o.priceCents ?? null, o.currency ?? 'EUR',
     JSON.stringify(o.streams ?? {}), admission === 'paid' ? 'paid_ticket' : 'free', o.ticketUrl ?? null,
     locKind, recur, o.recurrenceUntil ?? null, access]);
  return r.rows[0].id;
}

// Parse a pasted season schedule into fixtures. One event per non-empty line:
//   "Title | 2026-08-01 19:00 | Venue"   (venue optional; date reasonably lenient)
// Invalid lines are skipped rather than failing the whole import.
export function parseSeasonLines(text: string, fallbackTitle = 'Event'): { title: string; startsAt: string; location?: string }[] {
  const out: { title: string; startsAt: string; location?: string }[] = [];
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|').map(p => p.trim());
    const title = parts[0] || fallbackTitle;
    const whenStr = (parts[1] || '').replace(/\s+/, 'T');   // "2026-08-01 19:00" -> "2026-08-01T19:00"
    const when = whenStr ? new Date(whenStr) : null;
    if (!when || isNaN(when.getTime())) continue;           // no valid date → skip
    out.push({ title: title.slice(0, 120), startsAt: when.toISOString(), location: parts[2] || undefined });
  }
  return out;
}

// Shift an ISO datetime by n weeks or months (for simple recurrence generation).
export function shiftDate(iso: string, unit: 'weekly' | 'monthly', n: number): string {
  const d = new Date(iso);
  if (unit === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString();
}

// RSVP, admission-aware: apply -> pending (await approval); paid+going -> pending (await payment).
export async function rsvp(db: Database, fanId: string, eventId: string, response: RsvpResponse): Promise<void> {
  const adm = (await db.query<any>(`SELECT admission FROM event WHERE id=$1`, [eventId])).rows[0]?.admission ?? 'open';
  let status = 'confirmed';
  if (response === 'going' && adm === 'apply') status = 'pending';
  if (response === 'going' && adm === 'paid') status = 'pending';
  await db.query(
    `INSERT INTO attendance (fan_id,event_id,mode,status) VALUES ($1,$2,$3::attend_mode,$4::reg_status)
     ON CONFLICT (fan_id,event_id) DO UPDATE SET mode=$3::attend_mode, status=$4::reg_status`, [fanId, eventId, response, status]);
}
export async function getRsvp(db: Database, fanId: string, eventId: string): Promise<{ response: RsvpResponse; status: string } | null> {
  const r = await db.query<any>(`SELECT mode, status FROM attendance WHERE fan_id=$1 AND event_id=$2`, [fanId, eventId]);
  return r.rows[0] ? { response: r.rows[0].mode, status: r.rows[0].status } : null;
}
export async function approveRegistration(db: Database, eventId: string, fanId: string): Promise<void> {
  await db.query(`UPDATE attendance SET status='confirmed' WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId]);
}
// payment step (Stripe is the production swap; here we record the paid state)
export async function markPaid(db: Database, eventId: string, fanId: string): Promise<void> {
  await db.query(`INSERT INTO attendance (fan_id,event_id,mode,status) VALUES ($2,$1,'going','paid')
     ON CONFLICT (fan_id,event_id) DO UPDATE SET mode='going', status='paid'`, [eventId, fanId]);
  await issueTicket(db, eventId, fanId);
}

// --- transferable tickets: issue / gift / resell -------------------------
export async function issueTicket(db: Database, eventId: string, fanId: string): Promise<void> {
  const has = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM ticket WHERE event_id=$1 AND holder_fan_id=$2`, [eventId, fanId])).rows[0].n;
  if (!has) await db.query(`INSERT INTO ticket (event_id,holder_fan_id,issued_to_fan_id) VALUES ($1,$2,$2)`, [eventId, fanId]);
}
export async function getTicketFor(db: Database, eventId: string, fanId: string): Promise<{ id: string; status: string; listPriceCents: number | null } | null> {
  const r = (await db.query<any>(`SELECT id, status, list_price_cents FROM ticket WHERE event_id=$1 AND holder_fan_id=$2 LIMIT 1`, [eventId, fanId])).rows[0];
  return r ? { id: r.id, status: r.status, listPriceCents: r.list_price_cents ?? null } : null;
}
export async function giftTicket(db: Database, ticketId: string, toHandle: string): Promise<boolean> {
  const to = (await db.query<{ id: string }>(`SELECT id FROM fan WHERE handle=$1`, [toHandle.replace(/^@/, '')])).rows[0];
  if (!to) return false;
  await db.query(`UPDATE ticket SET holder_fan_id=$2, status='transferred', list_price_cents=NULL WHERE id=$1`, [ticketId, to.id]);
  return true;
}
export async function listTicket(db: Database, ticketId: string, priceCents: number): Promise<void> {
  await db.query(`UPDATE ticket SET status='listed', list_price_cents=$2 WHERE id=$1`, [ticketId, priceCents]);
}
export async function getListings(db: Database, eventId: string): Promise<{ id: string; priceCents: number; seller: string }[]> {
  return (await db.query<any>(
    `SELECT t.id, t.list_price_cents priceCents, f.display_name seller FROM ticket t JOIN fan f ON f.id=t.holder_fan_id
     WHERE t.event_id=$1 AND t.status='listed' ORDER BY t.list_price_cents`, [eventId])).rows
    .map(r => ({ id: r.id, priceCents: r.pricecents ?? r.priceCents, seller: r.seller }));
}
export async function buyListing(db: Database, ticketId: string, fanId: string): Promise<void> {
  await db.query(`UPDATE ticket SET holder_fan_id=$2, status='transferred', list_price_cents=NULL WHERE id=$1 AND status='listed'`, [ticketId, fanId]);
}
export async function featureEvent(db: Database, kind: string, id: string, eventId: string): Promise<void> {
  await db.query(`INSERT INTO event_feature (feat_kind,feat_id,event_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [kind, id, eventId]);
}

export async function getEventDetail(db: Database, eventId: string): Promise<EventDetail | null> {
  const e = (await db.query<any>(
    `SELECT id, name title, description, cover_url, starts_at,
            to_char(starts_at,'Dy DD Mon YYYY') date, to_char(starts_at,'HH24:MI') time,
            location, admission, price_cents, currency, streams, ticket_url, host_kind, host_id, capacity,
            location_kind, recurrence, access_mode
     FROM event WHERE id=$1`, [eventId])).rows[0];
  if (!e) return null;
  const counts: any = { going: 0, not_going: 0, stream: 0, interested: 0, pending: 0 };
  for (const r of (await db.query<any>(
    `SELECT mode, status, count(*)::int n FROM attendance WHERE event_id=$1 GROUP BY mode, status`, [eventId])).rows) {
    if (r.mode === 'going' && r.status === 'pending') counts.pending += r.n;
    else if (r.mode === 'going') counts.going += r.n;       // confirmed or paid
    else counts[r.mode] += r.n;
  }
  const host = e.host_kind ? await hostName(db, e.host_kind, e.host_id) : 'Host';
  return {
    id: e.id, title: e.title, description: e.description, coverUrl: e.cover_url,
    date: e.date ?? undefined, time: e.time ?? undefined, startsAt: e.starts_at ?? null, location: e.location,
    admission: e.admission, priceCents: e.price_cents ?? null, currency: e.currency ?? 'EUR',
    streams: e.streams ?? {}, ticketUrl: e.ticket_url,
    hostKind: e.host_kind, hostId: e.host_id, hostName: host, capacity: e.capacity,
    locationKind: e.location_kind ?? 'in_person', recurrence: e.recurrence ?? 'none', accessMode: e.access_mode ?? 'ticket', counts,
  };
}

// events shown on a profile = the ones it hosts + the ones it has featured (cross-posted).
// Each carries live/past flags + a real timestamp so the page can split them into
// Live / Upcoming / Past. `associated` marks a featured (participated-in) event.
export interface ProfileEvent { id: string; title: string; date?: string; startsAt: string | null; live: boolean; past: boolean; featured?: boolean; hostName?: string }
export async function listProfileEvents(db: Database, kind: string, id: string): Promise<ProfileEvent[]> {
  const liveExpr = `(starts_at IS NOT NULL AND starts_at <= now() AND now() < COALESCE(ends_at, starts_at + interval '3 hours'))`;
  const pastExpr = `(starts_at IS NOT NULL AND now() >= COALESCE(ends_at, starts_at + interval '3 hours'))`;
  const hosted = (await db.query<any>(
    `SELECT id, name title, to_char(starts_at,'DD Mon') date, starts_at, ${liveExpr} live, ${pastExpr} past FROM event WHERE host_kind=$1 AND host_id=$2`, [kind, id])).rows
    .map(r => ({ id: r.id, title: r.title, date: r.date ?? undefined, startsAt: r.starts_at ?? null, live: !!r.live, past: !!r.past }));
  const featured = (await db.query<any>(
    `SELECT e.id, e.name title, to_char(e.starts_at,'DD Mon') date, e.starts_at, e.host_kind, e.host_id, ${liveExpr} live, ${pastExpr} past
     FROM event_feature f JOIN event e ON e.id=f.event_id WHERE f.feat_kind=$1 AND f.feat_id=$2`, [kind, id])).rows;
  const feat: ProfileEvent[] = [];
  for (const r of featured) feat.push({ id: r.id, title: r.title, date: r.date ?? undefined, startsAt: r.starts_at ?? null, live: !!r.live, past: !!r.past, featured: true, hostName: r.host_kind ? await hostName(db, r.host_kind, r.host_id) : undefined });
  const ms = (v: string | null) => v ? new Date(v).getTime() : 0;
  return [...hosted, ...feat].sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
}

export async function getGuestList(db: Database, eventId: string): Promise<{ response: string; status: string; fanId: string; name: string; handle: string | null }[]> {
  return (await db.query<any>(
    `SELECT a.mode response, a.status, a.fan_id "fanId", f.display_name name, f.handle FROM attendance a JOIN fan f ON f.id=a.fan_id
     WHERE a.event_id=$1 ORDER BY a.mode, f.display_name`, [eventId])).rows;
}

export async function listUpcomingByHost(db: Database, hostKind: string, hostId: string): Promise<{ id: string; title: string; date?: string }[]> {
  return (await db.query<any>(
    `SELECT id, name title, to_char(starts_at,'DD Mon') date FROM event
     WHERE host_kind=$1 AND host_id=$2 ORDER BY starts_at`, [hostKind, hostId])).rows
    .map(r => ({ id: r.id, title: r.title, date: r.date ?? undefined }));
}

// RFC-5545 calendar export (Luma's signature "add to calendar")
export function icsFor(d: EventDetail, origin = 'https://joinhorda.com'): string {
  const dt = d.startsAt ? new Date(d.startsAt) : new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  const stamp = (x: Date) => `${x.getUTCFullYear()}${z(x.getUTCMonth() + 1)}${z(x.getUTCDate())}T${z(x.getUTCHours())}${z(x.getUTCMinutes())}00Z`;
  const end = new Date(dt.getTime() + 2 * 3600 * 1000);
  const esc = (s: string) => String(s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Horda//EN', 'BEGIN:VEVENT',
    `UID:${d.id}@joinhorda.com`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(dt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(d.title)}`, `DESCRIPTION:${esc((d.description ?? '') + `\nHosted by ${d.hostName} on Horda`)}`,
    d.location ? `LOCATION:${esc(d.location)}` : '', `URL:${origin}/e/${d.id}`, 'END:VEVENT', 'END:VCALENDAR']
    .filter(Boolean).join('\r\n');
}
