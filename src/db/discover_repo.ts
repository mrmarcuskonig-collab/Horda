// discover_repo.ts — data for the public start screen. Real coverage, filterable
// by sport + region. Everything here is public (browse first; act = sign up).
import type { Database } from './index.ts';
import { hostName } from './events_repo.ts';

export const REGIONS = ['Berlin', 'Hamburg', 'Cologne', 'Bavaria'];

export interface Discover {
  sports: { key: string; name: string }[];
  athletes: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; banner: string | null; verified: boolean }[];
  clubs: { id: string; name: string; region: string | null; sport: string | null; avatar: string | null; verified: boolean }[];
  upcoming: { id: string; title: string; date?: string; host: string; admission: string; going: number; shares: number; followers: number; live: boolean; coverUrl: string | null }[];
  results: { headline: string; date?: string }[];
}

// TikTok-style engagement counts for a single event card: people attending
// (claims), shares (share analytics), and the host's follower count. Cheap —
// only the ≤8 discover events call this. All three are real, from live tables.
async function eventStats(db: Database, e: { id: string; host_kind: string; host_id: string }): Promise<{ going: number; shares: number; followers: number }> {
  // "Going" must match what the event page header shows: claim-rail attendees
  // (SUM of party_size for live claims) PLUS RSVP 'going' attendees. Counting
  // only claims made the card read 0 for RSVP events; counting only attendance
  // made it read 0 for ticketed ones. An event uses one rail or the other, so
  // summing both is correct and never double-counts.
  const claimGoing = (await db.query<{ n: number }>(
    `SELECT COALESCE(SUM(party_size),0)::int n FROM claim
     WHERE event_id=$1 AND status IN ('claimed','approved','verified') AND voided_at IS NULL`, [e.id])).rows[0]?.n ?? 0;
  const rsvpGoing = (await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM attendance WHERE event_id=$1 AND mode='going' AND status <> 'pending'`, [e.id])).rows[0]?.n ?? 0;
  const going = claimGoing + rsvpGoing;
  // Shares = distinct sharers (an anonymous share counts once). Counting every
  // analytics row inflated it — one person tapping Share twice was "2 shares".
  const shares = (await db.query<{ n: number }>(
    `SELECT COUNT(DISTINCT COALESCE(fan_id::text, id::text))::int n
       FROM analytics_event WHERE event_id=$1 AND name ILIKE '%share%'`, [e.id])).rows[0]?.n ?? 0;
  const followers = (e.host_kind && e.host_id) ? (await db.query<{ n: number }>(
    `SELECT count(*)::int n FROM follow WHERE target_type::text=$1 AND target_id=$2`, [e.host_kind, e.host_id])).rows[0]?.n ?? 0 : 0;
  return { going, shares, followers };
}

// `regionAliases` (optional) is the query expanded into every live-language
// equivalent — ["münchen","munich","bavaria",…] — computed in the web layer by
// cityAliases() and passed in, so this repo stays language-agnostic and the db
// layer never imports the web layer. A match on ANY alias counts, which is how
// "München" finds a "Munich"-tagged event and back again.
export async function getDiscover(db: Database, filter: { sport?: string; region?: string; regionAliases?: string[]; excludeHosts?: { kind: string; id: string }[] }): Promise<Discover> {
  // A logged-in organiser doesn't want to see their OWN events under "Public
  // events" — that surface is for discovering OTHER people's. We pass the
  // viewer's owned entities and exclude events they host.
  const exclNeedles = (filter.excludeHosts ?? []).map(h => `${h.kind}:${h.id}`);
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
  // The set of needles to test a region against: every language equivalent when
  // provided, else just the raw query. "München" and "Munich" both resolve here.
  const regNeedles = (filter.regionAliases && filter.regionAliases.length)
    ? filter.regionAliases.map(s => s.toLowerCase())
    : (reg ? [reg] : []);
  const matches = (row: any) => (!filter.sport || row.sport === filter.sport)
    && (!regNeedles.length || (row.region && regNeedles.some(n => row.region.toLowerCase().includes(n))));

  // "live" = happening right now (started, not yet ended) — for FOMO/urgency,
  // not streaming. Ended-window defaults to +3h when no ends_at is set. Live
  // events surface first.
  // Events react to the sport + city chips too (not just athletes/clubs). Sport
  // comes from the event's own sport_id, else the host's sport; region from the
  // host's region or the event's free-text location. Filter in an outer query so
  // the LIMIT lands on matching rows, not the first 8 of everything.
  const evRows = (await db.query<any>(
    `SELECT * FROM (
       SELECT e.id, e.name title, to_char(e.starts_at AT TIME ZONE COALESCE(e.timezone,'UTC'),'DD Mon') date, e.host_kind, e.host_id, e.admission, e.cover_url, e.starts_at, e.location,
              (e.starts_at IS NOT NULL AND e.starts_at <= now() AND now() < COALESCE(e.ends_at, e.starts_at + interval '3 hours')) live,
              COALESCE(
                (SELECT s.key FROM sport s WHERE s.id=e.sport_id),
                (SELECT s.key FROM entity_sport es JOIN sport s ON s.id=es.sport_id WHERE es.entity_type='athlete' AND es.entity_id=e.host_id ORDER BY es.is_default DESC LIMIT 1),
                (SELECT s.key FROM team t JOIN sport s ON s.id=t.sport_id WHERE t.club_id=e.host_id LIMIT 1)
              ) evsport,
              CASE WHEN e.host_kind='athlete' THEN (SELECT region FROM athlete WHERE id=e.host_id)
                   WHEN e.host_kind='club' THEN (SELECT region FROM club WHERE id=e.host_id) END hostregion
       FROM event e
       WHERE e.host_kind IS NOT NULL
         -- "Private" has to MEAN private. Unlisted events never surface in
         -- discovery, search or the map — direct link only. Enforced here, in
         -- the query, not by hoping no UI links to them.
         AND e.visibility <> 'unlisted'
         AND e.cancelled_at IS NULL
         -- Sub-events (a race within a running event, a bout on a fight card) are
         -- reached only from their main event page — never surfaced in discovery.
         AND e.parent_event_id IS NULL
         AND (e.starts_at IS NULL OR now() < COALESCE(e.ends_at, e.starts_at + interval '3 hours'))
     ) q
     WHERE ($1::text IS NULL OR q.evsport = $1)
       -- Match the location/host-region against ANY language equivalent. $2 is a
       -- text[] of needles ("münchen","munich",…); an empty array means no region
       -- filter. EXISTS over unnest keeps it a single indexed-ish pass.
       AND (COALESCE(array_length($2::text[],1),0) = 0
            OR EXISTS (SELECT 1 FROM unnest($2::text[]) n
                       WHERE q.location ILIKE '%'||n||'%' OR q.hostregion ILIKE '%'||n||'%'))
       -- exclude the viewer's own events (they belong under "You're running", not
       -- under "Public events")
       AND (COALESCE(array_length($3::text[],1),0) = 0
            OR (q.host_kind || ':' || q.host_id::text) <> ALL($3::text[]))
     ORDER BY q.live DESC, q.starts_at
     LIMIT 8`, [filter.sport ?? null, regNeedles, exclNeedles])).rows;
  const upcoming = [];
  for (const e of evRows) {
    const s = await eventStats(db, e);
    upcoming.push({ id: e.id, title: e.title, date: e.date ?? undefined, host: await hostName(db, e.host_kind, e.host_id), admission: e.admission, live: !!e.live, coverUrl: e.cover_url ?? null, ...s });
  }

  const results = (await db.query<any>(
    `SELECT DISTINCT r.headline, to_char(e.starts_at AT TIME ZONE COALESCE(e.timezone,'UTC'),'DD Mon') date FROM result r JOIN event e ON e.id=r.event_id
     ORDER BY 2 DESC NULLS LAST LIMIT 6`)).rows.map(r => ({ headline: r.headline, date: r.date ?? undefined }));

  return {
    sports,
    athletes: athleteRows.filter(matches).map(a => ({ id: a.id, name: a.name, region: a.region, sport: a.sport, avatar: a.avatar ?? null, banner: a.banner ?? null, verified: !!a.verified })),
    clubs: clubRows.filter(matches).map(c => ({ id: c.id, name: c.name, region: c.region, sport: c.sport, avatar: c.avatar ?? null, verified: !!c.verified })),
    upcoming, results,
  };
}

// --- entity typeahead -------------------------------------------------------
// Powers the rival / roster pickers on the create-event form, and the search on
// /following. One function so "who exists on Horda" always means the same thing.
//
// Why this matters beyond convenience: an event that names a rival as free text
// creates an unclaimed placeholder. If the rival is ALREADY on Horda and the
// organiser types their name slightly differently ("FC Rival" vs "1. FC Rival"),
// we mint a duplicate placeholder instead of linking the real entity — and the
// attribution for that side goes nowhere. Recommending real entities first is
// what keeps the graph connected.
export interface EntitySuggestion {
  kind: 'athlete' | 'club' | 'team' | 'association';
  id: string;
  name: string;
  region: string | null;
  sport: string | null;
  avatar: string | null;
  verified: boolean;
}

export async function searchEntities(
  db: Database,
  q: string,
  opts: { kinds?: EntitySuggestion['kind'][]; sport?: string | null; limit?: number } = {},
): Promise<EntitySuggestion[]> {
  const term = (q || '').trim();
  if (term.length < 2) return [];            // 1 char matches everything — not a suggestion
  const like = '%' + term.toLowerCase() + '%';
  const pre = term.toLowerCase() + '%';      // prefix hits rank above substring hits
  const kinds = opts.kinds ?? ['athlete', 'club', 'team', 'association'];
  const limit = Math.min(20, Math.max(1, opts.limit ?? 8));
  const out: EntitySuggestion[] = [];

  if (kinds.includes('athlete')) {
    out.push(...(await db.query<any>(
      `SELECT a.id, a.display_name name, a.region, a.avatar_url avatar,
              (a.account_id IS NOT NULL OR EXISTS (SELECT 1 FROM ownership o WHERE o.owner_kind='athlete' AND o.owner_id=a.id)) verified,
              COALESCE(a.sport, (SELECT s.key FROM entity_sport es JOIN sport s ON s.id=es.sport_id
                                  WHERE es.entity_type='athlete' AND es.entity_id=a.id
                                  ORDER BY es.is_default DESC LIMIT 1)) sport
         FROM athlete a
        WHERE lower(a.display_name) LIKE $1
        ORDER BY (lower(a.display_name) LIKE $2) DESC, a.display_name
        LIMIT $3`, [like, pre, limit])).rows.map(r => ({
      kind: 'athlete' as const, id: r.id, name: r.name, region: r.region ?? null,
      sport: r.sport ?? null, avatar: r.avatar ?? null, verified: !!r.verified,
    })));
  }
  if (kinds.includes('club')) {
    out.push(...(await db.query<any>(
      `SELECT c.id, c.name, c.region,
              (SELECT eb.avatar_url FROM entity_branding eb WHERE eb.entity_type='club' AND eb.entity_id=c.id) avatar,
              EXISTS (SELECT 1 FROM ownership o WHERE o.owner_kind='club' AND o.owner_id=c.id) verified,
              (SELECT s.key FROM team t JOIN sport s ON s.id=t.sport_id WHERE t.club_id=c.id LIMIT 1) sport
         FROM club c
        WHERE lower(c.name) LIKE $1
        ORDER BY (lower(c.name) LIKE $2) DESC, c.name
        LIMIT $3`, [like, pre, limit])).rows.map(r => ({
      kind: 'club' as const, id: r.id, name: r.name, region: r.region ?? null,
      sport: r.sport ?? null, avatar: r.avatar ?? null, verified: !!r.verified,
    })));
  }
  if (kinds.includes('team')) {
    out.push(...(await db.query<any>(
      `SELECT t.id, t.name, NULL::text region, NULL::text avatar, false verified,
              (SELECT s.key FROM sport s WHERE s.id=t.sport_id) sport
         FROM team t WHERE lower(t.name) LIKE $1
        ORDER BY (lower(t.name) LIKE $2) DESC, t.name LIMIT $3`, [like, pre, limit])).rows.map(r => ({
      kind: 'team' as const, id: r.id, name: r.name, region: null,
      sport: r.sport ?? null, avatar: null, verified: false,
    })));
  }
  if (kinds.includes('association')) {
    out.push(...(await db.query<any>(
      `SELECT id, name, NULL::text region, NULL::text avatar, false verified, NULL::text sport
         FROM association WHERE lower(name) LIKE $1
        ORDER BY (lower(name) LIKE $2) DESC, name LIMIT $3`, [like, pre, limit])).rows.map(r => ({
      kind: 'association' as const, id: r.id, name: r.name, region: null,
      sport: null, avatar: null, verified: false,
    })));
  }

  // Drop duplicate suggestions (same entity surfaced twice looks broken in the
  // typeahead). Dedupe by kind+id.
  const seen = new Set<string>();
  const uniq = out.filter(e => { const k = e.kind + ':' + e.id; if (seen.has(k)) return false; seen.add(k); return true; });

  // Same-sport first: on a boxing event, boxers should outrank a same-named
  // footballer. Stable within a group, so prefix/verified ranking survives.
  const sport = (opts.sport || '').toLowerCase();
  const rank = (e: EntitySuggestion) => (sport && e.sport?.toLowerCase() === sport ? 0 : 1);
  return uniq.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map(x => x.e).slice(0, limit);
}
