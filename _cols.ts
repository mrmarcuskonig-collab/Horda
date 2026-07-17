import { PGliteDatabase } from './src/db/index.ts';
const db = await PGliteDatabase.open();
for (const t of ['athlete','club','team','association']) {
  const r = await db.query<any>(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t]);
  console.log(t+':', r.rows.map((x:any)=>x.column_name).join(', '));
}
process.exit(0);
