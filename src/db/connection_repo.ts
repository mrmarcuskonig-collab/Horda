// connection_repo.ts — the entity connection graph. Athletes link up to clubs;
// clubs link up to leagues/associations/series. Either side can request; the
// parent admits/rejects and can later remove. Powers the "Clubs & Leagues" cards.
import type { Database } from './index.ts';

export interface EntityRef { kind: string; id: string; name: string; logoUrl: string | null; role?: string; linkId?: string; status?: string }

// name + logo for any entity kind (best-effort; leagues have name only).
export async function entityCard(db: Database, kind: string, id: string): Promise<{ name: string; logoUrl: string | null }> {
  if (kind === 'athlete') {
    const r = (await db.query<any>(`SELECT display_name name, avatar_url logo FROM athlete WHERE id=$1`, [id])).rows[0];
    return { name: r?.name ?? 'Athlete', logoUrl: r?.logo ?? null };
  }
  if (kind === 'club') {
    const r = (await db.query<any>(`SELECT c.name, (SELECT avatar_url FROM entity_branding eb WHERE eb.entity_type='club' AND eb.entity_id=c.id) logo FROM club c WHERE c.id=$1`, [id])).rows[0];
    return { name: r?.name ?? 'Club', logoUrl: r?.logo ?? null };
  }
  if (kind === 'association') {
    const r = (await db.query<any>(`SELECT name FROM association WHERE id=$1`, [id])).rows[0];
    return { name: r?.name ?? 'Association', logoUrl: null };
  }
  if (kind === 'league') {
    const r = (await db.query<any>(`SELECT name FROM league WHERE id=$1`, [id])).rows[0];
    return { name: r?.name ?? 'League', logoUrl: null };
  }
  return { name: kind, logoUrl: null };
}

// request a link (child→parent). Re-requesting a removed/rejected link revives it.
export async function requestLink(db: Database, o: { childKind: string; childId: string; parentKind: string; parentId: string; role?: string; requestedBy?: string; autoActive?: boolean }): Promise<string> {
  const status = o.autoActive ? 'active' : 'pending';
  const r = await db.query<{ id: string }>(
    `INSERT INTO entity_link (child_kind, child_id, parent_kind, parent_id, role, status, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (child_kind, child_id, parent_kind, parent_id)
       DO UPDATE SET status=$6, role=COALESCE(EXCLUDED.role, entity_link.role), requested_by=$7, updated_at=now()
     RETURNING id`,
    [o.childKind, o.childId, o.parentKind, o.parentId, o.role ?? null, status, o.requestedBy ?? 'child']);
  return r.rows[0].id;
}
export async function setLinkStatus(db: Database, linkId: string, status: 'active' | 'removed' | 'pending'): Promise<void> {
  await db.query(`UPDATE entity_link SET status=$2, updated_at=now() WHERE id=$1`, [linkId, status]);
}
export async function getLink(db: Database, linkId: string): Promise<any> {
  return (await db.query<any>(`SELECT * FROM entity_link WHERE id=$1`, [linkId])).rows[0] ?? null;
}

// active parents of a child (e.g. the clubs/leagues an athlete belongs to) — for cards.
export async function activeParents(db: Database, childKind: string, childId: string): Promise<EntityRef[]> {
  const rows = (await db.query<any>(`SELECT id, parent_kind, parent_id, role FROM entity_link WHERE child_kind=$1 AND child_id=$2 AND status='active' ORDER BY updated_at DESC`, [childKind, childId])).rows;
  const out: EntityRef[] = [];
  for (const r of rows) { const c = await entityCard(db, r.parent_kind, r.parent_id); out.push({ kind: r.parent_kind, id: r.parent_id, name: c.name, logoUrl: c.logoUrl, role: r.role ?? undefined, linkId: r.id, status: 'active' }); }
  return out;
}
// links where THIS entity is the parent (incoming) — pending to admit, active to remove.
export async function childrenOf(db: Database, parentKind: string, parentId: string, status?: string): Promise<EntityRef[]> {
  const rows = (await db.query<any>(`SELECT id, child_kind, child_id, role, status FROM entity_link WHERE parent_kind=$1 AND parent_id=$2 ${status ? 'AND status=$3' : ''} ORDER BY updated_at DESC`, status ? [parentKind, parentId, status] : [parentKind, parentId])).rows;
  const out: EntityRef[] = [];
  for (const r of rows) { const c = await entityCard(db, r.child_kind, r.child_id); out.push({ kind: r.child_kind, id: r.child_id, name: c.name, logoUrl: c.logoUrl, role: r.role ?? undefined, linkId: r.id, status: r.status }); }
  return out;
}
// outgoing links from THIS entity as the child (any status) — to show request state.
export async function parentsOf(db: Database, childKind: string, childId: string): Promise<EntityRef[]> {
  const rows = (await db.query<any>(`SELECT id, parent_kind, parent_id, role, status FROM entity_link WHERE child_kind=$1 AND child_id=$2 AND status<>'removed' ORDER BY updated_at DESC`, [childKind, childId])).rows;
  const out: EntityRef[] = [];
  for (const r of rows) { const c = await entityCard(db, r.parent_kind, r.parent_id); out.push({ kind: r.parent_kind, id: r.parent_id, name: c.name, logoUrl: c.logoUrl, role: r.role ?? undefined, linkId: r.id, status: r.status }); }
  return out;
}

// is a child actively linked to a parent? (used for participation / associated share)
export async function isLinked(db: Database, childKind: string, childId: string, parentKind: string, parentId: string): Promise<boolean> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int n FROM entity_link WHERE child_kind=$1 AND child_id=$2 AND parent_kind=$3 AND parent_id=$4 AND status='active'`, [childKind, childId, parentKind, parentId])).rows[0].n > 0;
}
