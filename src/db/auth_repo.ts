// auth_repo.ts — accounts, password auth, sessions, and entity ownership.
// The identity/ownership layer (the costly-to-change piece, so: explicit).
// scrypt hashing is fine for the pilot; swap to a managed auth/bcrypt in prod.
import { randomBytes, scryptSync, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import type { Database } from './index.ts';

function hashPw(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pw, salt, 32).toString('hex');
}
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
function verifyPw(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hex] = stored.split(':');
  const a = scryptSync(pw, salt, 32);
  const b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface Account { id: string; email: string; displayName: string | null }

export async function signup(db: Database, email: string, name: string, pw: string, role = 'fan'): Promise<{ accountId: string; fanId: string } | null> {
  const exists = (await db.query<{ id: string }>(`SELECT id FROM account WHERE email=$1`, [email])).rows[0];
  if (exists) return null;
  const acc = (await db.query<{ id: string }>(`INSERT INTO account (email,display_name,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id`, [email, name, hashPw(pw), role])).rows[0];
  // everyone gets a fan identity (even creators are fans of others)
  const fan = (await db.query<{ id: string }>(`INSERT INTO fan (account_id,handle,display_name) VALUES ($1,$2,$3) RETURNING id`, [acc.id, email.split('@')[0], name])).rows[0];
  return { accountId: acc.id, fanId: fan.id };
}
// social login: find an account by email or create a passwordless one (linked to a fan)
export async function upsertOauthAccount(db: Database, email: string, name: string): Promise<{ accountId: string; fanId: string | null }> {
  const e = email.toLowerCase().trim();
  const exist = (await db.query<{ id: string }>(`SELECT id FROM account WHERE email=$1`, [e])).rows[0];
  if (exist) {
    const fan = (await db.query<{ id: string }>(`SELECT id FROM fan WHERE account_id=$1 LIMIT 1`, [exist.id])).rows[0];
    return { accountId: exist.id, fanId: fan?.id ?? null };
  }
  const acc = (await db.query<{ id: string }>(`INSERT INTO account (email,display_name,role) VALUES ($1,$2,'fan') RETURNING id`, [e, name || e])).rows[0];
  const fan = (await db.query<{ id: string }>(`INSERT INTO fan (account_id,handle,display_name) VALUES ($1,$2,$3) RETURNING id`, [acc.id, e.split('@')[0], name || e])).rows[0];
  return { accountId: acc.id, fanId: fan.id };
}
// Find an account by email or create a passwordless Fan one (used by OAuth +
// magic-link). Returns whether it was newly created so the caller can route a
// first-time user into onboarding.
export async function findOrCreateAccountByEmail(db: Database, email: string, name?: string): Promise<{ accountId: string; fanId: string | null; isNew: boolean }> {
  const e = email.toLowerCase().trim();
  const exist = (await db.query<{ id: string }>(`SELECT id FROM account WHERE email=$1`, [e])).rows[0];
  if (exist) {
    const fan = (await db.query<{ id: string }>(`SELECT id FROM fan WHERE account_id=$1 LIMIT 1`, [exist.id])).rows[0];
    return { accountId: exist.id, fanId: fan?.id ?? null, isNew: false };
  }
  const acc = (await db.query<{ id: string }>(`INSERT INTO account (email,display_name,role) VALUES ($1,$2,'fan') RETURNING id`, [e, name || e])).rows[0];
  const fan = (await db.query<{ id: string }>(`INSERT INTO fan (account_id,handle,display_name) VALUES ($1,$2,$3) RETURNING id`, [acc.id, e.split('@')[0], name || e])).rows[0];
  return { accountId: acc.id, fanId: fan.id, isNew: true };
}

