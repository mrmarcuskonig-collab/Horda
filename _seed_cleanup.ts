// _seed_cleanup.ts — remove the demo seed world (fake clubs like "FC Beispiel",
// the "SV Example"/"TSV Musterstadt" set, the Berliner Fußball-Verband, the seed
// athletes/fans, and every event they host) from a database.
//
// SAFETY:
//   • DRY-RUN by default: prints exactly what it WOULD delete and changes nothing.
//     Add --commit to actually delete (everything runs in one transaction).
//   • OWNERSHIP-GUARDED: a seed entity is only deleted if it is still owned by the
//     demo account (or owned by nobody). If a REAL account has claimed one of these
//     handles, it is left untouched and reported — we never delete real people's data.
//   • Schema-introspecting: it discovers which tables reference events/entities/fans,
//     so it can't crash on a column that doesn't exist in a given schema version.
//   • The demo account row itself is KEPT by default (so the HORDA_DEMO no-login view
//     still resolves, just to an empty world). Add --purge-demo-account to remove it.
//
// Run (safe preview, local):        node _seed_cleanup.ts
// Preview against prod:             DATABASE_URL='postgres://…neon…' node _seed_cleanup.ts
// Actually clean prod:              DATABASE_URL='postgres://…neon…' node _seed_cleanup.ts --commit
import { openDatabase } from './src/db/index.ts';

const COMMIT = process.argv.includes('--commit');
const PURGE_DEMO = process.argv.includes('--purge-demo-account');

// ---- the seed's fingerprints (must match src/web/seed.ts) ----
const SEED_CLUBS = ['FC Beispiel', 'TSV Musterstadt', 'SV Example', 'SpVgg Altdorf', 'Berliner SC'];
const SEED_ASSOC = ['Berliner Fußball-Verband'];
const SEED_ATH_HANDLES = ['rico', 'tariq', 'otto', 'max'];
const SEED_ATH_NAMES = ["Rico 'The Raven' Vargas", 'Tariq Bello', 'Otto Kahn', 'Max Stein',
  'Jonas Weber', 'Luka Petrović', 'Emre Demir', 'Finn Albrecht'];
const SEED_FAN_HANDLES = ['you', 'ines', 'karl', 'maja', 'rieke'];
const DEMO_EMAIL = 'demo@horda.app';

const db = await openDatabase();
const rows = async <T = any>(s: string, p: any[] = []) => (await db.query<T>(s, p)).rows;
const one = async (s: string, p: any[] = []) => (await rows(s, p))[0];
const has = async (table: string, col: string) =>
  !!(await one(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, col]));
const allTables: string[] = (await rows(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).map((r: any) => r.table_name);
const colsOf = async (t: string): Promise<string[]> =>
  (await rows(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t])).map((r: any) => r.column_name);

console.log(`\n════════ SEED CLEANUP — ${COMMIT ? 'COMMIT (will delete)' : 'DRY RUN (no changes)'} ════════\n`);

// ---- demo account ----
const demo = await one<{ id: string }>(`SELECT id FROM account WHERE email=$1`, [DEMO_EMAIL]);
const demoId: string | null = demo?.id ?? null;
console.log(demoId ? `demo account: ${DEMO_EMAIL} (${demoId})` : `demo account: none found`);

// owners set we trust = {demo}. A seed entity owned by anyone else is a REAL claim → skip.
async function ownedByNonDemo(kind: string, id: string): Promise<string | null> {
  if (!allTables.includes('ownership')) return null;
  const r = await rows<{ account_id: string; email: string }>(
    `SELECT o.account_id, a.email FROM ownership o JOIN account a ON a.id=o.account_id
      WHERE o.owner_kind=$1 AND o.owner_id=$2`, [kind, id]);
  const foreign = r.find(x => x.email !== DEMO_EMAIL);
  return foreign ? foreign.email : null;
}

// ---- resolve seed entity ids, applying the ownership guard ----
type Pair = { kind: string; id: string; label: string };
const pairs: Pair[] = [];
const skipped: string[] = [];
async function consider(kind: string, id: string, label: string) {
  const foreign = await ownedByNonDemo(kind, id);
  if (foreign) { skipped.push(`${label} (${kind}) — owned by real account ${foreign}, KEPT`); return; }
  pairs.push({ kind, id, label });
}

