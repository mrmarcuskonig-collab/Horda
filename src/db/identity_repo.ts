// identity_repo.ts — the canonical Fan ID: one `person` per human, keyed on phone.
//
// This is the spine that lets the SAME person be recognised across tenants. It is
// deliberately additive: account/fan are untouched; `person` sits above them via an
// append-only link. The phone is an IDENTITY key, never an auth factor — sign-in
// stays magic-link/email only (decision 0046). Verification (the OTP that flips
// `verified_at`) is a later hardening; captured-but-unproven numbers are still keyed.
import type { Database } from './index.ts';
import { PRODUCT_SOURCE } from './product.ts';

// Normalize a raw phone to E.164. German-first market → a national leading 0
// becomes +49. Deterministic and dependency-free (AGENTS.md: keep deps at three) —
// good enough to key on, not a full libphonenumber validation. Returns null when
// the input can't be a plausible number.
export function normalizePhone(raw: string | null | undefined, defaultCc = '49'): string | null {
  if (raw == null) return null;
  const hadPlus = String(raw).trim().startsWith('+');
  let s = String(raw).replace(/[^\d]/g, '');   // strip spaces, dashes, parens, letters
  if (!s) return null;
  if (!hadPlus) {
    if (s.startsWith('00')) s = s.slice(2);                    // 0049… → 49…
    else if (s.startsWith('0')) s = defaultCc + s.slice(1);    // national 0176… → 49176…
    // a bare number with no 0 and no + is left as-is (best effort)
  }
  if (s.length < 8 || s.length > 15) return null;              // E.164 bounds
  return '+' + s;
}

// Find-or-create the person for this phone and record an append-only link from the
// account. Same normalized number on two accounts → the SAME person (merge by
// phone). Returns the person id, or null if the phone can't be normalized.
export async function linkPersonByPhone(db: Database, accountId: string, rawPhone: string | null | undefined, source = PRODUCT_SOURCE): Promise<string | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  let personId = (await db.query<{ id: string }>(`SELECT id FROM person WHERE phone_e164=$1`, [phone])).rows[0]?.id;
  if (!personId) {
    personId = (await db.query<{ id: string }>(`INSERT INTO person (phone_e164) VALUES ($1) RETURNING id`, [phone])).rows[0].id;
  }
  // Append-only. Don't stack an identical (account,person) row back-to-back, but a
  // re-link after a number change IS a new row — the history is the asset.
  const last = (await db.query<{ person_id: string }>(
    `SELECT person_id FROM person_link WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1`, [accountId])).rows[0];
  if (!last || last.person_id !== personId) {
    await db.query(`INSERT INTO person_link (person_id, account_id, source) VALUES ($1,$2,$3)`, [personId, accountId, source]);
  }
  return personId;
}

// The account's current canonical person (most recent link), if any.
export async function personFor(db: Database, accountId: string): Promise<{ id: string; phone: string; verified: boolean } | null> {
  const r = (await db.query<{ id: string; phone_e164: string; verified_at: string | null }>(
    `SELECT p.id, p.phone_e164, p.verified_at FROM person_link l JOIN person p ON p.id = l.person_id
     WHERE l.account_id=$1 ORDER BY l.created_at DESC LIMIT 1`, [accountId])).rows[0];
  return r ? { id: r.id, phone: r.phone_e164, verified: !!r.verified_at } : null;
}

// Every account currently linked to a person (the merge view — the point of the
// whole thing: two accounts, one human).
export async function accountsForPerson(db: Database, personId: string): Promise<string[]> {
  const rows = (await db.query<{ account_id: string }>(
    `SELECT DISTINCT account_id FROM person_link WHERE person_id=$1`, [personId])).rows;
  return rows.map(r => r.account_id);
}

// Flip a person's phone to verified (called by the OTP verify step once it exists).
export async function markPersonVerified(db: Database, personId: string): Promise<void> {
  await db.query(`UPDATE person SET verified_at=now() WHERE id=$1 AND verified_at IS NULL`, [personId]);
}

// --- phone verification (OTP) ---------------------------------------------
const genCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

// Start verification: store a fresh code for the phone and RETURN it so the caller
// can hand it to the OTP adapter for delivery. The code is never returned to the
// client — only to send(). Returns null if the phone can't be normalized.
export async function startPhoneVerification(db: Database, rawPhone: string, ttlMs = 600_000): Promise<{ phone: string; code: string } | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const code = genCode();
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await db.query(
    `INSERT INTO phone_otp (phone_e164, code, expires_at, created_at) VALUES ($1,$2,$3, now())
     ON CONFLICT (phone_e164) DO UPDATE SET code=EXCLUDED.code, expires_at=EXCLUDED.expires_at, created_at=now()`,
    [phone, code, expires]);
  return { phone, code };
}

// Confirm a code: on match (and not expired), flip the person's verified_at and
// clear the code. Returns true on success.
export async function confirmPhoneVerification(db: Database, rawPhone: string, code: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  if (!phone || !code) return false;
  const row = (await db.query<{ code: string; expires_at: string }>(
    `SELECT code, expires_at FROM phone_otp WHERE phone_e164=$1`, [phone])).rows[0];
  if (!row || row.code !== String(code).trim() || new Date(row.expires_at).getTime() < Date.now()) return false;
  await db.query(`UPDATE person SET verified_at=now() WHERE phone_e164=$1 AND verified_at IS NULL`, [phone]);
  await db.query(`DELETE FROM phone_otp WHERE phone_e164=$1`, [phone]);
  return true;
}
