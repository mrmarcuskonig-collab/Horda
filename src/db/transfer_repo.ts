// transfer_repo.ts — how a ticket changes hands.
//
// ═══════════════════════════════════════════════════════════════════════════
// DECISION (17 Jul 2026, Marcus): FURIA DOES NOT DO RESALE. Not "not yet" —
// not at all. This is a position, not a backlog item.
//
// The reasoning, so nobody relitigates it from scratch:
//
//   * A ticket that can be sold is an asset. An asset attracts people who want
//     the asset rather than the event. Furia's entire claim is that it knows who
//     is actually in the room — a secondary market is the mechanism by which
//     that stops being true.
//   * Luma, the closest comparable, doesn't offer resale either. They offer free
//     TRANSFER and nothing more. Their Terms don't mention resale once. The
//     biggest modern events product looked at this and declined it too.
//   * Taking money on a secondary leg is what drags in every hard question:
//     whether § 312g Abs. 2 Nr. 9 BGB's dated-event exemption survives a
//     secondary sale, tout regulation, and who owes the refund. Refuse the money
//     leg and none of them arise. That § 312g question is now MOOT for us and
//     comes off the pre-launch legal list.
//
// FREE TRANSFER — the Luma model — is a SEPARATE and still-open question. Not
// built, on the roadmap, revisit when a fan actually asks. It is not resale: no
// price, no money, and the recipient must create an account to claim it, which
// makes it identity capture rather than leakage. If it ever ships, it ships as
// kind:'gift' at zero and nothing else.
// ═══════════════════════════════════════════════════════════════════════════
//
// SO WHY IS THERE STILL A 'resale' KIND AND A PRICE CAP?
// -----------------------------------------------------
// Because the ledger has to be able to DESCRIBE a paid transfer even though we
// never perform one. Two reasons, both real:
//
//   1. Refunds and organiser returns move tickets, and they have a price (what
//      was paid back). 'return' needs the same machinery.
//   2. If this decision is ever reversed, the reversal must be a deliberate act
//      with the guardrails already in place — not a fresh implementation written
//      under deadline by someone who has forgotten why the rules exist. The cap
//      and the ledger are the guardrails. They cost nothing to keep.
//
// The flag stays off, no route reaches the resale path, and the AGB says resale
// is not offered — that sentence is true only because RESALE_ENABLED is false.
//
// THE THREE RULES, which apply to ANY movement of a ticket (gift, return, or a
// resale we don't do):
//
//  1. REISSUE, NEVER HAND OVER. A transfer voids the old claim and mints a new
//     one with a new pass token, hence a new QR. The old QR dies the instant it
//     commits. If a ticket were a bearer PDF, a screenshot could be sold five
//     times and the fifth buyer finds out at the door.
//  2. FACE VALUE IS THE CEILING. Dormant under the decision above, kept as the
//     guardrail that makes reversing it safe rather than reckless.
//  3. EVERY MOVE IS LEDGERED. Append-only, kinds kept distinct. "How did this
//     person get in" is a question you can only answer if you recorded it as it
//     happened — provenance cannot be retrofitted.
import { randomBytes } from 'node:crypto';
import type { Database } from './index.ts';

/**
 * OFF, by decision, indefinitely. See the header: we don't do resale.
 *
 * Env-read rather than hardcoded `false` only so the logic below can be exercised
 * in a staging environment without a code change. No ROUTE reads this flag —
 * flipping it surfaces exactly nothing. Turning resale on would mean writing UI,
 * a payment leg and a refund path that do not exist, which is the point: it
 * cannot happen by accident, or by someone flipping an env var they found.
 */
export const RESALE_ENABLED = process.env.FURIA_RESALE === 'on';

/**
 * Free transfer ("I can't go, you take my spot") — the Luma model. Also off, but
 * for a completely different reason: resale is DECLINED, this is just NOT BUILT
 * YET. It's the one that might ship.
 *
 * When it does: price is always 0 (a gift with a price is a resale wearing a
 * friendlier word — enforced below), and the recipient must be a real account,
 * because a gift that isn't reissued to the recipient's identity silently breaks
 * the personengebunden promise in the AGB.
 */
export const GIFT_ENABLED = process.env.FURIA_GIFT === 'on';

export type TransferKind = 'gift' | 'resale' | 'return';

export interface TransferRow {
  id: string; eventId: string; kind: TransferKind;
  fromFanId: string | null; toFanId: string | null;
  priceCents: number; faceValueCents: number; partySize: number;
  reason: string | null; createdAt: string;
}

export class TransferError extends Error {
  code: string;
  constructor(code: string, msg: string) { super(msg); this.code = code; }
}

/** What a claim originally cost, per spot. The ceiling for any resale of it. */
export async function faceValueOf(db: Database, claimId: string): Promise<number> {
  const r = (await db.query<{ price_cents: number | null; fmt_price: number | null }>(
    `SELECT c.price_cents, ef.price_cents fmt_price
     FROM claim c LEFT JOIN event_format ef ON ef.id=c.format_id WHERE c.id=$1`, [claimId])).rows[0];
  if (!r) return 0;
  // The claim's own price is the truth (it is what was charged). Fall back to the
  // door's price only for rows written before per-claim pricing existed.
  return r.price_cents ?? r.fmt_price ?? 0;
}

/**
 * Move a ticket from one identity to another.
 *
 * Deliberately ONE function for gift and resale: they differ only by whether
 * money moved and what the law then says about it. Two functions would drift, and
 * the day they drift is the day a "gift" of €80 quietly bypasses the price cap.
 *
 * NOTE ON MONEY: this records the ledger and reissues the claim. It does NOT move
 * funds — no Stripe call, no payout, no refund. That is on purpose and matches
 * the standing rule for attribution: gate money, not creation. When resale turns
 * on, the payment leg gets built and tested on its own; until then this cannot
 * charge anyone by accident.
 */
