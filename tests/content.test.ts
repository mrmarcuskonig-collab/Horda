// content.test.ts — the share engine on live data. Asserts the BRIGHT LINE:
// artifacts restate recorded facts only (names/scores/method/date) — no invented
// quotes, voice, or stats. Run: node tests/content.test.ts
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { getUpcomingBout } from '../src/db/engagement_repo.ts';
import { buildResultShare, buildFightShare, buildWeekDrop } from '../src/content/index.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;

// a settled result for the idol
const evRow = (await db.query<{ event_id: string }>(`SELECT event_id FROM result WHERE participant_id=$1 AND outcome='win' LIMIT 1`, [rico])).rows[0];

console.log('\n[content · result card + recap]');
const rs = (await buildResultShare(db, evRow.event_id))!;
console.log('  recap:', rs.body);
ok('recap states the real result (winner + method)', /Rico .*defeated .*(Tariq|Otto).* by (UD|KO)/.test(rs.body));
ok('card carries the real spark mark + link (no wordmark)', rs.card.includes('M50 22C58 42') && rs.card.includes('joinfuria.com') && !rs.card.includes('FURIA'));
ok('card uses only brand colours (Ink / Bone / Ember)', !/#(?!0B0B0C|EDE9DF|E15A40|cd4c33)[0-9A-Fa-f]{6}/i.test(rs.card));
ok('bright line: no fabricated quote/voice', !/[“"].*[”"]/.test(rs.body) && !/\bsaid\b|\bI'?ll\b|\bwe\b/i.test(rs.body));

console.log('\n[content · fight hype]');
const up = (await getUpcomingBout(db, rico))!;
const fs = (await buildFightShare(db, up.eventId))!;
console.log('  hype:', fs.body);
ok('hype names both fighters + the date, facts only', fs.body.includes('Rico') && fs.body.includes('Max Stein') && /set for|confirmed/.test(fs.body));
ok('hype surfaces real engagement channels', /tickets|stream|follow/i.test(fs.body));

console.log('\n[content · week drop]');
const wd = await buildWeekDrop(db, ids.fanId);
console.log('  drop:\n  ' + wd.body.replace(/\n/g, '\n  '));
ok('week drop summarizes the fan’s real coverage', wd.body.includes('week in the Furia') && wd.body.includes('•'));
ok('week card built (spark mark)', wd.card.includes('M50 22C58 42'));

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
