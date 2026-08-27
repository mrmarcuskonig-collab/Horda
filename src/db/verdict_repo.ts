// verdict_repo.ts — the rating platform, slice 1 + provenance amendment.
//
// PRODUCT SURFACE (ADR-0002 §2.5): reads the core graph (presence, claim) but owns
// its own tables. Everything a later slice adds hangs off here, not off the core.
//
// PROVENANCE AMENDMENT (hosted-only): after a hosted event ends, ANY logged-in fan
// can leave a verdict — but every verdict is tagged by how they experienced it, from
// the core graph, and the tiers are treated as different-strength signals:
//   in_room       — a real door scan (presence.fidelity='in_room')   [VERIFIED]
//   online        — a stream check-in (presence.fidelity='online')    [VERIFIED]
//   off_platform  — no presence at all; self-declared, unverified      [WIDER, organiser-only]
// The PUBLIC room score is computed from VERIFIED tiers only — the moat ("we know who
// was actually there") stays clean. off_platform sentiment is organiser-only for now,
// never blended into the public number (rating-platform.md §2.1/§2.3, and the amendment).
//
// Still true: facts in / aggregates computed (§2.3); source-tagged (§2.4); the
// subject is an EVENT, never a fan (§2.1); one verdict per person per event.
import type { Database } from './index.ts';
import { PRODUCT_SOURCE } from './product.ts';

const clamp5 = (n: unknown): number => Math.max(1, Math.min(5, Math.round(Number(n) || 0)));

// The public floor (§3.5): a public room score needs at least this many VERIFIED
// verdicts AND that many as a share of the room. Computed on read, never stored.
export const FLOOR_MIN_VERDICTS = 5;
export const FLOOR_MIN_FRACTION = 0.20;

export type Attendance = 'in_room' | 'online' | 'off_platform';
const VERIFIED: Attendance[] = ['in_room', 'online'];

// A fan's relationship to an event, read from the core graph. A door scan or stream
// check-in is a PRESENCE (verified); no presence → off_platform (self-declared).
export async function attendanceOf(db: Database, eventId: string, fanId: string | null): Promise<{ kind: Attendance; presenceId: string | null }> {
  if (!fanId) return { kind: 'off_platform', presenceId: null };
  const p = (await db.query<{ id: string; fidelity: string }>(
    `SELECT id, fidelity FROM presence WHERE event_id=$1 AND fan_id=$2 LIMIT 1`, [eventId, fanId])).rows[0];
  if (!p) return { kind: 'off_platform', presenceId: null };
  return { kind: p.fidelity === 'online' ? 'online' : 'in_room', presenceId: p.id };
}

export async function hasVerdict(db: Database, eventId: string, fanId: string | null): Promise<boolean> {
  if (!fanId) return false;
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM verdict WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0].n > 0;
}

// Can this fan rate right now, and as which tier? Verified attendees can rate as soon
// as they have a presence; off_platform fans only AFTER the event has ended (you can't
// "watch on TV" a match that hasn't happened). One verdict per person.
export async function verdictEligibility(db: Database, eventId: string, fanId: string | null, ended: boolean): Promise<{ canVerdict: boolean; alreadyRated: boolean; attendance: Attendance }> {
  if (!fanId) return { canVerdict: false, alreadyRated: false, attendance: 'off_platform' };
  const rated = await hasVerdict(db, eventId, fanId);
  const att = await attendanceOf(db, eventId, fanId);
  const canVerdict = !rated && (att.kind !== 'off_platform' || ended);
  return { canVerdict, alreadyRated: rated, attendance: att.kind };
}

export interface VerdictInput { eventId: string; fanId: string | null; atmosphere: number; worthIt: number; returnIntent: boolean; note?: string | null; ended: boolean; source?: string }
export type VerdictResult = { ok: true; id: string; attendance: Attendance } | { ok: false; reason: 'no_fan' | 'already' | 'not_ended' };

