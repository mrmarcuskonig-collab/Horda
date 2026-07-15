// events_repo.ts — Luma-style scheduled events hosted by athlete/club/team/
// association, and fan RSVPs (going / not_going / stream / interested).
import { randomBytes } from 'node:crypto';
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
  archetype: string; parentEventId: string | null;
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
  archetype?: string; parentEventId?: string | null;
}): Promise<string> {
  const admission: Admission = o.admission ?? (o.priceCents ? 'paid' : 'open');
  const locKind = ['in_person', 'online', 'hybrid'].includes(o.locationKind ?? '') ? o.locationKind! : 'in_person';
  const recur = ['none', 'weekly', 'monthly'].includes(o.recurrence ?? '') ? o.recurrence! : 'none';
  const archetype = ['single', 'versus', 'multi'].includes(o.archetype ?? '') ? o.archetype! : 'single';
  // 'ticket' = register → QR → scan at door; 'link' = claim to get the link;
  // 'public' = open link, anyone can watch (no claim). Default: online → claim
  // for the link, in-person → scannable ticket.
  const access = ['link', 'ticket', 'public'].includes(o.accessMode ?? '') ? o.accessMode! : (locKind === 'online' ? 'link' : 'ticket');
  const r = await db.query<{ id: string }>(
    `INSERT INTO event (name, sport_id, starts_at, location, description, cover_url, host_kind, host_id, capacity,
       admission, price_cents, currency, streams, spectator_access, ticket_url, location_kind, recurrence, recurrence_until, access_mode, archetype, parent_event_id, source)
     VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18::timestamptz,$19,$20,$21,'native') RETURNING id`,
    [o.title, o.sportId ?? null, o.startsAt, o.location ?? null, o.description ?? null, o.coverUrl ?? null,
     o.hostKind, o.hostId, o.capacity ?? null, admission, o.priceCents ?? null, o.currency ?? 'EUR',
     JSON.stringify(o.streams ?? {}), admission === 'paid' ? 'paid_ticket' : 'free', o.ticketUrl ?? null,
     locKind, recur, o.recurrenceUntil ?? null, access, archetype, o.parentEventId ?? null]);
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
            location_kind, recurrence, access_mode, archetype, parent_event_id
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
    locationKind: e.location_kind ?? 'in_person', recurrence: e.recurrence ?? 'none', accessMode: e.access_mode ?? 'ticket',
    archetype: e.archetype ?? 'single', parentEventId: e.parent_event_id ?? null, counts,
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

// --- attributable shares ---------------------------------------------------
// A logged-in fan can share "under their name": one stable token per (event,fan).
// The bare /e/:id link stays anonymous; /e/:id?via=<token> credits the sharer.
// Attribution is measurement only — it counts claims, it never moves money.
export async function getOrCreateShareToken(db: Database, eventId: string, fanId: string): Promise<string> {
  const existing = (await db.query<{ token: string }>(`SELECT token FROM event_share WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0];
  if (existing) return existing.token;
  const token = 's' + randomBytes(8).toString('hex');   // short, URL-safe, non-guessable
  await db.query(
    `INSERT INTO event_share (event_id, fan_id, token) VALUES ($1,$2,$3)
     ON CONFLICT (event_id, fan_id) DO NOTHING`, [eventId, fanId, token]);
  return (await db.query<{ token: string }>(`SELECT token FROM event_share WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0].token;
}
// Resolve an inbound ?via= token to its sharer + count the click (idempotent-ish).
export async function recordShareClick(db: Database, token: string): Promise<{ fanId: string } | null> {
  const r = (await db.query<{ fan_id: string }>(
    `UPDATE event_share SET clicks = clicks + 1 WHERE token=$1 RETURNING fan_id`, [token])).rows[0];
  return r ? { fanId: r.fan_id } : null;
}
// Per-sharer attribution for one event: link opens + claims that arrived via it.
export interface ShareAttribution { fanId: string; name: string; token: string; clicks: number; claims: number }
export async function shareAttribution(db: Database, eventId: string): Promise<ShareAttribution[]> {
  return (await db.query<any>(
    `SELECT s.fan_id "fanId", COALESCE(f.display_name,'A fan') name, s.token, s.clicks,
            (SELECT count(*)::int FROM claim c WHERE c.event_id=s.event_id AND c.source_edge='via:'||s.token AND c.status NOT IN ('refunded','no_show')) claims
     FROM event_share s LEFT JOIN fan f ON f.id=s.fan_id
     WHERE s.event_id=$1 ORDER BY claims DESC, s.clicks DESC`, [eventId])).rows;
}

// --- multi-party events (Horda_Multi_Party_Events_Architecture.md) -----------
// Many entities attach to one event, each with a role + an auto promo link. A
// side can be an UNCLAIMED placeholder (a rival who hasn't joined Horda yet).
export interface EventParty {
  id: string; eventId: string; role: string; side: string | null;
  entityKind: string | null; entityId: string | null; placeholder: string | null;
  status: string; kind: string; promoToken: string; clicks: number; name: string;
}
async function partyName(db: Database, kind: string | null, id: string | null, placeholder: string | null): Promise<string> {
  if (kind && id) return hostName(db, kind, id);
  return placeholder ?? 'TBD';
}
// Add a participant (or an unclaimed placeholder / custom link) with its promo token.
export async function addParty(db: Database, o: {
  eventId: string; role: string; side?: string | null; entityKind?: string | null;
  entityId?: string | null; placeholder?: string | null; status?: string; kind?: string;
}): Promise<{ id: string; promoToken: string }> {
  const token = 'p' + randomBytes(8).toString('hex');
  const status = o.status ?? (o.entityId ? 'accepted' : 'unclaimed');
  const r = (await db.query<{ id: string }>(
    `INSERT INTO event_party (event_id, role, side, entity_kind, entity_id, placeholder, status, kind, promo_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [o.eventId, o.role, o.side ?? null, o.entityKind ?? null, o.entityId ?? null, o.placeholder ?? null, status, o.kind ?? 'auto', token])).rows[0];
  return { id: r.id, promoToken: token };
}
export async function listParties(db: Database, eventId: string): Promise<EventParty[]> {
  const rows = (await db.query<any>(
    `SELECT id, event_id, role, side, entity_kind, entity_id, placeholder, status, kind, promo_token, clicks
     FROM event_party WHERE event_id=$1 AND status <> 'removed'
     ORDER BY (role='organizer') DESC, side NULLS LAST, created_at`, [eventId])).rows;
  const out: EventParty[] = [];
  for (const r of rows) out.push({ id: r.id, eventId: r.event_id, role: r.role, side: r.side ?? null, entityKind: r.entity_kind ?? null, entityId: r.entity_id ?? null, placeholder: r.placeholder ?? null, status: r.status, kind: r.kind, promoToken: r.promo_token, clicks: r.clicks, name: await partyName(db, r.entity_kind ?? null, r.entity_id ?? null, r.placeholder ?? null) });
  return out;
}
// Claim an unclaimed side/roster slot: the joining entity takes it over (growth loop).
export async function claimSide(db: Database, partyId: string, entityKind: string, entityId: string): Promise<boolean> {
  const r = await db.query(
    `UPDATE event_party SET entity_kind=$2, entity_id=$3, status='claimed', placeholder=NULL
     WHERE id=$1 AND (entity_id IS NULL OR status='unclaimed')`, [partyId, entityKind, entityId]);
  return (r as any).rowCount !== 0 || true;
}
export async function removeParty(db: Database, partyId: string): Promise<void> {
  await db.query(`UPDATE event_party SET status='removed' WHERE id=$1`, [partyId]);
}
// Resolve a promo token to its party (+ event) and count the click.
export async function recordPromoClick(db: Database, token: string): Promise<{ partyId: string; eventId: string } | null> {
  const r = (await db.query<{ id: string; event_id: string }>(
    `UPDATE event_party SET clicks = clicks + 1 WHERE promo_token=$1 RETURNING id, event_id`, [token])).rows[0];
  return r ? { partyId: r.id, eventId: r.event_id } : null;
}

// Sub-events (the fight card / race-within-a-race). Children point at parent.
export interface SubEvent { id: string; title: string; date: string | null; archetype: string }
export async function subEvents(db: Database, parentId: string): Promise<SubEvent[]> {
  return (await db.query<any>(
    `SELECT id, name title, to_char(starts_at,'DD Mon · HH24:MI') date, archetype
     FROM event WHERE parent_event_id=$1 ORDER BY starts_at NULLS LAST, created_at`, [parentId])).rows
    .map(r => ({ id: r.id, title: r.title, date: r.date ?? null, archetype: r.archetype ?? 'single' }));
}
export async function parentOf(db: Database, eventId: string): Promise<{ id: string; title: string } | null> {
  const r = (await db.query<any>(
    `SELECT p.id, p.name title FROM event c JOIN event p ON p.id=c.parent_event_id WHERE c.id=$1`, [eventId])).rows[0];
  return r ? { id: r.id, title: r.title } : null;
}

// Attribution: identities (claims) + ticket buyers (paid claims) driven per promo
// token. Counts claims globally by source_edge='party:<token>' so a sub-event
// fighter's link that sells a parent ticket still credits them; the parent view
// rolls up its own parties + all sub-event parties.
export interface PartyStat { partyId: string; name: string; role: string; side: string | null; token: string; kind: string; status: string; clicks: number; identities: number; ticketBuyers: number; subEvent?: string }
async function promoCounts(db: Database, token: string): Promise<{ identities: number; ticketBuyers: number }> {
  const r = (await db.query<{ identities: number; buyers: number }>(
    `SELECT count(*)::int identities, count(*) FILTER (WHERE price_cents > 0 OR status='paid')::int buyers
     FROM claim WHERE source_edge=$1 AND status NOT IN ('refunded','no_show')`, ['party:' + token])).rows[0];
  return { identities: r?.identities ?? 0, ticketBuyers: r?.buyers ?? 0 };
}
export async function partyAttribution(db: Database, eventId: string): Promise<{ rows: PartyStat[]; total: { identities: number; ticketBuyers: number; clicks: number } }> {
  const own = await listParties(db, eventId);
  const rows: PartyStat[] = [];
  for (const p of own) {
    const c = await promoCounts(db, p.promoToken);
    rows.push({ partyId: p.id, name: p.name, role: p.role, side: p.side, token: p.promoToken, kind: p.kind, status: p.status, clicks: p.clicks, ...c });
  }
  // roll up sub-events
  for (const s of await subEvents(db, eventId)) {
    for (const p of await listParties(db, s.id)) {
      const c = await promoCounts(db, p.promoToken);
      rows.push({ partyId: p.id, name: p.name, role: p.role, side: p.side, token: p.promoToken, kind: p.kind, status: p.status, clicks: p.clicks, subEvent: s.title, ...c });
    }
  }
  const total = rows.reduce((a, r) => ({ identities: a.identities + r.identities, ticketBuyers: a.ticketBuyers + r.ticketBuyers, clicks: a.clicks + r.clicks }), { identities: 0, ticketBuyers: 0, clicks: 0 });
  return { rows, total };
}
// The party (if any) owned by this viewer for this event — so a participant sees
// their own link + draw.
export async function myParty(db: Database, eventId: string, ownedKinds: { kind: string; id: string }[]): Promise<EventParty | null> {
  if (!ownedKinds.length) return null;
  const parties = await listParties(db, eventId);
  return parties.find(p => p.entityId && ownedKinds.some(o => o.kind === p.entityKind && o.id === p.entityId)) ?? null;
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
