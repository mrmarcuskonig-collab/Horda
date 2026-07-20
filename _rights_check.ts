// _rights_check.ts — proves 0044 applies and its guardrails hold.
import { openDatabase, applySchema } from './src/db/index.ts';
const db = await openDatabase();  // fresh PGlite in dev
await applySchema(db);

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const throws = async (n: string, fn: () => Promise<unknown>) => {
  try { await fn(); ok(n, false); } catch { ok(n, true); }
};

// tables exist
for (const t of ['rights_policy', 'rights_grant', 'asset_consent_dep']) {
  const r = await db.query<{ x: string | null }>(`SELECT to_regclass($1)::text x`, [`public.${t}`]);
  ok(`table ${t} exists`, r.rows[0].x !== null);
}

const acc = (await db.query<{ id: string }>(`INSERT INTO account (email) VALUES ('rights@x.io') RETURNING id`)).rows[0].id;
const coach = (await db.query<{ id: string }>(`INSERT INTO account (email) VALUES ('coach@x.io') RETURNING id`)).rows[0].id;
const pol = (await db.query<{ id: string }>(
  `INSERT INTO rights_policy (scope, version, body, body_sha256, rev_share_bps)
   VALUES ('ai_training_licensing','ai/2026-07-01','...text...','deadbeef',1500) RETURNING id`)).rows[0].id;

// self can grant AI/licensing
await db.query(
  `INSERT INTO rights_grant (subject_account_id, scope, action, policy_id, rev_share_bps, actor_role, actor_account_id, context, event_id)
   VALUES ($1,'ai_training_licensing','granted',$2,1500,'self',$1,'profile',NULL)`, [acc, pol]);
ok('self CAN grant ai_training_licensing', true);

// coach (operator) CANNOT grant commercial/AI — the check must reject it
await throws('operator (coach) CANNOT grant ai_training_licensing (check fires)', () =>
  db.query(
    `INSERT INTO rights_grant (subject_account_id, scope, action, actor_role, actor_account_id, context)
     VALUES ($1,'ai_training_licensing','granted','operator',$2,'registration')`, [acc, coach]));

// operator CAN record likeness_event_media (not commercial) — allowed
await db.query(
  `INSERT INTO rights_grant (subject_account_id, scope, action, actor_role, actor_account_id, context)
   VALUES ($1,'likeness_event_media','granted','operator',$2,'registration')`, [acc, coach]);
ok('operator CAN record likeness_event_media', true);

// guardian grant without a name must be rejected
await throws('guardian grant WITHOUT guardian_name is rejected', () =>
  db.query(
    `INSERT INTO rights_grant (subject_account_id, scope, action, actor_role, actor_account_id, subject_is_minor, context)
     VALUES ($1,'commercial_sponsor','granted','guardian',$2,true,'registration')`, [acc, coach]));

// withdrawal supersedes a prior grant; current-state = latest action per (subject, scope)
const g = (await db.query<{ id: string }>(
  `SELECT id FROM rights_grant WHERE subject_account_id=$1 AND scope='ai_training_licensing' AND action='granted' LIMIT 1`, [acc])).rows[0].id;
await db.query(
  `INSERT INTO rights_grant (subject_account_id, scope, action, actor_role, actor_account_id, context, supersedes_id)
   VALUES ($1,'ai_training_licensing','withdrawn','self',$1,'profile',$2)`, [acc, g]);
const cur = (await db.query<{ action: string }>(
  `SELECT action FROM rights_grant WHERE subject_account_id=$1 AND scope='ai_training_licensing'
   ORDER BY captured_at DESC LIMIT 1`, [acc])).rows[0].action;
ok('after withdrawal, derived current state is "withdrawn"', cur === 'withdrawn');

// dependency graph: an asset can point back to the grant it derived from
await db.query(
  `INSERT INTO asset_consent_dep (asset_id, asset_kind, rights_grant_id)
   VALUES (gen_random_uuid(),'clip',$1)`, [g]);
const deps = (await db.query<{ n: number }>(
  `SELECT count(*)::int n FROM asset_consent_dep WHERE rights_grant_id=$1`, [g])).rows[0].n;
ok('asset→grant dependency is queryable (withdrawal can propagate)', deps === 1);

console.log(`\n──────── rights model: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
