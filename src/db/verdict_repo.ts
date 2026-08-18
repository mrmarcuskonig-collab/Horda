// verdict_repo.ts — the rating platform, slice 1 (event-level Verdict).
//
// PRODUCT SURFACE (ADR-0002 §2.5): reads the core graph (presence, claim) but owns
// its own tables. Everything a later slice adds hangs off here, not off the core.
//
// The four load-bearing rules from rating-platform.md live in THIS file:
//   §2.2 eligibility is structural — a verdict is created FROM a presence row; the
//        event_id and fan_id are copied off that row, never taken from the caller,
//        so no call site can record an opinion for someone who wasn't scanned in.
//   §2.3 facts in, aggregates computed — nothing here is stored pre-aggregated;
//        room score / rates / the public floor are computed on read, every time.
//   §2.4 every fact is source-tagged (PRODUCT_SOURCE).
//   §2.1 a verdict's subject is an EVENT — never another fan. No fan→fan edge.
import type { Database } from './index.ts';
import { PRODUCT_SOURCE } from './product.ts';

// Scores are a 1–5 ceiling. Clamp server-side (the schema also CHECKs) so a crafted
// POST of atmosphere=99 becomes 5, not a 500.
const clamp5 = (n: unknown): number => Math.max(1, Math.min(5, Math.round(Number(n) || 0)));

// The public floor (§3.5): a room score is shown publicly ONLY with at least this
// many verdicts AND at least this share of the room having spoken. Below it the
// number is noise and pretending otherwise is the fastest way to lose the number's
// credibility. These are constants, computed on read — never a stored flag.
export const FLOOR_MIN_VERDICTS = 5;
export const FLOOR_MIN_FRACTION = 0.20;

export interface VerdictInput { presenceId: string; atmosphere: number; worthIt: number; returnIntent: boolean; note?: string | null; source?: string }
export type VerdictResult = { ok: true; id: string } | { ok: false; reason: 'no_presence' | 'already' };

// Create a verdict. Takes a PRESENCE id (the right to speak) and derives event/fan
// from it — a caller cannot pass a fan_id/event_id of their choosing. One per
// presence (UNIQUE + explicit check for a clean error). Idempotent-safe.
export async function createVerdict(db: Database, o: VerdictInput): Promise<VerdictResult> {
  const pres = (await db.query<{ id: string; event_id: string; fan_id: string }>(
    `SELECT id, event_id, fan_id FROM presence WHERE id=$1`, [o.presenceId])).rows[0];
  if (!pres) return { ok: false, reason: 'no_presence' };          // §2.2 — no room, no opinion
  const dup = (await db.query<{ id: string }>(`SELECT id FROM verdict WHERE presence_id=$1`, [o.presenceId])).rows[0];
  if (dup) return { ok: false, reason: 'already' };                // one verdict per presence
  const note = (o.note ?? '').trim() || null;
  const id = (await db.query<{ id: string }>(
    `INSERT INTO verdict (presence_id, event_id, fan_id, atmosphere, worth_it, return_intent, note, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [pres.id, pres.event_id, pres.fan_id, clamp5(o.atmosphere), clamp5(o.worthIt), !!o.returnIntent, note, o.source ?? PRODUCT_SOURCE])).rows[0].id;
  return { ok: true, id };
}

// The viewer's presence for this event — the token the verdict form is gated on.
// null → they were never scanned in and have no verdict to give.
export async function presenceForFan(db: Database, eventId: string, fanId: string | null): Promise<{ id: string } | null> {
  if (!fanId) return null;
  const r = (await db.query<{ id: string }>(`SELECT id FROM presence WHERE event_id=$1 AND fan_id=$2 LIMIT 1`, [eventId, fanId])).rows[0];
  return r ? { id: r.id } : null;
}

// Has this fan already left their one verdict for this event?
export async function hasVerdict(db: Database, eventId: string, fanId: string | null): Promise<boolean> {
  if (!fanId) return false;
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM verdict WHERE event_id=$1 AND fan_id=$2`, [eventId, fanId])).rows[0].n > 0;
}

