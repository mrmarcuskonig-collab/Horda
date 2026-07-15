// db/index.ts — the database boundary.
// One small interface the app talks to; adapters behind it. Today: PGlite
// (real Postgres compiled to WASM — embedded, file-persistable, zero-ops),
// perfect for a solo bootstrapper and for tests. Production swaps in a
// server-Postgres adapter (Neon) with the SAME interface — see PostgresDatabase.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Database {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

// --- PGlite adapter (embedded Postgres) -----------------------------------
export class PGliteDatabase implements Database {
  private pg: any;
  private constructor(pg: any) { this.pg = pg; }
  static async open(dataDir?: string): Promise<PGliteDatabase> {
    const { PGlite } = await import('@electric-sql/pglite');
    // dataDir persists to disk across restarts; omit for in-memory (tests).
    const pg = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
    return new PGliteDatabase(pg);
  }
  async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
    const r = await this.pg.query(sql, params);
    return { rows: r.rows as T[] };
  }
  async exec(sql: string): Promise<void> { await this.pg.exec(sql); }
  async close(): Promise<void> { await this.pg.close(); }
}

// --- Production adapter (server Postgres: Neon, Render PG, RDS, …) ----------
// Same Database interface, backed by a real Postgres server over the wire via
// node-postgres. Multi-statement DDL files run through exec() use the simple
// query protocol (each file is one implicit transaction — atomic migrations).
export class PostgresDatabase implements Database {
  private pool: any;
  private constructor(pool: any) { this.pool = pool; }
  static async open(connectionString: string): Promise<PostgresDatabase> {
    const pgmod: any = await import('pg');
    const Pool = pgmod.Pool ?? pgmod.default?.Pool;
    // Managed Postgres (Neon/Render/etc.) requires TLS; accept their cert chain.
    const ssl = /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: false };
    // idleTimeoutMillis below Neon's idle cutoff so WE close idle clients before
    // the server does; keepAlive keeps sockets healthy.
    const pool = new Pool({ connectionString, ssl, max: 5, idleTimeoutMillis: 10_000, keepAlive: true });
    // CRITICAL: a pool emits an 'error' event when an *idle* client's connection
    // drops (Neon/serverless reap idle connections constantly). With no listener,
    // Node treats it as an uncaught error and CRASHES THE PROCESS — which returns
    // empty/blank responses until Render restarts it. This listener makes the pool
    // simply discard the dead client and carry on.
    pool.on('error', (err: any) => console.error('[pg] idle client dropped (recovered):', err?.message ?? err));
    await pool.query('SELECT 1');            // fail fast if the URL/credentials are wrong
    // Keep-alive ping every 4 min so Neon's free tier doesn't suspend the DB
    // between visits (avoids a cold-start delay on the first click). unref() so
    // it never keeps the process from exiting.
    const ka = setInterval(() => { pool.query('SELECT 1').catch(() => {}); }, 240_000);
    (ka as any).unref?.();
    return new PostgresDatabase(pool);
  }
  async query<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[] }> {
    try {
      const r = await this.pool.query(sql, params);
      return { rows: r.rows as T[] };
    } catch (e: any) {
      // Neon can close a connection between checkout and use; retry once on a
      // fresh client for connection-level errors (not for real SQL errors).
      const msg = String(e?.message ?? e);
      if (/terminat|ECONNRESET|connection|server closed|socket hang|read ECONN/i.test(msg)) {
        const r = await this.pool.query(sql, params);
        return { rows: r.rows as T[] };
      }
      throw e;
    }
  }
  async exec(sql: string): Promise<void> { await this.pool.query(sql); }
  async close(): Promise<void> { await this.pool.end(); }
}

// --- factory: pick the adapter from the environment ------------------------
// DATABASE_URL set  → real Postgres server (production).
// otherwise         → embedded PGlite (local dev + tests), persisting to
//                     HORDA_DATA if provided.
export async function openDatabase(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) return PostgresDatabase.open(url);
  return PGliteDatabase.open(process.env.HORDA_DATA || undefined);
}

// --- schema + seed runners (operate on the real db/ SQL files) -------------
// Tracked migrations: every pending .sql is applied in order on EVERY startup
// (not just on a fresh DB), and recorded in schema_migrations so it runs once.
// This is what lets new migrations reach an already-deployed database.
export async function applySchema(db: Database, migrationsDir = 'db/migrations'): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const trackerCount = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM schema_migrations`)).rows[0].n;

  // Bootstrap for databases created before this tracker existed: don't try to
  // re-run (and crash on) migrations whose changes are already present. Probe
  // for each modern migration's key object; mark already-present ones applied.
  if (trackerCount === 0) {
    const legacy = (await db.query<{ r: string | null }>(`SELECT to_regclass('public.account')::text r`)).rows[0].r !== null;
    if (legacy) {
      const colExists = async (t: string, c: string) =>
        (await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, c])).rows.length > 0;
      const relExists = async (r: string) =>
        (await db.query<{ x: string | null }>(`SELECT to_regclass($1)::text x`, [r])).rows[0].x !== null;
      const enumHas = async (typ: string, val: string) =>
        (await db.query(`SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 AND e.enumlabel=$2`, [typ, val])).rows.length > 0;
      const present: Record<string, () => Promise<boolean>> = {
        '0016': () => relExists('public.claim_request'),
        '0017': async () => (await colExists('membership_tier', 'level')) && (await relExists('public.loyalty_event')),
        '0018': () => colExists('account', 'role'),
        '0019': () => colExists('membership', 'stripe_subscription_id'),
        '0020': () => relExists('public.password_reset'),
        '0021': () => enumHas('post_visibility', 'supporter'),
        '0022': () => enumHas('post_visibility', 'clubhouse'),
        '0023': () => colExists('athlete', 'layout'),
        '0024': () => relExists('public.feature_request'),
        '0025': () => colExists('event', 'location_kind'),
        '0026': () => colExists('event', 'room_enabled'),
        '0027': () => colExists('athlete', 'sports'),
        '0028': () => relExists('public.shop_item'),
        '0029': () => colExists('athlete', 'theme'),
        '0030': () => colExists('account', 'creator_layer'),
        '0031': () => relExists('public.claim'),
        '0032': () => relExists('public.event_format'),
        '0033': () => relExists('public.entity_link'),
        '0034': () => colExists('event', 'access_mode'),
        '0035': () => relExists('public.event_share'),
        '0036': () => colExists('event', 'parent_event_id'),
        '0037': () => relExists('public.login_token'),
        '0038': () => relExists('public.payout_account'),
      };
      for (const f of files) {
        const probe = present[f.slice(0, 4)];
        const already = probe ? await probe() : true;  // pre-modern files: assume applied on a legacy DB
        if (already) await db.query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, [f]);
      }
    }
  }

  const done = new Set((await db.query<{ filename: string }>(`SELECT filename FROM schema_migrations`)).rows.map(r => r.filename));
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
    await db.query(`INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`, [f]);
    applied.push(f);
  }
  return applied;
}

export async function applySeed(db: Database, seedFile = 'db/seed/seed_trio.sql'): Promise<void> {
  await db.exec(readFileSync(seedFile, 'utf8'));
}
