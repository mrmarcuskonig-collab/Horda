// payouts_repo.ts — Stripe Connect payout accounts per host entity. The gate for
// paid ticketing: a host can only *collect* money once charges are enabled (KYC
// passed). Free events never touch this — gate money, not creation.
import type { Database } from './index.ts';

export interface PayoutAccount { stripeAccountId: string | null; chargesEnabled: boolean; payoutsEnabled: boolean }

export async function getPayoutAccount(db: Database, hostKind: string, hostId: string): Promise<PayoutAccount | null> {
  const r = (await db.query<any>(
    `SELECT stripe_account_id, charges_enabled, payouts_enabled FROM payout_account WHERE host_kind=$1 AND host_id=$2`,
    [hostKind, hostId])).rows[0];
  return r ? { stripeAccountId: r.stripe_account_id ?? null, chargesEnabled: !!r.charges_enabled, payoutsEnabled: !!r.payouts_enabled } : null;
}
// Save (or create) the connected account id for a host.
export async function upsertPayoutAccount(db: Database, hostKind: string, hostId: string, stripeAccountId: string): Promise<void> {
  await db.query(
    `INSERT INTO payout_account (host_kind, host_id, stripe_account_id) VALUES ($1,$2,$3)
     ON CONFLICT (host_kind, host_id) DO UPDATE SET stripe_account_id=$3, updated_at=now()`,
    [hostKind, hostId, stripeAccountId]);
}
export async function setPayoutStatus(db: Database, hostKind: string, hostId: string, s: { chargesEnabled: boolean; payoutsEnabled: boolean }): Promise<void> {
  await db.query(
    `UPDATE payout_account SET charges_enabled=$3, payouts_enabled=$4, updated_at=now() WHERE host_kind=$1 AND host_id=$2`,
    [hostKind, hostId, s.chargesEnabled, s.payoutsEnabled]);
}
// Can this host actually sell paid tickets right now? (charges enabled = KYC done)
export async function isPayoutsEnabled(db: Database, hostKind: string, hostId: string): Promise<boolean> {
  return (await getPayoutAccount(db, hostKind, hostId))?.chargesEnabled ?? false;
}
