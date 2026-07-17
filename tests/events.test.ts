// events.test.ts — Luma-style scheduling + RSVP on live Postgres.
// Run: node tests/events.test.ts
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { createFan } from '../src/db/engagement_repo.ts';
import { listUpcomingByHost, rsvp, getRsvp, getEventDetail, getGuestList, icsFor } from '../src/db/events_repo.ts';

// REGRESSION (v79): /e/:id threw "esc is not defined" — esc() was used in the
// Event Room CTA but never imported into server.ts. It only fired when an event
// had a room enabled, and the seed data has no rooms, so every existing test
// passed while every REAL user-created event 500'd (the create form ships
// "Open an Event Room" pre-checked). Lesson encoded below: exercise the event
// page for an event created THROUGH THE FORM, not just a seeded one.
let pass = 0, fail = 0;
const eq = (n: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}` + (ok ? '' : `\n        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const db = await PGliteDatabase.open();
const ids = await seedDemo(db);
const rico = ids.athletes[0].id;

console.log('\n[events · the idol scheduled an event]');
const hosted = await listUpcomingByHost(db, 'athlete', rico);
ok('Rico hosts an upcoming event', hosted.length >= 1);
const eid = hosted[0].id;

// seed already RSVP’d "You" as going; add a spread of responses
const mara = await createFan(db, 'mara', 'Mara');
const theo = await createFan(db, 'theo', 'Theo');
const nils = await createFan(db, 'nils', 'Nils');
await rsvp(db, mara, eid, 'interested');
await rsvp(db, theo, eid, 'stream');
await rsvp(db, nils, eid, 'not_going');

console.log('\n[events · responses tally]');
const d = (await getEventDetail(db, eid))!;
console.log(`  ${d.title} — hosted by ${d.hostName}`);
console.table(d.counts);
eq('counts: 1 going / 1 interested / 1 stream / 1 can’t', [d.counts.going, d.counts.interested, d.counts.stream, d.counts.not_going], [1, 1, 1, 1]);
eq('hosted by the athlete', d.hostName.includes('Rico'), true);
eq('guest list has all 4 responders', (await getGuestList(db, eid)).length, 4);

console.log('\n[events · a fan changes their mind]');
await rsvp(db, mara, eid, 'going');
const d2 = (await getEventDetail(db, eid))!;
eq('going now 2, interested 0 (upsert, not duplicate)', [d2.counts.going, d2.counts.interested], [2, 0]);
eq('Mara’s stored response is going', (await getRsvp(db, mara, eid))?.response, 'going');

console.log('\n[events · add to calendar]');
const ics = icsFor(d2);
ok('ICS is a valid VEVENT with summary + start', ics.includes('BEGIN:VEVENT') && ics.includes('SUMMARY:') && /DTSTART:\d{8}T\d{6}Z/.test(ics) && ics.includes('END:VCALENDAR'));

await db.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
