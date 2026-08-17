// entity_repo.ts — non-person entities (club / team / association): branding,
// the relationships that populate their "members" lists, and matchday fixtures.
import type { Database } from './index.ts';
import { grantOwnership } from './auth_repo.ts';

// A page you might find when setting up: an existing club or federation. Carries
// its logo (for the "this really exists" cue) and whether it's still CLAIMABLE
// (unclaimed + nobody owns it) vs. already on Horda (claimed / owned).
export interface ClaimTarget { kind: 'club' | 'association'; id: string; name: string; avatarUrl: string | null; claimable: boolean }

// Real-time "find your page" search across the org entities a person can run.
// Union of club + association, name-prefix/substring, logo joined, ownership
// checked so the UI can show Claim (claimable) vs. On Horda (taken).
export async function searchClaimTargets(db: Database, q: string, limit = 8): Promise<ClaimTarget[]> {
  const like = '%' + q.toLowerCase().trim() + '%';
  const rows = (await db.query<any>(
    `SELECT kind, id, name, avatar_url,
            (claim_status <> 'claimed' AND NOT owned) AS claimable
       FROM (
         SELECT 'club' kind, c.id, c.name, c.claim_status::text claim_status, b.avatar_url,
                EXISTS(SELECT 1 FROM ownership o WHERE o.owner_kind='club' AND o.owner_id=c.id) owned
           FROM club c LEFT JOIN entity_branding b ON b.entity_type='club' AND b.entity_id=c.id
          WHERE lower(c.name) LIKE $1
         UNION ALL
         SELECT 'association' kind, a.id, a.name, a.claim_status::text, b.avatar_url,
                EXISTS(SELECT 1 FROM ownership o WHERE o.owner_kind='association' AND o.owner_id=a.id) owned
           FROM association a LEFT JOIN entity_branding b ON b.entity_type='association' AND b.entity_id=a.id
          WHERE lower(a.name) LIKE $1
       ) u
      ORDER BY name LIMIT $2`, [like, limit])).rows;
  return rows.map(r => ({ kind: r.kind, id: r.id, name: r.name, avatarUrl: r.avatar_url ?? null, claimable: !!r.claimable }));
}

// Create a brand-new org page FROM SCRATCH, owned by the creator instantly —
// this is the "Create" path (vs. claiming someone else's existing page, which
// still goes through verification). `claim_status='claimed'` + an ownership row
// mean the creator immediately has owner tools. `kind` is whitelisted so the
// table name is never attacker-controlled.
export async function createOwnedEntity(db: Database, accountId: string, kind: 'club' | 'association', name: string): Promise<string> {
  const tbl = kind === 'association' ? 'association' : 'club';
  const id = (await db.query<{ id: string }>(
    `INSERT INTO ${tbl} (name, source, claim_status) VALUES ($1,'native','claimed') RETURNING id`, [name.trim()])).rows[0].id;
  await grantOwnership(db, accountId, kind, id);
  return id;
}

// tagline = the one-line about that sits beside the name; description = the
// longer body underneath it. Both owner-written, both optional.
export interface Branding { tagline: string | null; description: string | null; avatarUrl: string | null; bannerUrl: string | null; links: Record<string, string> }

export async function setBranding(db: Database, type: 'club' | 'team' | 'association', id: string, b: { tagline?: string; description?: string; avatarUrl?: string; bannerUrl?: string; links?: Record<string, string> }): Promise<void> {
  await db.query(
    `INSERT INTO entity_branding (entity_type,entity_id,tagline,description,avatar_url,banner_url,links)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (entity_type,entity_id) DO UPDATE SET tagline=excluded.tagline, description=excluded.description, avatar_url=excluded.avatar_url, banner_url=excluded.banner_url, links=excluded.links`,
    [type, id, b.tagline ?? null, b.description ?? null, b.avatarUrl ?? null, b.bannerUrl ?? null, JSON.stringify(b.links ?? {})]);
}
export async function getBranding(db: Database, type: string, id: string): Promise<Branding> {
  const r = (await db.query<any>(`SELECT tagline, description, avatar_url, banner_url, links FROM entity_branding WHERE entity_type=$1 AND entity_id=$2`, [type, id])).rows[0];
  return r ? { tagline: r.tagline, description: r.description ?? null, avatarUrl: r.avatar_url, bannerUrl: r.banner_url, links: r.links ?? {} } : { tagline: null, description: null, avatarUrl: null, bannerUrl: null, links: {} };
}

