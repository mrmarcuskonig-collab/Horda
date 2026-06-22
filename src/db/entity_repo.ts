// entity_repo.ts — non-person entities (club / team / association): branding,
// the relationships that populate their "members" lists, and matchday fixtures.
import type { Database } from './index.ts';

export interface Branding { tagline: string | null; avatarUrl: string | null; bannerUrl: string | null; links: Record<string, string> }

export async function setBranding(db: Database, type: 'club' | 'team' | 'association', id: string, b: { tagline?: string; avatarUrl?: string; bannerUrl?: string; links?: Record<string, string> }): Promise<void> {
  await db.query(
    `INSERT INTO entity_branding (entity_type,entity_id,tagline,avatar_url,banner_url,links)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (entity_type,entity_id) DO UPDATE SET tagline=excluded.tagline, avatar_url=excluded.avatar_url, banner_url=excluded.banner_url, links=excluded.links`,
    [type, id, b.tagline ?? null, b.avatarUrl ?? null, b.bannerUrl ?? null, JSON.stringify(b.links ?? {})]);
}
export async function getBranding(db: Database, type: string, id: string): Promise<Branding> {
  const r = (await db.query<any>(`SELECT tagline, avatar_url, banner_url, links FROM entity_branding WHERE entity_type=$1 AND entity_id=$2`, [type, id])).rows[0];
  return r ? { tagline: r.tagline, avatarUrl: r.avatar_url, bannerUrl: r.banner_url, links: r.links ?? {} } : { tagline: null, avatarUrl: null, bannerUrl: null, links: {} };
}

export async function getClub(db: Database, id: string) { return (await db.query<any>(`SELECT id,name FROM club WHERE id=$1`, [id])).rows[0]; }
export async function getTeamsOfClub(db: Database, clubId: string) {
  return (await db.query<any>(`SELECT t.id, t.name, t.division, t.gender, s.name sport FROM team t JOIN sport s ON s.id=t.sport_id WHERE t.club_id=$1 ORDER BY t.name`, [clubId])).rows;
}
export async function getTeam(db: Database, id: string) {
  return (await db.query<any>(`SELECT t.id, t.name, t.division, t.gender, t.club_id, c.name club_name, s.name sport FROM team t JOIN club c ON c.id=t.club_id JOIN sport s ON s.id=t.sport_id WHERE t.id=$1`, [id])).rows[0];
}
export async function getRoster(db: Database, teamId: string) {
  return (await db.query<any>(`SELECT a.id, a.display_name name, a.handle FROM roster r JOIN athlete a ON a.id=r.athlete_id WHERE r.team_id=$1 ORDER BY a.display_name`, [teamId])).rows;
}
export async function getAssociation(db: Database, id: string) { return (await db.query<any>(`SELECT id,name FROM association WHERE id=$1`, [id])).rows[0]; }
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
