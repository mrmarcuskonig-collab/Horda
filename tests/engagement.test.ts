// engagement.test.ts — the fandom layer, end to end on live Postgres (PGlite).
// Boxing idol surface: fans follow a fighter, the fighter broadcasts, fans call
// the bout, the result settles their calls, and feeds/profiles assemble.
// Also asserts the fan<->fan guardrail is structural, not just convention.
// Run: node tests/engagement.test.ts
import { PGliteDatabase, applySchema } from '../src/db/index.ts';
import { getOrCreateSport, getOrCreateVariant } from '../src/db/repo.ts';
import {
  createFan, createAthlete, followEntity, createPost, createBout,
  makePrediction, commitBoutResult, getFanFeed, getAthleteProfile, getFanHome,
} from '../src/db/engagement_repo.ts';

let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}` + (ok ? '' : `\n        got ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

const db = await PGliteDatabase.open();
await applySchema(db);
const boxing = await getOrCreateSport(db, 'boxing', 'Boxing');
const bout = await getOrCreateVariant(db, boxing, 'bout', 'Bout', 'individual', 'matchup');

// the idol + the challenger (persons self-create)
const rico = await createAthlete(db, "Rico 'The Raven' Vargas", 'rico');
const max = await createAthlete(db, 'Max Stein', 'max');
const names = { [rico]: "Rico 'The Raven' Vargas", [max]: 'Max Stein' };

// two superfans, both follow the idol (fan -> athlete; never fan -> fan)
const fan1 = await createFan(db, 'ana', 'Ana');
const fan2 = await createFan(db, 'bo', 'Bo');
await followEntity(db, fan1, 'athlete', rico);
await followEntity(db, fan2, 'athlete', rico);

console.log('\n[fandom · the hub speaks]');
await createPost(db, 'athlete', rico, 'Camp is done. Saturday, I take the belt. 🐦‍⬛', undefined);
const notifsAfterPost = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM notification WHERE kind='post'`)).rows[0].n;
eq('post notified both followers', notifsAfterPost, 2);

console.log('\n[fandom · fans call the bout]');
const ev = await createBout(db, boxing, bout, rico, max, '2026-06-20T20:00:00Z', names[rico], names[max]);
await makePrediction(db, fan1, ev, rico);   // Ana backs the idol
await makePrediction(db, fan2, ev, max);    // Bo takes the upset
const settle = await commitBoutResult(db, ev, bout, rico, max, names, { method: 'KO', round: 3 });
eq('both predictions settled', settle.settled, 2);
eq('result notified both followers', settle.notified, 2);

console.log('\n[fandom · athlete profile — the idol surface]');
const prof = await getAthleteProfile(db, rico);
console.log(`  ${prof.name} — ${prof.record.wins}-${prof.record.losses}-${prof.record.draws}, ${prof.followers} followers`);
console.log(`  latest: ${prof.recentResults[0]?.headline}`);
eq('record 1-0-0', [prof.record.wins, prof.record.losses, prof.record.draws], [1, 0, 0]);
eq('two followers', prof.followers, 2);
eq('result headline reads as a win by KO', /def\..*by KO \(R3\)/.test(prof.recentResults[0]?.headline ?? ''), true);
eq('the callout is on the profile', prof.posts[0]?.body.startsWith('Camp is done'), true);

console.log('\n[fandom · fan home — closeness to who you follow]');
const ana = await getFanHome(db, fan1);
const bo = await getFanHome(db, fan2);
console.table(ana.feed.map(f => ({ kind: f.kind, when: f.date, what: f.headline.slice(0, 42) })));
eq("Ana's feed = the idol's post + the bout result", ana.feed.map(f => f.kind).sort(), ['post', 'result']);
eq("Ana called it right", ana.predictions[0].status, 'correct');
eq("Bo called it wrong", bo.predictions[0].status, 'incorrect');
eq("Ana has post + result notifications", ana.notifications.map(n => n.kind).sort(), ['post', 'result']);

console.log('\n[fandom · the fan↔fan guardrail is structural]');
const authorVals = (await db.query<{ enumlabel: string }>(`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='post_author_type' ORDER BY 1`)).rows.map(r => r.enumlabel);
eq('a fan cannot author a post (no "fan" in post_author_type)', authorVals.includes('fan'), false);
const followVals = (await db.query<{ enumlabel: string }>(`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='follow_target_type' ORDER BY 1`)).rows.map(r => r.enumlabel);
eq('a fan cannot be followed (no "fan" in follow_target_type)', followVals.includes('fan'), false);

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
