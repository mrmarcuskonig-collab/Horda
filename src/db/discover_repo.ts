// discover_repo.ts — data for the public start screen. Real coverage, filterable
// by sport + region. Everything here is public (browse first; act = sign up).
import type { Database } from './index.ts';
import { hostName } from './events_repo.ts';

export const REGIONS = ['Berlin', 'Hamburg', 'Cologne', 'Bavaria'];

export interface Discover {
  sports: { key: string; name: string }[];
  athletes: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; banner: string | null; verified: boolean }[];
  clubs: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; verified: boolean }[];
  upcoming: { id: string; title: string; date?: string; host: string; admission: string }[];
  results: { headline: string; date?: string }[];
}

export async function getDiscover(db: Database, filter: { sport?: string; region?: string }): Promise<Discover> {
  const sports = (await db.query<any>(`SELECT key, name FROM sport WHERE is_live ORDER BY display_order`)).rows;

  const athleteRows = (await db.query<any>(
    `SELECT a.id, a.display_name name, a.region, a.avatar_url avatar, a.banner_url banner,
            (a.account_id IS NOT NULL OR EXISTS (SELECT 1 FROM ownership o WHERE o.owner_kind='athlete' AND o.owner_id=a.id)) verified,
            (SELECT s.key FROM event e JOIN event_participant ep ON ep.event_id=e.id JOIN sport s ON s.id=e.sport_id WHERE ep.participant_id=a.id LIMIT 1) sport
     FROM athlete a
     WHERE
        -- §1b: self-serve creators pending light verification aren't in Featured yet
        NOT EXISTS (SELECT 1 FROM account ac WHERE ac.id=a.account_id AND ac.creator_verified=false)
        AND (
          EXISTS (SELECT 1 FROM post p WHERE p.author_type='athlete' AND p.author_id=a.id)
          OR EXISTS (SELECT 1 FROM result r WHERE r.participant_id=a.id)
          OR EXISTS (SELECT 1 FROM event_participant ep WHERE ep.participant_id=a.id)
          OR EXISTS (SELECT 1 FROM membership_tier mt WHERE mt.owner_kind='athlete' AND mt.owner_id=a.id)
        )
     ORDER BY a.display_name`)).rows;

  const clubRows = (await db.query<any>(
    `SELECT c.id, c.name, c.region,
            (SELECT s.key FROM team t JOIN sport s ON s.id=t.sport_id WHERE t.club_id=c.id LIMIT 1) sport,
            (SELECT eb.avatar_url FROM entity_branding eb WHERE eb.entity_type='club' AND eb.entity_id=c.id) avatar,
            EXISTS (SELECT 1 FROM ownership o WHERE o.owner_kind='club' AND o.owner_id=c.id) verified
     FROM club c ORDER BY c.name`)).rows;

  // location is free-text now (any city/region worldwide) → match case-insensitively
  // and as a partial, so "berlin", "Berlin", or "berl" all hit the Berlin coverage.
  const reg = filter.region?.trim().toLowerCase();
  const matches = (row: any) => (!filter.sport || row.sport === filter.sport)
    && (!reg || (row.region && row.region.toLowerCase().includes(reg)));

  const evRows = (await db.query<any>(
    `SELECT e.id, e.name title, to_char(e.starts_at,'DD Mon') date, e.host_kind, e.host_id, e.admission
     FROM event e WHERE e.host_kind IS NOT NULL ORDER BY e.starts_at LIMIT 8`)).rows;
  const upcoming = [];
  for (const e of evRows) upcoming.push({ id: e.id, title: e.title, date: e.date ?? undefined, host: await hostName(db, e.host_kind, e.host_id), admission: e.admission });

  const results = (await db.query<any>(
    `SELECT DISTINCT r.headline, to_char(e.starts_at,'DD Mon') date FROM result r JOIN event e ON e.id=r.event_id
     ORDER BY 2 DESC NULLS LAST LIMIT 6`)).rows.map(r => ({ headline: r.headline, date: r.date ?? undefined }));

  return {
    sports,
    athletes: athleteRows.filter(matches).map(a => ({ id: a.id, name: a.name, region: a.region, sport: a.sport, avatar: a.avatar ?? null, banner: a.banner ?? null, verified: !!a.verified })),
    clubs: clubRows.filter(matches).map(c => ({ id: c.id, name: c.name, region: c.region, sport: c.sport, avatar: c.avatar ?? null, verified: !!c.verified })),
    upcoming, results,
  };
}
