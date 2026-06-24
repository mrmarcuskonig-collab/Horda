import { PGlite } from '@electric-sql/pglite';
const mb = (n:number)=> (n/1048576).toFixed(0);
const db = new PGlite();   // bare, in-memory, no schema, no seed
await db.query('select 1');
const m = process.memoryUsage();
console.log(`BARE PGlite  RSS=${mb(m.rss)}MB external=${mb(m.external)}MB`);
process.exit(0);
