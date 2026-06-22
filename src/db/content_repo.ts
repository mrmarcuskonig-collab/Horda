// content_repo.ts — reads for the share engine. Returns only recorded facts.
import type { Database } from './index.ts';
import type { ResultSide } from '../content/report.ts';

export async function getEventForShare(db: Database, eventId: string): Promise<{ sport: string; date?: string; sides: ResultSide[] } | null> {
  const rows = (await db.query<any>(
    `SELECT s.key sport, to_char(e.starts_at,'YYYY-MM-DD') date,
            r.outcome, (r.detail->>'score')::int score, r.detail->>'method' method, (r.detail->>'round')::int round,
            ep.is_home, COALESCE(t.name, a.display_name) name
     FROM event e
     JOIN result r ON r.event_id=e.id
     JOIN sport s ON s.id=e.sport_id
     LEFT JOIN event_participant ep ON ep.event_id=e.id AND ep.participant_id=r.participant_id
     LEFT JOIN team t ON t.id=r.participant_id
     LEFT JOIN athlete a ON a.id=r.participant_id
     WHERE e.id=$1 ORDER BY ep.is_home DESC NULLS LAST`, [eventId])).rows;
  if (!rows.length) return null;
  return {
    sport: rows[0].sport, date: rows[0].date ?? undefined,
    sides: rows.map(r => ({ name: r.name, score: r.score ?? undefined, outcome: r.outcome, method: r.method ?? undefined, round: r.round ?? undefined, isHome: r.is_home ?? undefined })),
  };
}

export async function getUpcomingForShare(db: Database, eventId: string): Promise<{ sport: string; date?: string; a: string; b: string; ticket: boolean; stream: boolean } | null> {
  const rows = (await db.query<any>(
    `SELECT s.key sport, to_char(e.starts_at,'YYYY-MM-DD') date, e.ticket_url, e.stream_url,
            COALESCE(t.name, a.display_name) name
     FROM event e JOIN sport s ON s.id=e.sport_id
     JOIN event_participant ep ON ep.event_id=e.id
     LEFT JOIN team t ON t.id=ep.participant_id LEFT JOIN athlete a ON a.id=ep.participant_id
     WHERE e.id=$1 ORDER BY ep.is_home DESC NULLS LAST`, [eventId])).rows;
  if (rows.length < 2) return null;
  return { sport: rows[0].sport, date: rows[0].date ?? undefined, a: rows[0].name, b: rows[1].name, ticket: !!rows[0].ticket_url, stream: !!rows[0].stream_url };
}

// simple W-L-D for an individual athlete (facts, for the hype line)
export async function getRecord(db: Database, athleteId: string): Promise<string | null> {
  const rows = (await db.query<any>(`SELECT outcome, count(*)::int n FROM result WHERE participant_id=$1 GROUP BY outcome`, [athleteId])).rows;
  if (!rows.length) return null;
  const c: Record<string, number> = {}; for (const r of rows) c[r.outcome] = r.n;
  return `${c.win ?? 0}-${c.loss ?? 0}-${c.draw ?? 0}`;
}
