// ways.test.ts — WAYS TO GET IN: the doors on an event, and what a fan does with them.
//
// THE MODEL (v81 got this wrong and this suite exists to stop it happening again):
// an event has one or more DOORS (event_format) — in person, a stream, a second
// stream — each with its own price, its own capacity and its own limit on how
// many spots one person may take. The FAN picks a door and claims. A hybrid
// event genuinely has two doors; v80/v81 modelled "how do people get in?" as a
// single event-wide radio, which quietly made hybrid unexpressable: you could
// say "in person and streamed" and then only offer one way to actually attend.
//
// Run: node tests/ways.test.ts
import { startServer } from '../src/web/server.ts';
import { createClaim, formatSpots } from '../src/db/claim_rail_repo.ts';
import { addFormat, formatCounts, listFormats } from '../src/db/event_format_repo.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const db = app.db;
const base = `http://localhost:${app.port}`;
const host = app.ids.athletes[0].id;
const soon = new Date(Date.now() + 864e5).toISOString().slice(0, 16);

console.log('\n[ways] doors on an event · fan choice · party size · per-door capacity');

// --- 1. the create form builds the right doors ------------------------------
const mk = async (o: Record<string, string>) => {
  const r = await fetch(base + '/events', {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ host_kind: 'athlete', host_id: host, title: 'W', starts_at: soon, ...o }).toString(),
  });
  const id = (r.headers.get('location') || '').replace('/e/', '');
  const ev = (await db.query<any>(`SELECT admission, access_mode FROM event WHERE id=$1`, [id])).rows[0];
  return { id, ev, ways: await listFormats(db, id) };
};

const A = await mk({ location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '18,50', fmt_inperson_cap: '100', fmt_inperson_maxpp: '4' });
ok('in-person paid → one door, priced, capped, 4 per person', A.ways.length === 1 && A.ways[0].kind === 'in_person' && A.ways[0].priceCents === 1850 && A.ways[0].capacity === 100 && A.ways[0].maxPerPerson === 4);
ok('in-person paid → event derives paid + QR ticket', A.ev.admission === 'paid' && A.ev.access_mode === 'ticket');

