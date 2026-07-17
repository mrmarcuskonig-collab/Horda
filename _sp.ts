import { PGliteDatabase } from './src/db/index.ts';
const db = await PGliteDatabase.open();
const r = await db.query<any>(`SELECT key, name, is_live FROM sport ORDER BY display_order`);
console.log(r.rows.map((x:any)=>x.key+(x.is_live?'':'(off)')).join(', '));
process.exit(0);
