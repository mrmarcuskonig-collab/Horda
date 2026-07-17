// tz.test.ts — event time. This suite exists because of a real, shipped bug
// with a physical consequence: fans arriving at the venue an hour late.
//
// WHAT WAS WRONG: <input type="datetime-local"> posts a naive wall-clock string
// ("2030-09-12T20:00", no zone). That went straight to `::timestamptz`, so
// POSTGRES resolved it in whatever zone the SERVER runs in. The stored instant
// depended on the deploy environment, and the page rendered the naive value back
// so it always LOOKED right. The error only appeared where it hurts: the ICS
// export was an hour out, and the fan's calendar sent them to the wrong time.
//
// THE MODEL: an event happens at a PLACE at a WALL-CLOCK time. 20:00 at a
// Kreuzberg gym is 20:00 in Berlin whether you read it from Berlin or Tokyo. We
// store the true instant + the venue's IANA zone, and ALWAYS display in the
// venue's zone, labelled. We never render an event in the viewer's local time.
// Run: node tests/tz.test.ts
import { startServer } from '../src/web/server.ts';
import { zonedToUtc, inZone, zoneLabel, isValidZone, viewerDiffers, icsUtc } from '../src/web/tz.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[tz] wall-clock → instant · venue-local display · calendar export');

// --- 1. the conversion ------------------------------------------------------
const conv: [string, string, string][] = [
  ['2030-09-12T20:00', 'Europe/Berlin', '2030-09-12T18:00:00.000Z'],   // CEST = UTC+2
  ['2030-01-15T20:00', 'Europe/Berlin', '2030-01-15T19:00:00.000Z'],   // CET  = UTC+1
  ['2030-06-01T19:30', 'Europe/London', '2030-06-01T18:30:00.000Z'],   // BST  = UTC+1
  ['2030-06-01T19:30', 'America/New_York', '2030-06-01T23:30:00.000Z'],// EDT  = UTC-4
  ['2030-06-01T19:30', 'Asia/Tokyo', '2030-06-01T10:30:00.000Z'],      // JST  = UTC+9
];
for (const [local, tz, want] of conv) {
  ok(`${local} in ${tz} → ${want}`, zonedToUtc(local, tz).toISOString() === want);
}
// The offset depends on the instant, so a naive single-pass conversion lands on
// the wrong side of a DST jump. These two dates are the boundaries themselves.
ok('DST fall-back day resolves correctly', zonedToUtc('2030-10-27T02:30', 'Europe/Berlin').toISOString() === '2030-10-27T01:30:00.000Z');
ok('DST spring-forward day resolves correctly', zonedToUtc('2030-03-31T03:30', 'Europe/Berlin').toISOString() === '2030-03-31T01:30:00.000Z');
// A client-supplied field is never trusted.
ok('junk zones are rejected, not passed to Intl', !isValidZone('Not/AZone') && !isValidZone('"><script>') && isValidZone('Europe/Berlin'));
ok('an unknown zone falls back to UTC rather than throwing', zonedToUtc('2030-09-12T20:00', 'Bogus/Zone').toISOString() === '2030-09-12T20:00:00.000Z');

// --- 2. display -------------------------------------------------------------
ok('an instant renders in the VENUE zone', inZone('2030-09-12T18:00:00Z', 'Europe/Berlin').includes('20:00'));
ok('the zone is labelled so a fan never assumes their own clock', zoneLabel('2030-09-12T18:00:00Z', 'Europe/Berlin') === 'CEST');
ok('winter labels differ from summer (CET vs CEST)', zoneLabel('2030-01-15T19:00:00Z', 'Europe/Berlin') === 'CET');
ok('a viewer in London is flagged as reading a Berlin event differently', viewerDiffers('Europe/Berlin', 'Europe/London', '2030-09-12T18:00:00Z'));
ok('a viewer in the venue zone is not flagged', !viewerDiffers('Europe/Berlin', 'Europe/Berlin', '2030-09-12T18:00:00Z'));
ok('ICS emits UTC basic format', icsUtc('2030-09-12T18:00:00Z') === '20300912T180000Z');

// --- 3. end to end ----------------------------------------------------------
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const host = app.ids.athletes[0].id;
const mk = async (o: Record<string, string>) => {
  const r = await fetch(base + '/events', {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ host_kind: 'athlete', host_id: host, title: 'TZ', starts_at: '2030-09-12T20:00', location_kind: 'in_person', fmt_inperson: '1', ip_cost: 'free', ...o }).toString(),
  });
  const id = (r.headers.get('location') || '').replace('/e/', '');
  const row = (await app.db.query<any>(`SELECT starts_at, timezone FROM event WHERE id=$1`, [id])).rows[0];
  return { id, iso: new Date(row.starts_at).toISOString(), tz: row.timezone };
};

const berlin = await mk({ timezone: 'Europe/Berlin' });
ok('a Berlin 20:00 is stored as the TRUE instant (18:00Z), not 20:00Z', berlin.iso === '2030-09-12T18:00:00.000Z');
ok('the venue zone is kept on the event', berlin.tz === 'Europe/Berlin');
ok('the event page shows the VENUE time (20:00), not the server\'s', (await (await fetch(base + '/e/' + berlin.id)).text()).includes('20:00'));

// THE BUG, pinned: this is the assertion that would have caught fans arriving late.
const ics = await (await fetch(base + '/e/' + berlin.id + '/ics')).text();
ok('the calendar export is the true instant — a Berlin 20:00 lands at 20:00 in the fan\'s calendar', ics.includes('DTSTART:20300912T180000Z'));

const ny = await mk({ timezone: 'America/New_York' });
ok('a New York 20:00 is a different instant from a Berlin 20:00', ny.iso === '2030-09-13T00:00:00.000Z' && ny.iso !== berlin.iso);

// Old callers (sub-events, scripts) post no zone. They must behave exactly as
// before rather than silently shifting events already advertised to fans.
const legacy = await mk({});
ok('a caller posting no zone is unchanged (no silent shift of live events)', legacy.tz === null);

// The ticket is the thing someone acts on at 19:45 — it must state the zone.
await fetch(base + `/claim/${berlin.id}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '' });
const tok = (await app.db.query<any>(`SELECT pa.token FROM pass pa JOIN claim c ON c.id=pa.claim_id WHERE c.event_id=$1 LIMIT 1`, [berlin.id])).rows[0]?.token;
const passPage = tok ? await (await fetch(base + '/pass/' + tok)).text() : '';
ok('the ticket shows the venue time', passPage.includes('20:00'));
ok('the ticket names the zone (CEST)', passPage.includes('CEST'));
ok('the ticket says the time is venue-local', passPage.includes('Local time at the venue'));

const form = await (await fetch(base + `/host/athlete/${host}/new`)).text();
ok('the create form captures the organiser\'s zone', form.includes('name="timezone"') && form.includes('resolvedOptions'));
ok('the form tells the organiser which zone it is using', form.includes('ev_tzhint'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
