// _prod_inventory.ts — READ-ONLY. Lists what's actually in the production DB so we
// can decide seed-cleanup strategy without guessing. Deletes nothing; runs only
// SELECTs. Run against prod:
//   DATABASE_URL='postgres://…neon…' node _prod_inventory.ts
import { openDatabase } from './src/db/index.ts';

const SEED_CLUBS = ['FC Beispiel', 'TSV Musterstadt', 'SV Example', 'SpVgg Altdorf', 'Berliner SC'];
const SEED_ASSOC = ['Berliner Fußball-Verband'];
const DEMO_EMAIL = 'demo@horda.app';

const db = await openDatabase();
const q = async (s: string, p: any[] = []) => (await db.query<any>(s, p)).rows;
const isSeedName = (n: string) => SEED_CLUBS.includes(n) || SEED_ASSOC.includes(n);
const tag = (seed: boolean) => seed ? 'SEED' : 'real?';

console.log('\n════════ PRODUCTION INVENTORY (read-only) ════════\n');

// Accounts — the ground truth for "is anyone real here".
const accounts = await q(`SELECT id, email, display_name, created_at FROM account ORDER BY created_at`);
console.log(`ACCOUNTS (${accounts.length}):`);
for (const a of accounts) {
  const seed = a.email === DEMO_EMAIL;
  console.log(`  [${tag(seed)}] ${a.email}  "${a.display_name || ''}"  ${new Date(a.created_at).toISOString().slice(0, 10)}`);
}
const realAccounts = accounts.filter((a: any) => a.email !== DEMO_EMAIL);
console.log(`  → ${realAccounts.length} non-demo account(s)\n`);

// Clubs / associations / athletes / teams.
for (const [label, table, nameCol] of [['CLUBS', 'club', 'name'], ['ASSOCIATIONS', 'association', 'name'], ['TEAMS', 'team', 'name'], ['ATHLETES', 'athlete', 'display_name']] as const) {
  const rows = await q(`SELECT id, ${nameCol} AS name, created_at FROM ${table} ORDER BY created_at`);
  console.log(`${label} (${rows.length}):`);
  for (const r of rows) console.log(`  [${tag(isSeedName(r.name))}] ${r.name}  ${new Date(r.created_at).toISOString().slice(0, 10)}`);
  console.log('');
}

// Events — with host + whether the host is a seed entity.
const events = await q(`
  SELECT e.id, e.name AS title, e.host_kind, e.host_id, e.starts_at, e.created_at,
         COALESCE(c.name, t.name, a.name, ath.display_name) AS host_name
  FROM event e
  LEFT JOIN club c ON e.host_kind='club' AND c.id=e.host_id
  LEFT JOIN team t ON e.host_kind='team' AND t.id=e.host_id
  LEFT JOIN association a ON e.host_kind='association' AND a.id=e.host_id
  LEFT JOIN athlete ath ON e.host_kind='athlete' AND ath.id=e.host_id
  ORDER BY e.created_at`);
console.log(`EVENTS (${events.length}):`);
for (const e of events) {
  const seed = isSeedName(e.host_name || '');
  console.log(`  [${tag(seed)}] "${e.title}"  host=${e.host_name || e.host_kind}  starts=${e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 10) : '—'}`);
}
console.log('');

// Real activity that a wipe would destroy: claims (tickets/RSVPs) + passes.
const claims = await q(`SELECT count(*)::int n FROM claim`);
const passes = await q(`SELECT count(*)::int n FROM pass`);
const fans = await q(`SELECT count(*)::int n FROM fan`);
console.log(`ACTIVITY: fans=${fans[0].n}  claims/RSVPs=${claims[0].n}  passes=${passes[0].n}\n`);

console.log('════════ READ-OUT ════════');
console.log(`Non-demo accounts: ${realAccounts.length}`);
console.log('If that is 0 (or only your own test logins) and claims≈0, a clean wipe is safest.');
console.log('If real people have signed up or claimed, we delete SEED-only instead.');
console.log('Nothing was changed by this script.');
await db.close();
process.exit(0);
