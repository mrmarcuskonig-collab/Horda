// platform.test.ts — ADR-0002 platform readiness.
//   * every behavioral FACT (claim, pass, presence, follow, attribution) carries a
//     `source` tag; existing/default writes are 'furia'
//   * a future product can override `source` at the write boundary
//   * the dormant consent table can EXPRESS product + purpose (schema only)
// Run: node tests/platform.test.ts
import { startServer } from '../src/web/server.ts';
import { createClaim, verifyPass } from '../src/db/claim_rail_repo.ts';
import { followEntity } from '../src/db/engagement_repo.ts';
import { getOrCreateShareToken } from '../src/db/events_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db;
const col = async (t: string, c: string) => (await db.query(
  `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, c])).rows.length > 0;

console.log('\n[platform · one fan graph, source-tagged facts]');

// --- the columns exist on every fact table ---
for (const t of ['claim', 'pass', 'presence', 'follow', 'event_share']) {
  ok(`${t}.source column exists`, await col(t, 'source'));
}

const evId = (await db.query<{ id: string }>(`SELECT id FROM event ORDER BY created_at LIMIT 1`)).rows[0].id;
const fanA = app.ids.fanId;
const ath = app.ids.athletes[0].id;

// --- a Furia claim + its pass are tagged 'furia' by default ---
const c = await createClaim(db, { eventId: evId, fanId: fanA, capacity: 100, mode: 'open', priceCents: 0 });
const claimSrc = (await db.query<{ source: string }>(`SELECT source FROM claim WHERE id=$1`, [c.claimId])).rows[0].source;
const passSrc = (await db.query<{ source: string }>(`SELECT source FROM pass WHERE claim_id=$1`, [c.claimId])).rows[0].source;
ok('a claim defaults to source=furia', claimSrc === 'furia');
ok('its pass defaults to source=furia', passSrc === 'furia');

// --- verifying the pass records presence, tagged with the claim's source ---
await verifyPass(db, c.passToken, null);
const presSrc = (await db.query<{ source: string }>(`SELECT source FROM presence WHERE claim_id=$1`, [c.claimId])).rows[0].source;
ok('presence inherits the claim source (furia)', presSrc === 'furia');

// --- a follow + an attribution share default to furia ---
await followEntity(db, fanA, 'athlete', ath);
const followSrc = (await db.query<{ source: string }>(`SELECT source FROM follow WHERE fan_id=$1 AND target_id=$2`, [fanA, ath])).rows[0].source;
ok('a follow defaults to source=furia', followSrc === 'furia');
const tok = await getOrCreateShareToken(db, evId, fanA);
const shareSrc = (await db.query<{ source: string }>(`SELECT source FROM event_share WHERE token=$1`, [tok])).rows[0].source;
ok('an attribution share defaults to source=furia', shareSrc === 'furia');

// --- a DIFFERENT product can claim the SAME graph under its own source ---
const fanB = (await db.query<{ id: string }>(`SELECT id FROM fan WHERE id<>$1 LIMIT 1`, [fanA])).rows[0].id;
const c2 = await createClaim(db, { eventId: evId, fanId: fanB, capacity: 100, mode: 'open', priceCents: 0, source: 'arena' });
const src2 = (await db.query<{ source: string }>(`SELECT source FROM claim WHERE id=$1`, [c2.claimId])).rows[0].source;
ok('a second product writes its own source (not furia)', src2 === 'arena');
// fresh edge — a follow that doesn't already exist (ON CONFLICT DO NOTHING would
// otherwise keep a seeded 'furia' row and hide the new product's tag)
await db.query(`DELETE FROM follow WHERE fan_id=$1 AND target_id=$2`, [fanB, ath]);
await followEntity(db, fanB, 'athlete', ath, 'arena');
const fSrc2 = (await db.query<{ source: string }>(`SELECT source FROM follow WHERE fan_id=$1 AND target_id=$2`, [fanB, ath])).rows[0].source;
ok('a second product tags its follow edges too', fSrc2 === 'arena');

// --- the graph can be sliced per product (the whole point) ---
const furia = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM claim WHERE source='furia'`)).rows[0].n;
const arena = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM claim WHERE source='arena'`)).rows[0].n;
ok('claims are sliceable by product', furia >= 1 && arena === 1);

// --- consent (dormant) can EXPRESS product + purpose (ADR-0002 ruling #3) ---
ok('rights_grant can express a product scope', await col('rights_grant', 'product'));
ok('rights_grant can express a purpose scope', await col('rights_grant', 'purpose'));

await app.close();
console.log(`\n──────── platform: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