// Create a verdict. The tier is DERIVED from the core graph (presence), never taken
// from the caller — so a fan can't claim "in_room" without a scan. Off_platform is
// allowed only once the event has ended. One per (event, fan) (enforced by a unique
// index too). Clamped 1–5. Source-tagged.
export async function createVerdict(db: Database, o: VerdictInput): Promise<VerdictResult> {
  if (!o.fanId) return { ok: false, reason: 'no_fan' };
  if (await hasVerdict(db, o.eventId, o.fanId)) return { ok: false, reason: 'already' };
  const att = await attendanceOf(db, o.eventId, o.fanId);
  if (att.kind === 'off_platform' && !o.ended) return { ok: false, reason: 'not_ended' };
  const note = (o.note ?? '').trim() || null;
  const id = (await db.query<{ id: string }>(
    `INSERT INTO verdict (presence_id, event_id, fan_id, atmosphere, worth_it, return_intent, note, source, attendance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [att.presenceId, o.eventId, o.fanId, clamp5(o.atmosphere), clamp5(o.worthIt), !!o.returnIntent, note, o.source ?? PRODUCT_SOURCE, att.kind])).rows[0].id;
  return { ok: true, id, attendance: att.kind };
}

async function tallies(db: Database, eventId: string): Promise<{ verified: number; presences: number }> {
  const v = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM verdict WHERE event_id=$1 AND attendance = ANY($2)`, [eventId, VERIFIED])).rows[0].n;
  const p = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM presence WHERE event_id=$1`, [eventId])).rows[0].n;
  return { verified: v, presences: p };
}

// PUBLIC room score — mean atmosphere over VERIFIED verdicts only, above the floor.
// off_platform ratings never touch this number. null → suppressed.
export async function roomScore(db: Database, eventId: string): Promise<{ score: number; verdicts: number } | null> {
  const t = await tallies(db, eventId);
  if (t.verified < FLOOR_MIN_VERDICTS) return null;
  if (t.presences === 0 || t.verified < FLOOR_MIN_FRACTION * t.presences) return null;
  const m = (await db.query<{ a: number | null }>(`SELECT avg(atmosphere)::float a FROM verdict WHERE event_id=$1 AND attendance = ANY($2)`, [eventId, VERIFIED])).rows[0].a;
  if (m == null) return null;
  return { score: Math.round(m * 10) / 10, verdicts: t.verified };
}

interface TierAgg { count: number; atmosphere: number | null; worthIt: number | null; wouldReturnPct: number | null }
async function tierAgg(db: Database, eventId: string, kinds: Attendance[]): Promise<TierAgg> {
  const r = (await db.query<{ n: number; atm: number | null; wit: number | null; ret: number | null }>(
    `SELECT count(*)::int n, avg(atmosphere)::float atm, avg(worth_it)::float wit,
            avg(CASE WHEN return_intent THEN 1.0 ELSE 0.0 END)::float ret
       FROM verdict WHERE event_id=$1 AND attendance = ANY($2)`, [eventId, kinds])).rows[0];
  const r1 = (x: number | null) => x == null ? null : Math.round(x * 10) / 10;
  return { count: r.n, atmosphere: r1(r.atm), worthIt: r1(r.wit), wouldReturnPct: r.ret == null ? null : Math.round(r.ret * 100) };
}

export interface EventReport {
  presences: number; verifiedVerdicts: number; widerVerdicts: number; responseRate: number;
  claimedSpots: number; noShowRate: number;
  verified: TierAgg;                 // in-room + stream — the public-quality signal
  wider: TierAgg;                    // off_platform — ORGANISER-ONLY
  inRoom: TierAgg; online: TierAgg;  // the verified split, for the organiser
  aboveFloor: boolean;
  notes: { note: string; atmosphere: number; worthIt: number; attendance: Attendance }[]; // organiser-only, labelled by tier
}

export async function eventReport(db: Database, eventId: string): Promise<EventReport> {
  const t = await tallies(db, eventId);
  const claimed = (await db.query<{ n: number }>(
    `SELECT COALESCE(SUM(party_size),0)::int n FROM claim
     WHERE event_id=$1 AND status IN ('claimed','approved','verified') AND voided_at IS NULL`, [eventId])).rows[0].n;
  const verified = await tierAgg(db, eventId, VERIFIED);
  const wider = await tierAgg(db, eventId, ['off_platform']);
  const inRoom = await tierAgg(db, eventId, ['in_room']);
  const online = await tierAgg(db, eventId, ['online']);
  const notes = (await db.query<{ note: string; atmosphere: number; worth_it: number; attendance: Attendance }>(
    `SELECT note, atmosphere, worth_it, attendance FROM verdict WHERE event_id=$1 AND note IS NOT NULL ORDER BY created_at DESC`, [eventId])).rows;
  return {
    presences: t.presences, verifiedVerdicts: verified.count, widerVerdicts: wider.count,
    responseRate: t.presences ? verified.count / t.presences : 0,
    claimedSpots: claimed,
    noShowRate: claimed ? Math.max(0, (claimed - t.presences) / claimed) : 0,
    verified, wider, inRoom, online,
    aboveFloor: (await roomScore(db, eventId)) != null,
    notes: notes.map(n => ({ note: n.note, atmosphere: n.atmosphere, worthIt: n.worth_it, attendance: n.attendance })),
  };
}
