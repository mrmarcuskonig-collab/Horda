import { openDatabase, applySchema } from './src/db/index.ts';
const db = await openDatabase(); await applySchema(db);
// tables with an event_id column (deleted when we delete a seed event)
const evRefs = await db.query(`SELECT table_name FROM information_schema.columns WHERE column_name='event_id' AND table_schema='public' ORDER BY table_name`);
console.log('event_id refs:', evRefs.rows.map((r:any)=>r.table_name).join(', '));
// tables with host_kind/host_id or entity_kind/entity_id (entity refs, often text not FK)
const entRefs = await db.query(`SELECT DISTINCT table_name FROM information_schema.columns WHERE column_name IN ('host_id','entity_id','owner_id','target_id','author_id','club_id') AND table_schema='public' ORDER BY table_name`);
console.log('entity-ish refs:', entRefs.rows.map((r:any)=>r.table_name).join(', '));
process.exit(0);
