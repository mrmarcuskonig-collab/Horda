// attendees.test.ts — the manage view lets the organiser expand a format and see
// who's attending it: names, linking to a creator page when the attendee owns one,
// plain name otherwise. Run: node tests/attendees.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { addFormat, formatAttendees } from '../src/db/event_format_repo.ts';
import { createClaim } from '../src/db/claim_rail_repo.ts';
import { createAthlete, createFan } from '../src/db/engagement_repo.ts';
import { grantOwnership } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };

const app = await startServer(0);
const db = app.db;
const base = `http://localhost:${app.port}`;
console.log('\n[attendees] per-format attendee list with creator links');

// The demo account owns the seed entities and can manage its own events.
const hostAthlete = app.ids.athletes[0].id;      // Rico — owned by the demo account (the viewer)
const evId = await createScheduledEvent(db, { hostKind: 'athlete', hostId: hostAthlete, title: 'ATTENDEE_EVENT', startsAt: new Date(Date.now() + 864e5).toISOString(), admission: 'open' });
const inPerson = await addFormat(db, { eventId: evId, kind: 'in_person', label: 'At the gym', sort: 0 });
const stream = await addFormat(db, { eventId: evId, kind: 'stream', label: 'Livestream', sort: 1 });

// Attendee 1: a fan who ALSO owns an athlete page (a creator) → name should link.
const creatorAthlete = await createAthlete(db, 'Nadia Public', 'nadiapublic');
const creatorAccount = (await db.query<{ id: string }>(`INSERT INTO account (email) VALUES ('nadia@x.io') RETURNING id`)).rows[0].id;
await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [creatorAccount, creatorAthlete]);
await grantOwnership(db, creatorAccount, 'athlete', creatorAthlete);
const creatorFan = await createFan(db, 'nadiapublic_fan', 'Nadia Public');
await db.query(`UPDATE fan SET account_id=$1 WHERE id=$2`, [creatorAccount, creatorFan]);
await createClaim(db, { eventId: evId, fanId: creatorFan, capacity: 100, mode: 'open', priceCents: 0, formatId: inPerson });

// Attendee 2: a plain fan (no account/entity) who brought a guest → name only, "+1 guest".
const plainFan = await createFan(db, 'tomplain', 'Tom Plain');
await createClaim(db, { eventId: evId, fanId: plainFan, capacity: 100, mode: 'open', priceCents: 0, partySize: 2, maxPerPerson: 4, formatId: inPerson });

// Attendee 3: someone on the stream.
const streamFan = await createFan(db, 'sarastream', 'Sara Stream');
await createClaim(db, { eventId: evId, fanId: streamFan, capacity: 100, mode: 'open', priceCents: 0, formatId: stream });

// --- repo groups attendees by format ---
const grouped = await formatAttendees(db, evId);
ok('formatAttendees groups by the chosen format', (grouped[inPerson]?.length === 2) && (grouped[stream]?.length === 1));
ok('a creator attendee carries a profile link target', !!grouped[inPerson]?.find(a => a.name === 'Nadia Public')?.profile);
ok('a plain fan attendee has no profile link', grouped[inPerson]?.find(a => a.name === 'Tom Plain')?.profile === null);

// --- the manage page renders the expandable list ---
const manage = await fetch(base + `/manage/${evId}`).then(r => r.text());   // no cookie = demo viewer (owns Rico)
ok('manage shows the "Attendance by format" section', manage.includes('Attendance by format'));
ok('each format is expandable ("See who\'s coming")', manage.includes("See who's coming"));
ok('the creator attendee links to their athlete page', new RegExp(`<a href="/athlete/${creatorAthlete}">Nadia Public</a>`).test(manage));
ok('the plain fan shows as a name with no link', manage.includes('>Tom Plain<') && !new RegExp(`href="[^"]*">Tom Plain`).test(manage));
ok('a brought guest is surfaced ("+1 guest")', manage.includes('+1 guest'));
ok('the stream attendee is listed under the stream format', manage.includes('Sara Stream'));

console.log(`\n──────── attendees: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