export async function transferClaim(db: Database, o: {
  claimId: string; toFanId: string; kind: TransferKind; priceCents?: number; reason?: string;
  /** Escape hatch for organiser-side returns/refunds, which are not resale. */
  force?: boolean;
}): Promise<{ transferId: string; newClaimId: string | null; newToken: string | null }> {
  if (!o.force) {
    if (o.kind === 'resale' && !RESALE_ENABLED) throw new TransferError('resale_disabled', 'Resale is not offered.');
    if (o.kind === 'gift' && !GIFT_ENABLED) throw new TransferError('gift_disabled', 'Gifting is not offered.');
  }

  const c = (await db.query<any>(
    `SELECT id, event_id, fan_id, status, party_size, price_cents, format_id, voided_at FROM claim WHERE id=$1`, [o.claimId])).rows[0];
  if (!c) throw new TransferError('not_found', 'No such ticket.');
  if (c.voided_at) throw new TransferError('already_void', 'That ticket has already been transferred.');
  // You cannot sell a seat you were never given. A waitlisted claim is a hope,
  // not a ticket — letting it move would sell a place in a queue.
  if (!['claimed', 'approved'].includes(c.status)) {
    throw new TransferError('not_transferable', c.status === 'verified'
      ? 'That ticket has already been used to enter.'
      : 'Only a confirmed ticket can be transferred.');
  }
  if (c.fan_id === o.toFanId) throw new TransferError('same_fan', 'That ticket is already theirs.');

  const face = await faceValueOf(db, o.claimId);
  const price = Math.max(0, Math.round(o.priceCents ?? 0));
  if (o.kind === 'gift' && price > 0) throw new TransferError('gift_priced', 'A gift cannot have a price.');
  // Rule 2, enforced rather than documented. Per spot × spots moved.
  if (o.kind === 'resale' && price > face * c.party_size) {
    throw new TransferError('above_face_value', 'A ticket cannot be resold for more than it cost.');
  }
  // One claim per (event, fan) is a hard invariant of the claim rail. Someone who
  // already holds a spot cannot be handed a second one — they'd have two QRs and
  // the capacity count would be a lie.
  const dup = (await db.query<{ id: string }>(
    `SELECT id FROM claim WHERE event_id=$1 AND fan_id=$2 AND voided_at IS NULL`, [c.event_id, o.toFanId])).rows[0];
  if (dup) throw new TransferError('already_claimed', 'They already have a spot at this event.');

  // Rule 1: void, then mint. Order matters — the old pass must be dead before the
  // new one exists, so there is no instant where both open the same door.
  await db.query(`UPDATE claim SET voided_at=now(), void_reason=$2, status='refunded' WHERE id=$1`,
    [o.claimId, o.reason ?? o.kind]);

  let newClaimId: string | null = null;
  let token: string | null = null;
  if (o.kind !== 'return') {
    newClaimId = (await db.query<{ id: string }>(
      `INSERT INTO claim (event_id, fan_id, status, party_size, price_cents, format_id, source_edge, transferred_from_claim_id)
       SELECT event_id, $2, 'claimed', party_size, $3, format_id, source_edge, id FROM claim WHERE id=$1 RETURNING id`,
      [o.claimId, o.toFanId, o.kind === 'resale' ? price : 0])).rows[0].id;
    token = randomBytes(16).toString('hex');
    await db.query(`INSERT INTO pass (claim_id, fan_id, token) VALUES ($1,$2,$3)`, [newClaimId, o.toFanId, token]);
  }

  const tr = (await db.query<{ id: string }>(
    `INSERT INTO ticket_transfer (event_id, from_claim_id, to_claim_id, from_fan_id, to_fan_id, kind, price_cents, face_value_cents, party_size, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [c.event_id, o.claimId, newClaimId, c.fan_id, o.kind === 'return' ? null : o.toFanId, o.kind, price, face, c.party_size, o.reason ?? null])).rows[0];

  return { transferId: tr.id, newClaimId, newToken: token };
}

/** The provenance of one ticket: every hand it has passed through, oldest first. */
export async function claimProvenance(db: Database, claimId: string): Promise<TransferRow[]> {
  const rows = (await db.query<any>(
    `WITH RECURSIVE chain AS (
       SELECT id, transferred_from_claim_id FROM claim WHERE id=$1
       UNION ALL
       SELECT c.id, c.transferred_from_claim_id FROM claim c JOIN chain ch ON c.id = ch.transferred_from_claim_id
     )
     SELECT t.* FROM ticket_transfer t
     WHERE t.to_claim_id IN (SELECT id FROM chain) OR t.from_claim_id IN (SELECT id FROM chain)
     ORDER BY t.created_at ASC`, [claimId])).rows;
  return rows.map(mapRow);
}

/** Every transfer on an event — the organiser's answer to "who is really coming". */
export async function eventTransfers(db: Database, eventId: string): Promise<TransferRow[]> {
  return (await db.query<any>(
    `SELECT * FROM ticket_transfer WHERE event_id=$1 ORDER BY created_at DESC`, [eventId])).rows.map(mapRow);
}

function mapRow(r: any): TransferRow {
  return {
    id: r.id, eventId: r.event_id, kind: r.kind,
    fromFanId: r.from_fan_id ?? null, toFanId: r.to_fan_id ?? null,
    priceCents: r.price_cents ?? 0, faceValueCents: r.face_value_cents ?? 0,
    partySize: r.party_size ?? 1, reason: r.reason ?? null,
    createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
  };
}