// THE ONE THAT WAS BROKEN: hybrid must produce TWO doors, priced independently.
const B = await mk({ location_kind: 'hybrid', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '25', fmt_inperson_cap: '200', fmt_inperson_maxpp: '2', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://youtube.com/x', fmt_stream1_label: 'YouTube' });
ok('HYBRID gives the fan TWO doors to choose between', B.ways.length === 2 && B.ways.some(w => w.kind === 'in_person') && B.ways.some(w => w.kind === 'stream'));
ok('the two doors price independently (€25 in the hall, free on the stream)', B.ways.find(w => w.kind === 'in_person')!.priceCents === 2500 && B.ways.find(w => w.kind === 'stream')!.requiresTicket === false);
ok('a stream seat is always 1 per person (a stream ticket for four is meaningless)', B.ways.find(w => w.kind === 'stream')!.maxPerPerson === 1);

const C = await mk({ location_kind: 'online', fmt_stream: '1', st_cost: 'open', fmt_stream1_url: 'https://yt/x' });
ok('online + open stream → public access, nobody counted', C.ev.admission === 'open' && C.ev.access_mode === 'public');
const D = await mk({ location_kind: 'online', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '9', fmt_stream: '1', st_cost: 'paid', fmt_stream1_price: '5', fmt_stream1_url: 'https://yt/x' });
ok('an online event cannot have an in-person door, whatever was posted', D.ways.every(w => w.kind === 'stream'));
ok('paid stream → event is paid, claim unlocks the link', D.ev.admission === 'paid' && D.ev.access_mode === 'link');

// --- 2. the fan's claim ------------------------------------------------------
const eid = await createScheduledEvent(db, { hostKind: 'athlete', hostId: host, title: 'CAP', startsAt: new Date(Date.now() + 864e5).toISOString(), locationKind: 'hybrid' });
const ip = await addFormat(db, { eventId: eid, kind: 'in_person', label: 'In person', capacity: 2, maxPerPerson: 4, sort: 0 });
const st = await addFormat(db, { eventId: eid, kind: 'stream', label: 'YouTube', capacity: null, maxPerPerson: 1, sort: 1 });
const fan = async (n: string) => (await db.query<any>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`, [n])).rows[0].id;
const [f1, f2, f3, f4] = [await fan('F1'), await fan('F2'), await fan('F3'), await fan('F4')];

const c1 = await createClaim(db, { eventId: eid, fanId: f1, capacity: 2, mode: 'open', formatId: ip, partySize: 2, maxPerPerson: 4 });
ok('a fan can claim more than one spot when the organiser allows it', c1.status === 'claimed' && c1.partySize === 2);
ok('the claim records WHICH door the fan chose', (await db.query<any>(`SELECT format_id FROM claim WHERE id=$1`, [c1.claimId])).rows[0].format_id === ip);

const c2 = await createClaim(db, { eventId: eid, fanId: f2, capacity: 2, mode: 'open', formatId: ip, partySize: 1, maxPerPerson: 4 });
ok('capacity counts PEOPLE not claims — 1 fan × 2 spots fills a 2-spot room', c2.status === 'waitlisted');

// The bug this prevents: capacity was counted event-wide, so a sold-out hall
// would have slammed the stream shut too.
const c3 = await createClaim(db, { eventId: eid, fanId: f3, capacity: null, mode: 'open', formatId: st, partySize: 1, maxPerPerson: 1 });
ok('a full hall does NOT close the stream (capacity is per door)', c3.status === 'claimed');

// A <select> is a suggestion. Anyone can post party_size=99.
const c4 = await createClaim(db, { eventId: eid, fanId: f4, capacity: null, mode: 'open', formatId: st, partySize: 99, maxPerPerson: 1 });
ok('party size is clamped server-side, never trusted from the client', c4.partySize === 1);

const spots = await formatSpots(db, ip, 2);
ok('spots remaining is per door and counts people', spots.taken === 2 && spots.remaining === 0 && spots.full === true);

// --- 3. what the organiser sees ---------------------------------------------
const fc = await formatCounts(db, eid);
const hall = fc.find(x => x.id === ip)!, stream = fc.find(x => x.id === st)!;
ok('the hall count is PEOPLE (F1 brought one), not claims', hall.going === 2);
// This number is what catering and stewards get booked against.
ok('the waitlist is NOT counted as going', hall.going === 2 && hall.waiting === 1);
ok('the stream counts separately from the room', stream.going === 2);

const paidEv = await createScheduledEvent(db, { hostKind: 'athlete', hostId: host, title: 'REV', startsAt: new Date(Date.now() + 864e5).toISOString() });
const pf = await addFormat(db, { eventId: paidEv, kind: 'in_person', label: 'In person', requiresTicket: true, priceCents: 1000, maxPerPerson: 4, sort: 0 });
const f5 = await fan('F5');
await createClaim(db, { eventId: paidEv, fanId: f5, capacity: null, mode: 'open', formatId: pf, partySize: 3, priceCents: 1000, maxPerPerson: 4 });
const rev = (await formatCounts(db, paidEv))[0];
ok('revenue multiplies by party size (3 tickets at €10 = €30, not €10)', rev.revenueCents === 3000 && rev.going === 3);

// --- 4. what the FAN actually sees on the event page ------------------------
// The whole point: on a hybrid event the fan must be offered BOTH doors and get
// to choose — with each door's own price, its own remaining count, and a
// quantity picker only where the organiser allows more than one.
const fanEv = await mk({ location_kind: 'hybrid', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '25', fmt_inperson_cap: '200', fmt_inperson_maxpp: '4', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://yt/x', fmt_stream1_label: 'YouTube' });
const page = await (await fetch(base + '/e/' + fanEv.id + '?guest=1')).text();
ok('the fan is asked to choose how to be there', page.includes('Choose how you want to be there'));
ok('both doors render, each posting its own format', (page.match(/name="format_id"/g) || []).length === 2);
ok('the in-person door shows its price', page.includes('Get ticket · €25'));
ok('the stream door shows separately, free', page.includes('Claim your spot — watch on YouTube'));
ok('each door shows ITS OWN remaining count', page.includes('200 left'));
// Quantity is a STEPPER, not a dropdown: almost everyone takes one ticket, so
// the default state needs no interaction at all and "+" adds a person. It posts
// as party_size_<formatId> — one shared form (so a guest types their details
// ONCE) with a submit button per door means the field must be namespaced, and
// the server reads the one for the door actually submitted.
ok('quantity is a stepper starting at 1, not a dropdown', /name="party_size_[0-9a-f-]+"/.test(page) && page.includes('class="stepin"') && !page.includes('<select name="party_size'));
ok('the stepper has − and + and is capped at the organiser\'s max', page.includes('data-d="-1"') && page.includes('data-d="1"') && page.includes('max="4"'));
ok('the CTA can re-read live with the total (no surprise at checkout)', page.includes('data-unit="2500"') && page.includes('Get {n} tickets'));
ok('stepper buttons are type=button — a + must never submit the form', page.includes('type="button" class="stepbtn"'));
ok('the stream door has no stepper (one seat per person)', (page.match(/class="step"/g) || []).length === 1);
ok('a guest types their name ONCE, not once per door', (page.match(/name="name"/g) || []).length === 1);

// --- 4b. CAPACITY IS PER DOOR, AND THE ORGANISER DECIDES EACH ---------------
// The organiser sets a cap on whichever doors need one — a hall has seats, a
// webinar has a licence limit, a YouTube stream has neither. These are the real
// scenarios, and the invariant across all of them is that the doors never touch
// each other: a sold-out hall must not close the stream, and a stream claim must
// not eat a seat in the room.
const cap1 = await mk({ location_kind: 'hybrid', fmt_inperson: '1', ip_cost: 'paid', fmt_inperson_price: '20', fmt_inperson_cap: '10', fmt_inperson_maxpp: '4', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://yt/x' });
const c1ip = cap1.ways.find(w => w.kind === 'in_person')!, c1st = cap1.ways.find(w => w.kind === 'stream')!;
ok('hall capped, stream left unlimited — each door independently', c1ip.capacity === 10 && c1st.capacity === null);
const buyer3 = await fan('buys3');
await createClaim(db, { eventId: cap1.id, fanId: buyer3, capacity: c1ip.capacity, mode: 'open', formatId: c1ip.id, partySize: 3, maxPerPerson: 4 });
ok('buying 3 tickets takes 3 off the hall (10 → 7), not 1', (await formatSpots(db, c1ip.id, c1ip.capacity)).remaining === 7);
ok('...and leaves the unlimited stream untouched', (await formatSpots(db, c1st.id, c1st.capacity)).remaining === null);
const streamer = await fan('streams');
await createClaim(db, { eventId: cap1.id, fanId: streamer, capacity: c1st.capacity, mode: 'open', formatId: c1st.id, partySize: 1, maxPerPerson: 1 });
ok('a stream claim does NOT consume a seat in the room', (await formatSpots(db, c1ip.id, c1ip.capacity)).remaining === 7);

// A webinar: the cap lives on the STREAM. This was impossible before — stream
// capacity was hardcoded to unlimited.
const web = await mk({ location_kind: 'online', fmt_stream: '1', st_cost: 'paid', fmt_stream1_price: '8', fmt_stream1_url: 'https://zoom/x', fmt_stream1_cap: '2' });
ok('an online event can cap its stream (a webinar licence limit)', web.ways[0].capacity === 2);
const [w1, w2, w3] = [await fan('w1'), await fan('w2'), await fan('w3')];
const wc = [] as string[];
for (const wf of [w1, w2, w3]) wc.push((await createClaim(db, { eventId: web.id, fanId: wf, capacity: web.ways[0].capacity, mode: 'open', formatId: web.ways[0].id, partySize: 1, maxPerPerson: 1 })).status);
ok('a capped stream fills and then waitlists', wc[0] === 'claimed' && wc[1] === 'claimed' && wc[2] === 'waitlisted');

const both = await mk({ location_kind: 'hybrid', fmt_inperson: '1', ip_cost: 'free', fmt_inperson_cap: '1', fmt_stream: '1', st_cost: 'free', fmt_stream1_url: 'https://yt/x', fmt_stream1_cap: '5' });
ok('both doors can be capped, at different numbers', both.ways.find(w => w.kind === 'in_person')!.capacity === 1 && both.ways.find(w => w.kind === 'stream')!.capacity === 5);

// "Open to all" = nobody claims, so there is nothing to count. Storing a cap we
// could never enforce would be a promise we silently break.
const openSt = await mk({ location_kind: 'online', fmt_stream: '1', st_cost: 'open', fmt_stream1_url: 'https://yt/x', fmt_stream1_cap: '50' });
ok('an "open to all" stream ignores a cap it could never enforce', openSt.ways[0].capacity === null);

// --- 5. the form itself ------------------------------------------------------
const form = await (await fetch(base + `/host/athlete/${host}/new`)).text();
ok('the form offers a block per door, not one radio for the event', form.includes('way_ip') && form.includes('way_st') && !form.includes('name="getin"'));
ok('the organiser can let fans bring people', form.includes('fmt_inperson_maxpp') && form.includes('How many can one person claim?'));
ok('the organiser can cap the stream too, not just the room', form.includes('fmt_stream1_cap'));
ok('"open to all" says plainly that you lose the identities', form.includes('not know who watched'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