for (const n of SEED_CLUBS) { const c = await one<{ id: string }>(`SELECT id FROM club WHERE name=$1`, [n]); if (c) await consider('club', c.id, n); }
for (const n of SEED_ASSOC) { const a = await one<{ id: string }>(`SELECT id FROM association WHERE name=$1`, [n]); if (a) await consider('association', a.id, n); }
// teams: created by the seed alongside the clubs (same names); guard each.
for (const n of SEED_CLUBS) { const t = await one<{ id: string }>(`SELECT id FROM team WHERE name=$1`, [n]); if (t) await consider('team', t.id, n); }
// athletes: by handle or display_name.
for (const a of await rows<{ id: string; display_name: string; handle: string }>(`SELECT id, display_name, handle FROM athlete`)) {
  if (SEED_ATH_HANDLES.includes(a.handle) || SEED_ATH_NAMES.includes(a.display_name)) await consider('athlete', a.id, a.display_name);
}

const clubIds = pairs.filter(p => p.kind === 'club').map(p => p.id);
const assocIds = pairs.filter(p => p.kind === 'association').map(p => p.id);
const athIds = pairs.filter(p => p.kind === 'athlete').map(p => p.id);
const teamIds = pairs.filter(p => p.kind === 'team').map(p => p.id);

// seed fans (handle-based).
const seedFans = await rows<{ id: string; handle: string }>(`SELECT id, handle FROM fan WHERE handle = ANY($1)`, [SEED_FAN_HANDLES]);
const fanIds = seedFans.map(f => f.id);

// leagues sanctioned by a seed association.
let leagueIds: string[] = [];
if (allTables.includes('league') && await has('league', 'association_id') && assocIds.length)
  leagueIds = (await rows<{ id: string }>(`SELECT id FROM league WHERE association_id = ANY($1)`, [assocIds])).map(r => r.id);

// events hosted by any seed entity — plus their sub-events (parent_event_id).
const kinds = [...new Set(pairs.map(p => p.kind))];
let eventIds: string[] = [];
if (pairs.length) {
  const hostRows = await rows<{ id: string }>(
    `SELECT id FROM event WHERE (host_kind,host_id) IN (${pairs.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',')})`,
    pairs.flatMap(p => [p.kind, p.id]));
  eventIds = hostRows.map(r => r.id);
  if (await has('event', 'parent_event_id') && eventIds.length) {
    const kids = await rows<{ id: string }>(`SELECT id FROM event WHERE parent_event_id = ANY($1)`, [eventIds]);
    eventIds = [...new Set([...eventIds, ...kids.map(k => k.id)])];
  }
}

console.log(`\nseed scope (after ownership guard):`);
console.log(`  clubs=${clubIds.length}  teams=${teamIds.length}  athletes=${athIds.length}  associations=${assocIds.length}  leagues=${leagueIds.length}`);
console.log(`  fans=${fanIds.length}  events(+sub)=${eventIds.length}`);
if (skipped.length) { console.log(`\n  KEPT (real ownership):`); for (const s of skipped) console.log(`    • ${s}`); }
if (!pairs.length && !fanIds.length) { console.log('\nNothing seed-like found. Nothing to do.'); await db.close(); process.exit(0); }

// ---- plan the deletes (introspected) ----
const KIND_ID: [string, string][] = [
  ['host_kind', 'host_id'], ['entity_kind', 'entity_id'], ['target_type', 'target_id'],
  ['author_kind', 'author_id'], ['child_kind', 'child_id'], ['parent_kind', 'parent_id'],
  ['owner_kind', 'owner_id'], ['subject_kind', 'subject_id'],
];
const BASE = new Set(['event', 'athlete', 'club', 'team', 'association', 'league', 'fan', 'account']);
type Step = { sql: string; params: any[]; note: string };
const steps: Step[] = [];

