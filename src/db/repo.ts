// db/repo.ts — write the ingested data into the schema, and read the club page
// back out of it. The pipeline output goes IN; a ClubPageModel comes OUT — the
// in-memory demo (slice 4) is now a persistent app.
import type { Database } from './index.ts';
import type { IngestReport, KnownEntity } from '../pipeline/types.ts';
import { buildClubPage } from '../read/build.ts';
import type { ClubPageModel } from '../read/types.ts';
import type { StandingDef } from '../engines/types.ts';

// --- catalog helpers ------------------------------------------------------
export async function getOrCreateSport(db: Database, key: string, name: string): Promise<string> {
  await db.query(`INSERT INTO sport (key,name,is_live) VALUES ($1,$2,true) ON CONFLICT (key) DO NOTHING`, [key, name]);
  const r = await db.query<{ id: string }>(`SELECT id FROM sport WHERE key=$1`, [key]);
  return r.rows[0].id;
}

export async function getOrCreateVariant(
  db: Database, sportId: string, key: string, name: string,
  resultParticipant: 'individual' | 'team', shape: 'matchup' | 'field',
): Promise<string> {
  await db.query(
    `INSERT INTO variant (sport_id,key,name,result_participant,shape) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (sport_id,key) DO NOTHING`, [sportId, key, name, resultParticipant, shape]);
  const r = await db.query<{ id: string }>(`SELECT id FROM variant WHERE sport_id=$1 AND key=$2`, [sportId, key]);
  return r.rows[0].id;
}

// Create a club + its (single) team; returns the team id used as the competitor.
export async function createClubWithTeam(db: Database, name: string, sportId: string): Promise<{ clubId: string; teamId: string }> {
  const c = await db.query<{ id: string }>(`INSERT INTO club (name,source,claim_status) VALUES ($1,'native','claimed') RETURNING id`, [name]);
  const clubId = c.rows[0].id;
  const t = await db.query<{ id: string }>(`INSERT INTO team (club_id,sport_id,name) VALUES ($1,$2,$3) RETURNING id`, [clubId, sportId, name]);
  return { clubId, teamId: t.rows[0].id };
}

// --- commit (ingest -> DB) ------------------------------------------------
// Only `ready` events are written; `needs_review` is held back (spec §5 guardrail).
export async function commitResults(db: Database, report: IngestReport, sportId: string, variantId: string): Promise<number> {
  let n = 0;
  for (const s of report.staged) {
    if (s.status !== 'ready' || !s.home.matchId || !s.away.matchId) continue;
    const headline = `${s.home.matchName} ${s.homeScore}–${s.awayScore} ${s.away.matchName}`;
    const ev = await db.query<{ id: string }>(
      `INSERT INTO event (name,sport_id,variant_id,starts_at,source) VALUES ($1,$2,$3,$4::timestamptz,'ingested') RETURNING id`,
      [headline, sportId, variantId, s.date ? `${s.date}T00:00:00Z` : null]);
    const eventId = ev.rows[0].id;
    const sides = [
      { pid: s.home.matchId, home: true,  score: s.homeScore!, outcome: s.spine![0].outcome },
      { pid: s.away.matchId, home: false, score: s.awayScore!, outcome: s.spine![1].outcome },
    ];
    for (const side of sides) {
      await db.query(
        `INSERT INTO event_participant (event_id,participant_type,participant_id,source,status,is_home)
         VALUES ($1,'team',$2,'direct','selected',$3)`, [eventId, side.pid, side.home]);
      await db.query(
        `INSERT INTO result (event_id,variant_id,participant_id,participant_type,outcome,headline,detail,source)
         VALUES ($1,$2,$3,'team',$4,$5,$6::jsonb,'ingested')`,
        [eventId, variantId, side.pid, side.outcome, headline, JSON.stringify({ score: side.score })]);
    }
    n++;
  }
  return n;
}

