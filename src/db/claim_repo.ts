// claim_repo.ts — claim verification.
// Owning a Horda page is a privileged act, so it is gated. A claim is a request
// that becomes ownership only when verified. Verification paths, strongest first:
//   email_domain      — claimant email domain == the entity's official site  → auto
//   channel_code       — a one-time code placed on the official site, re-checked → auto
//   association_vouch  — the governing association's owner approves a member  → review
//   admin_grant        — the platform admin approves anything else            → review
// This is cheap to add now and expensive to retrofit once strangers self-serve.
import { randomBytes } from 'node:crypto';
import type { Database } from './index.ts';
import { grantOwnership, owns } from './auth_repo.ts';

export type ClaimKind = 'athlete' | 'club' | 'team' | 'association';
type Acct = { id: string; email: string; isAdmin?: boolean };

// --- official-channel helpers ---------------------------------------------
// reduce any URL/handle to a bare host: "https://www.FcBeispiel.de/x" -> "fcbeispiel.de"
export function domainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  s = s.split(/[/?#]/)[0];
  return s || null;
}

async function officialLinks(db: Database, kind: ClaimKind, id: string): Promise<Record<string, string>> {
  if (kind === 'athlete') {
    const r = (await db.query<any>(`SELECT links FROM athlete WHERE id=$1`, [id])).rows[0];
    return r?.links ?? {};
  }
  const r = (await db.query<any>(`SELECT links FROM entity_branding WHERE entity_type=$1 AND entity_id=$2`, [kind, id])).rows[0];
  return r?.links ?? {};
}
async function officialSiteUrl(db: Database, kind: ClaimKind, id: string): Promise<string | null> {
  const links = await officialLinks(db, kind, id);
  return links.website || links.site || null;
}
export async function officialDomain(db: Database, kind: ClaimKind, id: string): Promise<string | null> {
  return domainOf(await officialSiteUrl(db, kind, id));
}

async function markClaimed(db: Database, kind: ClaimKind, id: string): Promise<void> {
  if (kind === 'athlete') return; // athlete ownership is tracked via ownership/account_id
  const tbl = kind === 'association' ? 'association' : kind === 'team' ? 'team' : 'club';
  await db.query(`UPDATE ${tbl} SET claim_status='claimed' WHERE id=$1`, [id]);
}

async function settle(db: Database, claimId: string, accountId: string, kind: ClaimKind, id: string, method: string, deciderId?: string): Promise<void> {
  await grantOwnership(db, accountId, kind, id);
  await markClaimed(db, kind, id);
  await db.query(
    `UPDATE claim_request SET status='verified', method=$2::claim_method, decided_by=$3, decided_at=now() WHERE id=$1`,
    [claimId, method, deciderId ?? null]);
}

// --- who governs a club/team (for association vouching) --------------------
export async function governingAssociationIds(db: Database, kind: ClaimKind, id: string): Promise<string[]> {
  if (kind !== 'club' && kind !== 'team') return [];
  const where = kind === 'club' ? 't.club_id=$1' : 't.id=$1';
  const rows = (await db.query<{ association_id: string }>(
    `SELECT DISTINCT l.association_id FROM team t
       JOIN league_member lm ON lm.member_type='team' AND lm.member_id=t.id
       JOIN league l ON l.id=lm.league_id
      WHERE ${where} AND l.association_id IS NOT NULL`, [id])).rows;
  return rows.map(r => r.association_id);
}

async function canReview(db: Database, decider: Acct, claim: { target_kind: ClaimKind; target_id: string }): Promise<boolean> {
  if (decider.isAdmin) return true;
  const assocs = await governingAssociationIds(db, claim.target_kind, claim.target_id);
  for (const a of assocs) if (await owns(db, decider.id, 'association', a)) return true;
  return false;
}

// --- the claim lifecycle ---------------------------------------------------
export interface ClaimResult { status: 'verified' | 'pending'; method: string; code?: string; reason?: string }

export async function requestClaim(db: Database, account: Acct, kind: ClaimKind, id: string): Promise<ClaimResult> {
  if (await owns(db, account.id, kind, id)) return { status: 'verified', method: 'owner', reason: 'already-owner' };

  // 1) email-domain auto-verification
  const site = await officialDomain(db, kind, id);
  const emailDomain = domainOf(account.email.split('@')[1]);
  if (site && emailDomain && site === emailDomain) {
    const claimId = await upsertClaim(db, account.id, kind, id, 'email_domain');
    await settle(db, claimId, account.id, kind, id, 'email_domain');
    return { status: 'verified', method: 'email_domain' };
  }

  // 2) otherwise open (or refresh) a pending request with a one-time channel code
  const claimId = await upsertClaim(db, account.id, kind, id, 'channel_code');
  const code = (await db.query<{ channel_code: string }>(`SELECT channel_code FROM claim_request WHERE id=$1`, [claimId])).rows[0].channel_code;
  return { status: 'pending', method: 'channel_code', code };
}

async function upsertClaim(db: Database, accountId: string, kind: ClaimKind, id: string, method: string): Promise<string> {
  const code = 'horda-verify-' + randomBytes(5).toString('hex');
  const r = (await db.query<{ id: string }>(
    `INSERT INTO claim_request (account_id,target_kind,target_id,method,status,channel_code)
       VALUES ($1,$2,$3,$4::claim_method,'pending',$5)
     ON CONFLICT (account_id,target_kind,target_id)
       DO UPDATE SET method=excluded.method,
                     channel_code=COALESCE(claim_request.channel_code, excluded.channel_code)
     RETURNING id`, [accountId, kind, id, method, code])).rows[0];
  return r.id;
}

// channel_code: claimant placed the code on their official site; re-check it.
// fetcher is injectable so this is testable without real network access.
export async function verifyByChannelCode(
  db: Database, claimId: string,
  fetcher: (url: string) => Promise<string> = defaultFetch,
): Promise<boolean> {
  const c = (await db.query<any>(`SELECT * FROM claim_request WHERE id=$1 AND status='pending'`, [claimId])).rows[0];
  if (!c || !c.channel_code) return false;
  const url = await officialSiteUrl(db, c.target_kind, c.target_id);
  if (!url) return false;
  let body = '';
  try { body = await fetcher(url.startsWith('http') ? url : 'https://' + url); } catch { return false; }
  if (!body.includes(c.channel_code)) return false;
  await settle(db, claimId, c.account_id, c.target_kind, c.target_id, 'channel_code');
  return true;
}
async function defaultFetch(url: string): Promise<string> {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
  return await r.text();
}

// --- review queue ----------------------------------------------------------
export interface ClaimView {
  id: string; accountEmail: string; targetKind: ClaimKind; targetId: string; targetName: string;
  method: string; status: string; channelCode: string | null; createdAt: string;
}
async function targetName(db: Database, kind: ClaimKind, id: string): Promise<string> {
  const tbl = kind === 'athlete' ? 'athlete' : kind === 'association' ? 'association' : kind === 'team' ? 'team' : 'club';
  const col = kind === 'athlete' ? 'display_name' : 'name';
  return (await db.query<any>(`SELECT ${col} n FROM ${tbl} WHERE id=$1`, [id])).rows[0]?.n ?? 'Entity';
}

export async function listClaimsForReviewer(db: Database, decider: Acct): Promise<ClaimView[]> {
  const rows = (await db.query<any>(
    `SELECT cr.id, a.email, cr.target_kind, cr.target_id, cr.method, cr.status, cr.channel_code,
            to_char(cr.created_at,'YYYY-MM-DD') created
       FROM claim_request cr JOIN account a ON a.id=cr.account_id
      WHERE cr.status='pending' ORDER BY cr.created_at`)).rows;
  const out: ClaimView[] = [];
  for (const r of rows) {
    const claim = { target_kind: r.target_kind as ClaimKind, target_id: r.target_id };
    if (!(await canReview(db, decider, claim))) continue;
    out.push({
      id: r.id, accountEmail: r.email, targetKind: r.target_kind, targetId: r.target_id,
      targetName: await targetName(db, r.target_kind, r.target_id),
      method: r.method, status: r.status, channelCode: r.channel_code, createdAt: r.created,
    });
  }
  return out;
}

export async function decideClaim(db: Database, claimId: string, decider: Acct, approve: boolean): Promise<boolean> {
  const c = (await db.query<any>(`SELECT * FROM claim_request WHERE id=$1 AND status='pending'`, [claimId])).rows[0];
  if (!c) return false;
  const claim = { target_kind: c.target_kind as ClaimKind, target_id: c.target_id };
  if (!(await canReview(db, decider, claim))) return false;
  if (approve) {
    const method = decider.isAdmin && (claim.target_kind === 'athlete' || claim.target_kind === 'association')
      ? 'admin_grant'
      : (await governingAssociationIds(db, claim.target_kind, claim.target_id)).length && !decider.isAdmin
        ? 'association_vouch' : 'admin_grant';
    await settle(db, claimId, c.account_id, claim.target_kind, claim.target_id, method, decider.id);
  } else {
    await db.query(`UPDATE claim_request SET status='rejected', decided_by=$2, decided_at=now() WHERE id=$1`, [claimId, decider.id]);
  }
  return true;
}

// for showing claim state on the entity page
export async function getClaimFor(db: Database, accountId: string, kind: ClaimKind, id: string): Promise<{ status: string; method: string; channelCode: string | null } | null> {
  const r = (await db.query<any>(
    `SELECT status, method, channel_code FROM claim_request WHERE account_id=$1 AND target_kind=$2 AND target_id=$3`,
    [accountId, kind, id])).rows[0];
  return r ? { status: r.status, method: r.method, channelCode: r.channel_code } : null;
}
export async function isAdmin(db: Database, accountId: string | null): Promise<boolean> {
  if (!accountId) return false;
  return (await db.query<{ is_admin: boolean }>(`SELECT is_admin FROM account WHERE id=$1`, [accountId])).rows[0]?.is_admin ?? false;
}