// Rename a club/team/association. The display name lives on the entity's own
// table (unlike branding, which is in entity_branding), so it's a plain update.
export async function updateEntityName(db: Database, type: 'club' | 'team' | 'association', id: string, name: string): Promise<void> {
  const n = (name || '').trim().slice(0, 80);
  if (n) await db.query(`UPDATE ${type} SET name=$2 WHERE id=$1`, [id, n]);
}
export async function getClub(db: Database, id: string) { return (await db.query<any>(`SELECT id,name,handle FROM club WHERE id=$1`, [id])).rows[0]; }
export async function getTeamsOfClub(db: Database, clubId: string) {
  return (await db.query<any>(`SELECT t.id, t.name, t.division, t.gender, s.name sport FROM team t JOIN sport s ON s.id=t.sport_id WHERE t.club_id=$1 ORDER BY t.name`, [clubId])).rows;
}
export async function getTeam(db: Database, id: string) {
  return (await db.query<any>(`SELECT t.id, t.name, t.handle, t.division, t.gender, t.club_id, c.name club_name, s.name sport FROM team t JOIN club c ON c.id=t.club_id JOIN sport s ON s.id=t.sport_id WHERE t.id=$1`, [id])).rows[0];
}
export async function getRoster(db: Database, teamId: string) {
  return (await db.query<any>(`SELECT a.id, a.display_name name, a.handle FROM roster r JOIN athlete a ON a.id=r.athlete_id WHERE r.team_id=$1 ORDER BY a.display_name`, [teamId])).rows;
}
export async function getAssociation(db: Database, id: string) { return (await db.query<any>(`SELECT id,name,handle FROM association WHERE id=$1`, [id])).rows[0]; }
export async function getAssociationLeagues(db: Database, id: string) {
  return (await db.query<any>(`SELECT id,name FROM league WHERE association_id=$1 ORDER BY name`, [id])).rows;
}
export async function getAssociationClubs(db: Database, id: string) {
  return (await db.query<any>(
    `SELECT DISTINCT c.id, c.name FROM club c JOIN team t ON t.club_id=c.id
       JOIN league_member lm ON lm.member_type='team' AND lm.member_id=t.id
       JOIN league l ON l.id=lm.league_id WHERE l.association_id=$1 ORDER BY c.name`, [id])).rows;
}

// matchday fixture for a team (the next unplayed event it's in)
export async function getNextFixtureForTeam(db: Database, teamId: string) {
  const r = (await db.query<any>(
    `SELECT e.id event_id, to_char(e.starts_at,'YYYY-MM-DD') date, e.spectator_access access, e.ticket_url, e.stream_url,
            (SELECT t2.name FROM event_participant ep2 JOIN team t2 ON t2.id=ep2.participant_id WHERE ep2.event_id=e.id AND ep2.participant_id<>$1 LIMIT 1) opp
     FROM event e JOIN event_participant ep ON ep.event_id=e.id
     WHERE ep.participant_id=$1 AND NOT EXISTS (SELECT 1 FROM result r WHERE r.event_id=e.id)
     ORDER BY e.starts_at LIMIT 1`, [teamId])).rows[0];
  return r ? { eventId: r.event_id, date: r.date ?? undefined, opp: r.opp ?? 'TBA', access: r.access, ticketUrl: r.ticket_url ?? null, streamUrl: r.stream_url ?? null } : null;
}

// --- seed helpers (used to wire the demo world) --------------------------
export async function addToTeam(db: Database, athleteId: string, teamId: string): Promise<void> {
  await db.query(`INSERT INTO relationship_link (kind,a_type,a_id,b_type,b_id,policy) VALUES ('roster_membership','athlete',$1,'team',$2,'open_join')`, [athleteId, teamId]);
}
export async function createLeague(db: Database, name: string, sportId: string, variantId: string, associationId: string): Promise<string> {
  return (await db.query<{ id: string }>(
    `INSERT INTO league (name,sport_id,variant_id,creator_type,association_id,membership_policy) VALUES ($1,$2,$3,'association',$4,'open_join') RETURNING id`,
    [name, sportId, variantId, associationId])).rows[0].id;
}
export async function createAssociation(db: Database, key: string, name: string): Promise<string> {
  return (await db.query<{ id: string }>(`INSERT INTO association (key,name) VALUES ($1,$2) RETURNING id`, [key, name])).rows[0].id;
}
export async function assignTeamToLeague(db: Database, teamId: string, leagueId: string): Promise<void> {
  await db.query(`INSERT INTO relationship_link (kind,a_type,a_id,b_type,b_id,policy) VALUES ('league_assignment','team',$1,'league',$2,'open_join')`, [teamId, leagueId]);
}