// What a fan can do right now: leave a verdict iff scanned in AND not yet rated.
export async function verdictEligibility(db: Database, eventId: string, fanId: string | null): Promise<{ presenceId: string | null; canVerdict: boolean; alreadyRated: boolean }> {
  const pres = await presenceForFan(db, eventId, fanId);
  if (!pres) return { presenceId: null, canVerdict: false, alreadyRated: false };
  const rated = await hasVerdict(db, eventId, fanId);
  return { presenceId: pres.id, canVerdict: !rated, alreadyRated: rated };
}

async function tallies(db: Database, eventId: string): Promise<{ verdicts: number; presences: number }> {
  const v = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM verdict WHERE event_id=$1`, [eventId])).rows[0].n;
  const p = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM presence WHERE event_id=$1`, [eventId])).rows[0].n;
  return { verdicts: v, presences: p };
}

// PUBLIC room score — mean atmosphere, but ONLY above the floor (§3.5). Below the
// floor this returns null and the event page shows nothing. Computed every call.
export async function roomScore(db: Database, eventId: string): Promise<{ score: number; verdicts: number } | null> {
  const t = await tallies(db, eventId);
  if (t.verdicts < FLOOR_MIN_VERDICTS) return null;
  if (t.presences === 0 || t.verdicts < FLOOR_MIN_FRACTION * t.presences) return null;
  const m = (await db.query<{ a: number | null }>(`SELECT avg(atmosphere)::float a FROM verdict WHERE event_id=$1`, [eventId])).rows[0].a;
  if (m == null) return null;
  return { score: Math.round(m * 10) / 10, verdicts: t.verdicts };
}

export interface EventReport {
  presences: number; verdicts: number; responseRate: number;      // verdicts ÷ presences
  claimedSpots: number; noShowRate: number;                       // (claimed − presences) ÷ claimed
  atmosphere: number | null; worthIt: number | null; wouldReturnPct: number | null;
  aboveFloor: boolean;                                            // is the public score live?
  notes: { note: string; atmosphere: number; worthIt: number }[]; // ORGANISER-ONLY verbatim (§2.1)
}

// The organiser's report for /manage — attendance AND verdict numbers, plus the
// verbatim notes (organiser-visible only; the public event page never gets these).
export async function eventReport(db: Database, eventId: string): Promise<EventReport> {
  const t = await tallies(db, eventId);
  const claimed = (await db.query<{ n: number }>(
    `SELECT COALESCE(SUM(party_size),0)::int n FROM claim
     WHERE event_id=$1 AND status IN ('claimed','approved','verified') AND voided_at IS NULL`, [eventId])).rows[0].n;
  const agg = (await db.query<{ atm: number | null; wit: number | null; ret: number | null }>(
    `SELECT avg(atmosphere)::float atm, avg(worth_it)::float wit, avg(CASE WHEN return_intent THEN 1.0 ELSE 0.0 END)::float ret
       FROM verdict WHERE event_id=$1`, [eventId])).rows[0];
  const notes = (await db.query<{ note: string; atmosphere: number; worth_it: number }>(
    `SELECT note, atmosphere, worth_it FROM verdict WHERE event_id=$1 AND note IS NOT NULL ORDER BY created_at DESC`, [eventId])).rows;
  const r1 = (x: number | null) => x == null ? null : Math.round(x * 10) / 10;
  return {
    presences: t.presences, verdicts: t.verdicts,
    responseRate: t.presences ? t.verdicts / t.presences : 0,
    claimedSpots: claimed,
    noShowRate: claimed ? Math.max(0, (claimed - t.presences) / claimed) : 0,
    atmosphere: r1(agg.atm), worthIt: r1(agg.wit),
    wouldReturnPct: agg.ret == null ? null : Math.round(agg.ret * 100),
    aboveFloor: (await roomScore(db, eventId)) != null,
    notes: notes.map(n => ({ note: n.note, atmosphere: n.atmosphere, worthIt: n.worth_it })),
  };
}
