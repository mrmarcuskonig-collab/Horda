// coorg_repo.ts — co-organizer invites for the "other side" of an event.
//
// The organizer (and only the organizer) invites a rival side via a private
// link. The invitee opens it, authenticates (name+email → account), and becomes
// a CO-ORGANIZER: limited rights (add side events, share a promo link), never
// edit rights on the main event. See 0045_coorganizer.sql.
import { randomBytes } from 'node:crypto';
import type { Database } from './index.ts';

export interface SideInvite {
  partyId: string; eventId: string; eventTitle: string; side: string | null;
  placeholder: string | null; status: string; claimedByAccountId: string | null;
}

/**
 * Organizer creates an invitable side. Returns the private invite token (the
 * link the organizer sends) and the promo token (the invitee's share link once
 * they accept). role='side', status='invited' until accepted.
 */
export async function createSideInvite(db: Database, o: { eventId: string; side?: string | null; placeholder: string }): Promise<{ partyId: string; inviteToken: string; promoToken: string }> {
  const invite = 'i' + randomBytes(12).toString('hex');
  const promo = 'p' + randomBytes(8).toString('hex');
  const r = (await db.query<{ id: string }>(
    `INSERT INTO event_party (event_id, role, side, placeholder, status, kind, promo_token, invite_token)
     VALUES ($1,'side',$2,$3,'invited','auto',$4,$5) RETURNING id`,
    [o.eventId, o.side ?? null, o.placeholder, promo, invite])).rows[0];
  return { partyId: r.id, inviteToken: invite, promoToken: promo };
}

/**
 * Turn an EXISTING side placeholder (the auto A/B slots created with the event)
 * into an invitable one — the common path. Idempotent: returns the existing
 * token if one was already minted. Only touches a party that isn't already
 * claimed by a real account.
 */
export async function ensureSideInvite(db: Database, partyId: string): Promise<string | null> {
  const row = (await db.query<{ invite_token: string | null; status: string }>(
    `SELECT invite_token, status FROM event_party WHERE id=$1`, [partyId])).rows[0];
  if (!row) return null;
  if (row.status === 'claimed') return row.invite_token;   // already accepted — link still resolves
  if (row.invite_token) return row.invite_token;
  const token = 'i' + randomBytes(12).toString('hex');
  await db.query(`UPDATE event_party SET invite_token=$2, status='invited' WHERE id=$1`, [partyId, token]);
  return token;
}

/** Resolve an invite token to its side + event. */
export async function sideInviteByToken(db: Database, token: string): Promise<SideInvite | null> {
  const r = (await db.query<any>(
    `SELECT p.id, p.event_id, p.side, p.placeholder, p.status, p.claimed_by_account_id, e.name title
       FROM event_party p JOIN event e ON e.id=p.event_id
      WHERE p.invite_token=$1`, [token])).rows[0];
  if (!r) return null;
  return { partyId: r.id, eventId: r.event_id, eventTitle: r.title, side: r.side ?? null, placeholder: r.placeholder ?? null, status: r.status, claimedByAccountId: r.claimed_by_account_id ?? null };
}

/**
 * Accept an invite: mark the side claimed by this account and grant co-organizer
 * rights. Optionally the invitee represents a page they manage (as_entity_*).
 * Idempotent-safe: a second accept of an already-claimed invite is a no-op that
 * still returns the event (so the invitee just lands on the event).
 */
export async function acceptSideInvite(db: Database, o: { token: string; accountId: string; asEntityKind?: string | null; asEntityId?: string | null }): Promise<{ eventId: string; partyId: string } | null> {
  const inv = await sideInviteByToken(db, o.token);
  if (!inv) return null;
  // First accept wins; a later different account can't hijack a claimed side.
  if (inv.status !== 'claimed') {
    await db.query(
      `UPDATE event_party
          SET status='claimed', claimed_by_account_id=$2,
              entity_kind=$3::text, entity_id=$4::text,
              placeholder = CASE WHEN $4::text IS NULL THEN placeholder ELSE NULL END
        WHERE id=$1 AND status <> 'claimed'`,
      [inv.partyId, o.accountId, o.asEntityKind ?? null, o.asEntityId ?? null]);
  }
  await db.query(
    `INSERT INTO event_coorganizer (event_id, account_id, party_id, as_entity_kind, as_entity_id)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (event_id, account_id) DO NOTHING`,
    [inv.eventId, o.accountId, inv.partyId, o.asEntityKind ?? null, o.asEntityId ?? null]);
  return { eventId: inv.eventId, partyId: inv.partyId };
}

