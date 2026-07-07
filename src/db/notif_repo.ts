// notif_repo.ts — in-app notifications for logged-in users. Organizer-facing
// ("Alex confirmed for Fight Night — in person") and fan-facing ("Your spot is
// confirmed"). Targeted at a fan_id (every account has a fan identity).
import type { Database } from './index.ts';

export interface Notif { id: string; kind: string; headline: string; href: string | null; eventId: string | null; createdAt: string; read: boolean }

export async function notify(db: Database, o: { fanId: string; kind: string; headline: string; href?: string | null; eventId?: string | null }): Promise<void> {
  if (!o.fanId) return;
  await db.query(
    `INSERT INTO app_notification (fan_id, kind, headline, href, event_id) VALUES ($1,$2,$3,$4,$5)`,
    [o.fanId, o.kind, o.headline.slice(0, 200), o.href ?? null, o.eventId ?? null]);
}

export async function listNotifications(db: Database, fanId: string, limit = 40): Promise<Notif[]> {
  return (await db.query<any>(
    `SELECT id, kind, headline, href, event_id, to_char(created_at,'Dy DD Mon · HH24:MI') created_at, read
     FROM app_notification WHERE fan_id=$1 ORDER BY created_at DESC LIMIT $2`, [fanId, limit])).rows
    .map(r => ({ id: r.id, kind: r.kind, headline: r.headline, href: r.href ?? null, eventId: r.event_id ?? null, createdAt: r.created_at, read: !!r.read }));
}

export async function unreadCount(db: Database, fanId: string | null): Promise<number> {
  if (!fanId) return 0;
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM app_notification WHERE fan_id=$1 AND read=false`, [fanId])).rows[0]?.n ?? 0;
}

export async function markAllRead(db: Database, fanId: string): Promise<void> {
  await db.query(`UPDATE app_notification SET read=true WHERE fan_id=$1 AND read=false`, [fanId]);
}