export async function commitFixtures(db: Database, report: IngestReport, sportId: string, variantId: string): Promise<number> {
  let n = 0;
  for (const s of report.staged) {
    if (s.status !== 'ready' || !s.home.matchId || !s.away.matchId) continue;
    const startsAt = s.date ? `${s.date}T${s.time ?? '00:00'}:00Z` : null;
    const ev = await db.query<{ id: string }>(
      `INSERT INTO event (name,sport_id,variant_id,starts_at,source) VALUES ($1,$2,$3,$4::timestamptz,'ingested') RETURNING id`,
      [`${s.home.matchName} vs ${s.away.matchName}`, sportId, variantId, startsAt]);
    const eventId = ev.rows[0].id;
    for (const side of [{ pid: s.home.matchId, home: true }, { pid: s.away.matchId, home: false }]) {
      await db.query(
        `INSERT INTO event_participant (event_id,participant_type,participant_id,source,status,is_home)
         VALUES ($1,'team',$2,'direct','available',$3)`, [eventId, side.pid, side.home]);
    }
    n++;
  }
  return n;
}

// --- read (DB -> ClubPageModel) -------------------------------------------
// Reconstructs the staged-event shape from the DB so the slice-2/4 engines and
// read layer are reused verbatim — the source changed, the logic didn't.
export async function getClubPage(db: Database, focusTeamId: string, standing: StandingDef): Promise<ClubPageModel> {
  const teams = await db.query<{ id: string; name: string }>(`SELECT id,name FROM team`);
  const labelOf = Object.fromEntries(teams.rows.map(t => [t.id, t.name]));

  // completed results: event -> {home,away} with scores
  const resRows = await db.query<any>(`
    SELECT e.id event_id, to_char(e.starts_at,'YYYY-MM-DD') date,
           r.participant_id pid, r.outcome, (r.detail->>'score')::int score, ep.is_home
    FROM event e
    JOIN result r ON r.event_id=e.id
    JOIN event_participant ep ON ep.event_id=e.id AND ep.participant_id=r.participant_id
    ORDER BY e.starts_at NULLS LAST, e.id`);

  const resultsStaged = groupSides(resRows.rows, labelOf, true);

  // fixtures: events with participants but no results yet
  const fixRows = await db.query<any>(`
    SELECT e.id event_id, to_char(e.starts_at,'YYYY-MM-DD') date, to_char(e.starts_at,'HH24:MI') time,
           ep.participant_id pid, ep.is_home
    FROM event e
    JOIN event_participant ep ON ep.event_id=e.id
    WHERE NOT EXISTS (SELECT 1 FROM result r WHERE r.event_id=e.id)
    ORDER BY e.starts_at NULLS LAST, e.id`);

  const fixturesStaged = groupSides(fixRows.rows, labelOf, false);

  return buildClubPage({ resultsStaged, fixturesStaged, focusClubId: focusTeamId, labelOf, standing });
}

// Fold flat side-rows (two per event) into the StagedEvent shape buildClubPage wants.
function groupSides(rows: any[], labelOf: Record<string, string>, withScores: boolean): any[] {
  const byEvent = new Map<string, any[]>();
  for (const r of rows) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id)!.push(r);
  }
  const out: any[] = [];
  for (const [, sides] of byEvent) {
    const home = sides.find(s => s.is_home) ?? sides[0];
    const away = sides.find(s => !s.is_home) ?? sides[1];
    if (!home || !away) continue;
    const res = (pid: string) => ({ input: labelOf[pid] ?? pid, matchId: pid, matchName: labelOf[pid] ?? pid, score: 1, decision: 'auto', suggestions: [] });
    const ev: any = {
      kind: withScores ? 'result' : 'fixture', raw: '', date: home.date, time: home.time,
      sportKey: 'football', variantKey: '11_a_side',
      home: res(home.pid), away: res(away.pid), confidence: 1, status: 'ready', source: 'ingested', flags: [],
    };
    if (withScores) {
      ev.homeScore = home.score; ev.awayScore = away.score;
      ev.spine = [
        { participantId: home.pid, participantType: 'team', outcome: home.outcome, detail: { score: home.score } },
        { participantId: away.pid, participantType: 'team', outcome: away.outcome, detail: { score: away.score } },
      ];
    }
    out.push(ev);
  }
  return out;
}
