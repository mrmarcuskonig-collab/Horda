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

// --- Production adapter (sketch; not wired here) ---------------------------
// import postgres from 'postgres';
// export class PostgresDatabase implements Database {
//   constructor(private sql = postgres(process.env.DATABASE_URL!)) {}
//   query(q, p=[]) { return this.sql.unsafe(q, p).then(rows => ({ rows })); }
//   exec(q)       { return this.sql.unsafe(q).then(() => {}); }
//   close()       { return this.sql.end(); }
// }

// --- schema + seed runners (operate on the real db/ SQL files) -------------
export async function applySchema(db: Database, migrationsDir = 'db/migrations'): Promise<string[]> {
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  return files;
}

export async function applySeed(db: Database, seedFile = 'db/seed/seed_trio.sql'): Promise<void> {
  await db.exec(readFileSync(seedFile, 'utf8'));
}