// --- passwordless sign-in (magic link + OTP) -------------------------------
// Mint a single-use login token for an email. Returns the RAW magic-link token
// (only its hash is stored) and a 6-digit code. 15-minute expiry. No account
// need exist yet — consumeLogin creates one on first use (Fan by default).
export async function startLogin(db: Database, email: string, o: { name?: string; next?: string; ttlMs?: number } = {}): Promise<{ token: string; code: string }> {
  const e = email.toLowerCase().trim();
  const token = randomUUID() + randomUUID();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + (o.ttlMs ?? 900_000)).toISOString();
  await db.query(
    `INSERT INTO login_token (email, token_hash, code, name, next, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [e, sha256(token), code, o.name ?? null, o.next ?? null, expires]);
  return { token, code };
}
// Consume a login token by magic-link token OR by (email + code). Single-use,
// unexpired. Finds-or-creates the Fan account, marks the token used, returns the
// account + fan + isNew + the stored next-redirect.
export async function consumeLogin(db: Database, o: { token?: string; email?: string; code?: string }): Promise<{ accountId: string; fanId: string | null; isNew: boolean; next: string | null } | null> {
  let row: { id: string; email: string; name: string | null; next: string | null } | undefined;
  if (o.token) {
    row = (await db.query<any>(
      `SELECT id, email, name, next FROM login_token WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`, [sha256(o.token)])).rows[0];
  } else if (o.email && o.code) {
    row = (await db.query<any>(
      `SELECT id, email, name, next FROM login_token WHERE lower(email)=lower($1) AND code=$2 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`, [o.email.trim(), o.code.trim()])).rows[0];
  }
  if (!row) return null;
  await db.query(`UPDATE login_token SET used_at=now() WHERE id=$1`, [row.id]);
  const acc = await findOrCreateAccountByEmail(db, row.email, row.name ?? undefined);
  return { accountId: acc.accountId, fanId: acc.fanId, isNew: acc.isNew, next: row.next ?? null };
}

export async function accountRole(db: Database, accountId: string): Promise<string> {
  return (await db.query<{ role: string }>(`SELECT role FROM account WHERE id=$1`, [accountId])).rows[0]?.role ?? 'fan';
}
export async function setOnboarded(db: Database, accountId: string): Promise<void> {
  await db.query(`UPDATE account SET onboarded=true WHERE id=$1`, [accountId]);
}

// §1a layered roles. The creator layer ("Creathor") is an optional flag on the
// SAME account — not a separate persona. `verified` reflects light verification.
export async function activateCreatorLayer(db: Database, accountId: string, verified = true): Promise<void> {
  await db.query(`UPDATE account SET creator_layer=true, creator_verified=$2 WHERE id=$1`, [accountId, verified]);
}
export async function setBirthYear(db: Database, accountId: string, year: number): Promise<void> {
  if (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear()) return;
  await db.query(`UPDATE account SET birth_year=$2 WHERE id=$1`, [accountId, year]);
}
export interface AccountFlags { creatorLayer: boolean; birthYear: number | null; creatorVerified: boolean }
export async function accountFlags(db: Database, accountId: string): Promise<AccountFlags> {
  const r = (await db.query<{ creator_layer: boolean; birth_year: number | null; creator_verified: boolean }>(
    `SELECT creator_layer, birth_year, creator_verified FROM account WHERE id=$1`, [accountId])).rows[0];
  return { creatorLayer: !!r?.creator_layer, birthYear: r?.birth_year ?? null, creatorVerified: r?.creator_verified ?? true };
}
// 18+ gate for the creator layer and admin roles (base accounts are exempt).
export function isAdultYear(year: number | null | undefined): boolean {
  return !!year && (new Date().getFullYear() - year) >= 18;
}

export async function verifyLogin(db: Database, email: string, pw: string): Promise<string | null> {
  const a = (await db.query<{ id: string; password_hash: string }>(`SELECT id, password_hash FROM account WHERE email=$1`, [email])).rows[0];
  return a && verifyPw(pw, a.password_hash) ? a.id : null;
}

export async function createSession(db: Database, accountId: string): Promise<string> {
  const token = randomUUID() + randomUUID();
  await db.query(`INSERT INTO session (token,account_id) VALUES ($1,$2)`, [token, accountId]);
  return token;
}
export async function sessionAccount(db: Database, token: string | undefined): Promise<Account | null> {
  if (!token) return null;
  const r = (await db.query<any>(`SELECT a.id, a.email, a.display_name FROM session s JOIN account a ON a.id=s.account_id WHERE s.token=$1`, [token])).rows[0];
  return r ? { id: r.id, email: r.email, displayName: r.display_name } : null;
}
export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.query(`DELETE FROM session WHERE token=$1`, [token]);
}

export async function fanForAccount(db: Database, accountId: string): Promise<string | null> {
  return (await db.query<{ id: string }>(`SELECT id FROM fan WHERE account_id=$1 LIMIT 1`, [accountId])).rows[0]?.id ?? null;
}

// --- password reset --------------------------------------------------------
// Create a single-use, 1-hour token for an email. Returns the *raw* token to put
// in the link (only its hash is stored). Returns null if no such account — the
// caller still shows a generic "if that email exists…" message (no enumeration).
export async function createPasswordReset(db: Database, email: string, ttlMs = 3600_000): Promise<string | null> {
  const acc = (await db.query<{ id: string }>(`SELECT id FROM account WHERE email=$1`, [email.toLowerCase().trim()])).rows[0];
  if (!acc) return null;
  const token = randomUUID() + randomUUID();
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await db.query(`INSERT INTO password_reset (token_hash,account_id,expires_at) VALUES ($1,$2,$3)`, [sha256(token), acc.id, expires]);
  return token;
}
// Consume a token: set the new password if the token is valid, unexpired and
// unused. Single-use (marks used_at) and invalidates all sessions for safety.
export async function resetPassword(db: Database, token: string, newPw: string): Promise<boolean> {
  if (!token || !newPw) return false;
  const row = (await db.query<{ account_id: string }>(
    `SELECT account_id FROM password_reset WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token)])).rows[0];
  if (!row) return false;
  await db.query(`UPDATE account SET password_hash=$2 WHERE id=$1`, [row.account_id, hashPw(newPw)]);
  await db.query(`UPDATE password_reset SET used_at=now() WHERE token_hash=$1`, [sha256(token)]);
  await db.query(`DELETE FROM session WHERE account_id=$1`, [row.account_id]); // force re-login everywhere
  return true;
}

