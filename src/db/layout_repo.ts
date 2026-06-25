// layout_repo.ts — athlete page layout + sport, and the feature-request channel.
import type { Database } from './index.ts';
import type { SectionPick } from '../web/sections.ts';

// Stored sport, or — for older athletes created before we persisted it — derived
// from a sport they've competed in. May still be null for a brand-new athlete.
export async function getAthleteSport(db: Database, athleteId: string): Promise<string | null> {
  const stored = (await db.query<{ sport: string | null }>(`SELECT sport FROM athlete WHERE id=$1`, [athleteId])).rows[0]?.sport;
  if (stored) return stored;
  const derived = (await db.query<{ key: string }>(
    `SELECT s.key FROM event e JOIN event_participant ep ON ep.event_id=e.id JOIN sport s ON s.id=e.sport_id WHERE ep.participant_id=$1 LIMIT 1`,
    [athleteId])).rows[0]?.key;
  return derived ?? null;
}
// Set the athlete's sport. `onlyIfEmpty` is used at onboarding (don't clobber);
// the edit flow passes false to allow changing it.
export async function setAthleteSport(db: Database, athleteId: string, sport: string | null, onlyIfEmpty = false): Promise<void> {
  if (!sport) return;
  await db.query(`UPDATE athlete SET sport=$2 WHERE id=$1${onlyIfEmpty ? ' AND sport IS NULL' : ''}`, [athleteId, sport]);
}

export async function getAthleteLayout(db: Database, athleteId: string): Promise<SectionPick[] | null> {
  const raw = (await db.query<{ layout: any }>(`SELECT layout FROM athlete WHERE id=$1`, [athleteId])).rows[0]?.layout;
  const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.sections) ? raw.sections : null);
  return Array.isArray(arr) ? arr.filter((x: any) => x && typeof x.key === 'string').map((x: any) => ({ key: x.key, on: !!x.on })) : null;
}
export async function setAthleteLayout(db: Database, athleteId: string, sections: SectionPick[]): Promise<void> {
  await db.query(`UPDATE athlete SET layout=$2::jsonb WHERE id=$1`, [athleteId, JSON.stringify(sections)]);
}

export async function createFeatureRequest(db: Database, accountId: string | null, sport: string | null, context: string | null, body: string): Promise<void> {
  const text = (body || '').trim().slice(0, 2000);
  if (!text) return;
  await db.query(`INSERT INTO feature_request (account_id, sport, context, body) VALUES ($1,$2,$3,$4)`, [accountId, sport, context, text]);
}