// 0) pass rows tied to a seed event's claim (before claim is removed).
if (allTables.includes('pass') && eventIds.length) {
  const passCols = await colsOf('pass');
  if (passCols.includes('claim_id') && !passCols.includes('event_id'))
    steps.push({ note: 'pass (via claim)', params: [eventIds], sql: `DELETE FROM pass WHERE claim_id IN (SELECT id FROM claim WHERE event_id = ANY($1))` });
}

// 1) every NON-base table that references a seed event / fan / entity / league.
for (const t of allTables) {
  if (BASE.has(t)) continue;
  const cols = await colsOf(t);
  if (cols.includes('event_id') && eventIds.length)
    steps.push({ note: `${t} (event_id)`, params: [eventIds], sql: `DELETE FROM ${t} WHERE event_id = ANY($1)` });
  if (cols.includes('fan_id') && fanIds.length)
    steps.push({ note: `${t} (fan_id)`, params: [fanIds], sql: `DELETE FROM ${t} WHERE fan_id = ANY($1)` });
  if (cols.includes('league_id') && leagueIds.length)
    steps.push({ note: `${t} (league_id)`, params: [leagueIds], sql: `DELETE FROM ${t} WHERE league_id = ANY($1)` });
  if (cols.includes('club_id') && clubIds.length)
    steps.push({ note: `${t} (club_id)`, params: [clubIds], sql: `DELETE FROM ${t} WHERE club_id = ANY($1)` });
  for (const [kc, ic] of KIND_ID) {
    if (cols.includes(kc) && cols.includes(ic) && pairs.length)
      steps.push({ note: `${t} (${kc}/${ic})`, params: pairs.flatMap(p => [p.kind, p.id]),
        sql: `DELETE FROM ${t} WHERE (${kc},${ic}) IN (${pairs.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',')})` });
  }
}
// ownership rows for demo (its grants over the seed entities) — non-base handled above via entity_kind/entity_id.

// 2) base tables, child→parent order.
if (eventIds.length) steps.push({ note: 'event', params: [eventIds], sql: `DELETE FROM event WHERE id = ANY($1)` });
if (teamIds.length) steps.push({ note: 'team', params: [teamIds], sql: `DELETE FROM team WHERE id = ANY($1)` });
if (athIds.length) steps.push({ note: 'athlete', params: [athIds], sql: `DELETE FROM athlete WHERE id = ANY($1)` });
if (leagueIds.length) steps.push({ note: 'league', params: [leagueIds], sql: `DELETE FROM league WHERE id = ANY($1)` });
if (clubIds.length) steps.push({ note: 'club', params: [clubIds], sql: `DELETE FROM club WHERE id = ANY($1)` });
if (assocIds.length) steps.push({ note: 'association', params: [assocIds], sql: `DELETE FROM association WHERE id = ANY($1)` });
if (fanIds.length) steps.push({ note: 'fan', params: [fanIds], sql: `DELETE FROM fan WHERE id = ANY($1)` });
if (PURGE_DEMO && demoId) steps.push({ note: 'account (demo)', params: [demoId], sql: `DELETE FROM account WHERE id = $1` });

// ---- execute (or preview) inside one transaction ----
await db.query('BEGIN');
let total = 0;
try {
  for (const s of steps) {
    // Everything runs inside the transaction; on a dry run we ROLLBACK at the end,
    // so RETURNING gives an exact count without leaving any change behind.
    const del = await db.query<{ ok: number }>(`${s.sql} RETURNING 1 AS ok`, s.params);
    const n = del.rows.length;
    if (n > 0) { total += n; console.log(`  − ${String(n).padStart(4)}  ${s.note}`); }
  }
  if (COMMIT) { await db.query('COMMIT'); console.log(`\n✓ COMMITTED — removed ${total} row(s) across the seed world.`); }
  else { await db.query('ROLLBACK'); console.log(`\n(dry run) would remove ${total} row(s). Re-run with --commit to apply.`); }
} catch (e) {
  await db.query('ROLLBACK');
  console.error(`\n✗ ROLLED BACK — nothing changed. Error:`, e instanceof Error ? e.message : e);
  await db.close(); process.exit(1);
}
if (!PURGE_DEMO && demoId) console.log(`(kept demo account ${DEMO_EMAIL} — its entities are gone; add --purge-demo-account to remove it too.)`);
await db.close();
process.exit(0);