// --- ownership ------------------------------------------------------------
export async function grantOwnership(db: Database, accountId: string, kind: string, id: string, role = 'owner'): Promise<void> {
  await db.query(`INSERT INTO ownership (account_id,owner_kind,owner_id,role) VALUES ($1,$2,$3,$4) ON CONFLICT (account_id,owner_kind,owner_id) DO NOTHING`, [accountId, kind, id, role]);
}
export async function owns(db: Database, accountId: string | null, kind: string, id: string): Promise<boolean> {
  if (!accountId || !kind || !id) return false;   // host-less events / empty kind → not owned (avoids enum error)
  // an athlete is owned by the account that self-created it, too
  const direct = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM ownership WHERE account_id=$1 AND owner_kind=$2 AND owner_id=$3`, [accountId, kind, id])).rows[0].n;
  if (direct) return true;
  if (kind === 'athlete') {
    const a = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM athlete WHERE id=$2 AND account_id=$1`, [accountId, id])).rows[0].n;
    return a > 0;
  }
  return false;
}
export async function ownedEntities(db: Database, accountId: string | null): Promise<{ kind: string; id: string; name: string }[]> {
  if (!accountId) return [];
  const rows = (await db.query<any>(`SELECT owner_kind kind, owner_id id FROM ownership WHERE account_id=$1`, [accountId])).rows;
  const out: { kind: string; id: string; name: string }[] = [];
  for (const r of rows) {
    const tbl = r.kind === 'athlete' ? 'athlete' : r.kind === 'association' ? 'association' : r.kind === 'team' ? 'team' : 'club';
    const col = r.kind === 'athlete' ? 'display_name' : 'name';
    const nm = (await db.query<any>(`SELECT ${col} n FROM ${tbl} WHERE id=$1`, [r.id])).rows[0]?.n ?? 'Entity';
    out.push({ kind: r.kind, id: r.id, name: nm });
  }
  return out;
}
