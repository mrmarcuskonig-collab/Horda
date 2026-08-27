// handles_repo.ts — vanity handles: joinfuria.com/<handle> → a public entity page.
//
// One flat namespace across athletes, clubs, teams and federations, so a single
// /<handle> is never ambiguous. A page shares ONE memorable link and users see
// everything it runs — no need to link back to Furia from their own site.
import type { Database } from './index.ts';

// First-path segments a handle can never be — so a vanity URL can never shadow an
// app route. Keep in sync with the single-segment routes in server.ts.
export const RESERVED_HANDLES = new Set<string>([
  '', 'about', 'discover', 'map', 'create', 'settings', 'login', 'signup', 'logout',
  'notifications', 'following', 'me', 'pros', 'onboarding', 'changelog', 'pricing',
  'impressum', 'agb', 'terms', 'datenschutz', 'privacy', 'legal', 'discord', 'claim-handle',
  'robots.txt', 'sitemap.xml', 'llms.txt', 'humans.txt', 'healthz', 'health', 'favicon.ico',
  'favicon.svg', 'count', 'widerruf', 'withdrawal', 'athletes', 'clubs', 'features', 'api',
  'admin', 'static', 'assets', 'public', 'embed', 'host', 'manage', 'pass', 'e', 'fan',
  'athlete', 'club', 'team', 'association', 'account', 'plus', 'stripe', 'share', 'og',
  'entity', 'claim', 'member', 'manage-payouts', 'you', 'search', 'events', 'event',
  'profile', 'edit', 'new', 'app', 'www', 'help', 'support', 'status', 'changelog.json',
]);

const norm = (raw: string | null | undefined) => (raw || '').trim().replace(/^@/, '').toLowerCase();
// 2–40 chars: a letter/number/underscore first, then letters/numbers/_ . or -.
const VALID = /^[a-z0-9_][a-z0-9_.-]{1,39}$/;
// Athletes live in the same flat namespace as the other page kinds, so they go
// through the same table map, the same VALID regex and the same reserved list —
// there used to be a second, weaker athlete-only validator (no dots, no dashes,
// no reserved words) which let an athlete take a handle like /settings.
const ENT_TABLE: Record<string, string> = { athlete: 'athlete', club: 'club', team: 'team', association: 'association' };
export type HandleKind = 'athlete' | 'club' | 'team' | 'association';

export function isReservedHandle(raw: string): boolean { return RESERVED_HANDLES.has(norm(raw)); }
export function isValidHandle(raw: string): boolean { const h = norm(raw); return VALID.test(h) && !RESERVED_HANDLES.has(h); }

/**
 * Resolve a vanity handle to a PUBLIC entity page. Precedence is athlete → club →
 * team → association (first match wins). Fans are private, so never resolved here.
 */
export async function resolveEntityHandle(db: Database, raw: string): Promise<{ kind: string; id: string } | null> {
  const h = norm(raw);
  if (!VALID.test(h)) return null;
  const r = await db.query<{ kind: string; id: string }>(
    `SELECT 'athlete' kind, id::text id FROM athlete WHERE lower(handle)=$1
     UNION ALL SELECT 'club', id::text FROM club WHERE lower(handle)=$1
     UNION ALL SELECT 'team', id::text FROM team WHERE lower(handle)=$1
     UNION ALL SELECT 'association', id::text FROM association WHERE lower(handle)=$1
     LIMIT 1`, [h]);
  return r.rows[0] ?? null;
}

/** Is a handle free across the whole vanity namespace (optionally excluding one entity)? */
export async function handleAvailable(db: Database, raw: string, except?: { kind: string; id: string }): Promise<boolean> {
  const h = norm(raw);
  if (!VALID.test(h) || RESERVED_HANDLES.has(h)) return false;
  const hit = await resolveEntityHandle(db, h);
  if (!hit) return true;
  return !!except && hit.kind === except.kind && hit.id === except.id;
}

/** Set (or clear, with '') a page handle. Validates + global-unique. */
export async function setEntityHandle(
  db: Database, kind: HandleKind, id: string, raw: string,
): Promise<{ ok: true; handle: string | null } | { ok: false; error: string }> {
  const tbl = ENT_TABLE[kind]; if (!tbl) return { ok: false, error: 'Unknown page type.' };
  const h = norm(raw);
  if (!h) { await db.query(`UPDATE ${tbl} SET handle=NULL WHERE id=$1`, [id]); return { ok: true, handle: null }; }
  if (!VALID.test(h)) return { ok: false, error: 'Use 2–40 letters, numbers, or _ . -' };
  if (RESERVED_HANDLES.has(h)) return { ok: false, error: 'That name is reserved.' };
  if (!(await handleAvailable(db, h, { kind, id }))) return { ok: false, error: 'That name is already taken.' };
  await db.query(`UPDATE ${tbl} SET handle=$1 WHERE id=$2`, [h, id]);
  return { ok: true, handle: h };
}

/** The current handle for a page (null if none set). */
export async function getEntityHandle(db: Database, kind: HandleKind, id: string): Promise<string | null> {
  const tbl = ENT_TABLE[kind]; if (!tbl) return null;
  return (await db.query<{ handle: string | null }>(`SELECT handle FROM ${tbl} WHERE id=$1`, [id])).rows[0]?.handle ?? null;
}

// --- where a page actually lives ------------------------------------------
// A new page starts on its /kind/:uuid path and stays reachable there forever.
// Once its owner sets a handle, THAT is the link we show, share and put in
// og:url — every caller goes through here so a custom link can never be half
// applied (the page saying /club/<uuid> while the vanity URL also works).

/** The path a page should be linked by: /<handle> if it has one, else /kind/:id. */
export function publicPathFor(kind: string, id: string, handle?: string | null): string {
  const h = norm(handle);
  return h ? `/${h}` : `/${kind}/${id}`;
}

/** The same thing, absolute — for og:url, share sheets and "your link is …". */
export function publicUrlFor(origin: string, kind: string, id: string, handle?: string | null): string {
  return `${(origin || '').replace(/\/+$/, '')}${publicPathFor(kind, id, handle)}`;
}
