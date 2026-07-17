import { PGliteDatabase } from './src/db/index.ts';
const db = await PGliteDatabase.open();
for (const t of ['athlete','club','team','association']) {
  const r = await db.query<any>(`SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[t]);
  console.log(t+':', r.rows.map((x:any)=>x.attname).join(', '));
}
process.exit(0);