/** Is this account a co-organizer of the event? (add side events, share promo — never edit the main event) */
export async function isCoOrganizer(db: Database, eventId: string, accountId: string | null): Promise<boolean> {
  if (!accountId) return false;
  return (await db.query(`SELECT 1 FROM event_coorganizer WHERE event_id=$1 AND account_id=$2`, [eventId, accountId])).rows.length > 0;
}

export interface CoOrg { accountId: string; asEntityKind: string | null; asEntityId: string | null; partyId: string | null; }
export async function eventCoorganizers(db: Database, eventId: string): Promise<CoOrg[]> {
  return (await db.query<any>(
    `SELECT account_id, as_entity_kind, as_entity_id, party_id FROM event_coorganizer WHERE event_id=$1 ORDER BY created_at`, [eventId])).rows
    .map(r => ({ accountId: r.account_id, asEntityKind: r.as_entity_kind ?? null, asEntityId: r.as_entity_id ?? null, partyId: r.party_id ?? null }));
}

/** The co-organizer's own side party (carries the promo_token = their share link). */
export async function coOrgParty(db: Database, eventId: string, accountId: string): Promise<{ partyId: string; promoToken: string } | null> {
  const r = (await db.query<{ party_id: string | null; promo_token: string | null }>(
    `SELECT co.party_id, p.promo_token
       FROM event_coorganizer co LEFT JOIN event_party p ON p.id=co.party_id
      WHERE co.event_id=$1 AND co.account_id=$2`, [eventId, accountId])).rows[0];
  if (!r || !r.party_id) return null;
  return { partyId: r.party_id, promoToken: r.promo_token ?? '' };
}

/** Events this account co-organizes (for "You're co-organizing" on their surfaces). */
export async function coOrganizedEventIds(db: Database, accountId: string): Promise<string[]> {
  return (await db.query<{ event_id: string }>(`SELECT event_id FROM event_coorganizer WHERE account_id=$1`, [accountId])).rows.map(r => r.event_id);
}

export interface OrganizedRow { eventId: string; title: string; date: string | null; startsAt: string | null; hostKind: string | null; hostId: string | null; role: 'organizer' | 'co-organizer'; }
/**
 * The upcoming events this account ORGANISES — as the main organiser (hosts via
 * an owned entity) or as a co-organiser. Soonest first (left → right). `ownerKeys`
 * are the account's owned entities as "kind:id" strings; `coOrgIds` are event ids
 * they co-organise.
 */
export async function organizedUpcoming(db: Database, ownerKeys: string[], coOrgIds: string[], limit = 20): Promise<OrganizedRow[]> {
  if (!ownerKeys.length && !coOrgIds.length) return [];
  const rows = (await db.query<any>(
    `SELECT e.id, e.name title,
            to_char(e.starts_at AT TIME ZONE COALESCE(e.timezone,'UTC'),'Dy DD Mon') date,
            e.starts_at, e.host_kind, e.host_id,
            ((e.host_kind || ':' || e.host_id::text) = ANY($1::text[])) AS owned
       FROM event e
      WHERE (e.starts_at IS NULL OR now() < COALESCE(e.ends_at, e.starts_at + interval '3 hours'))
        AND e.parent_event_id IS NULL
        AND ( (e.host_kind || ':' || e.host_id::text) = ANY($1::text[]) OR e.id = ANY($2::uuid[]) )
      ORDER BY e.starts_at ASC NULLS LAST
      LIMIT $3`, [ownerKeys, coOrgIds, limit])).rows;
  return rows.map(r => ({ eventId: r.id, title: r.title, date: r.date ?? null, startsAt: r.starts_at ?? null, hostKind: r.host_kind ?? null, hostId: r.host_id ?? null, role: r.owned ? 'organizer' : 'co-organizer' }));
}
