// coorg.test.ts — the co-organizer / versus rework, end to end over HTTP.
// Only the organiser invites the other side; the invitee becomes a co-organiser
// who can add side events but cannot edit the main event.
// Run: node tests/coorg.test.ts
import { startServer } from '../src/web/server.ts';
import { signup, createSession } from '../src/db/auth_repo.ts';
import { isCoOrganizer } from '../src/db/coorg_repo.ts';
import { listParties } from '../src/db/events_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const club = app.ids.clubs[0].id;
const form = (o: Record<string, string>, cookie?: string) => ({ method: 'POST' as const, redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(o).toString() });

console.log('\n[coorg] invite-only other side → co-organizer');

// The demo account (no cookie) owns the seeded club → it's the organiser.
const mk = await fetch(base + '/events', form({
  host_kind: 'club', host_id: club, title: 'Derby Cup', starts_at: '2027-12-01T19:00',
  timezone: 'Europe/Berlin', location_kind: 'in_person', location: 'Berlin', admission: 'open',
  access_mode: 'ticket', archetype: 'versus', side_b_name: 'FC Rival', fmt_inperson: '1', ip_cost: 'open',
}));
const evId = (mk.headers.get('location') || '').match(/[0-9a-f]{8}-[0-9a-f-]+/)?.[0] || '';
ok('organiser created a versus event', !!evId, evId);

const parties = await listParties(app.db, evId);
const sideB = parties.find(p => p.role === 'side' && p.side === 'B');
ok('event has an unclaimed side B (the rival)', !!sideB && sideB.status === 'unclaimed');

// Guest / non-organiser cannot open-claim: the event page shows no claim-side form.
const guestPage = await (await fetch(base + `/e/${evId}?guest=1`)).text();
ok('the rival side is NOT open-claimable by a guest', !guestPage.includes('/party/') || !guestPage.includes('Claim this side'));
ok('"A vs B" shows under the title', /class="pversus"/.test(guestPage) && guestPage.includes('FC Rival'));

// Organiser mints the private invite link.
const invResp = await fetch(base + `/e/${evId}/party/${sideB!.id}/invite`, form({}));  // no cookie = demo = organiser
const invBody = await invResp.text();
const inviteToken = invBody.match(/join-side\?invite=(i[a-f0-9]+)/)?.[1] || '';
ok('organiser gets a private invite link for the rival side', !!inviteToken, inviteToken.slice(0, 10) + '…');

// A brand-new person accepts. (Guests get redirected to sign up; here we model
// the post-signup state: a real account with a session.)
const invitee = await signup(app.db, `rival_${Date.now()}@x.io`, 'Rival Manager', 'pw123456');
const cookie = `hz_session=${await createSession(app.db, invitee!.accountId)}`;

const acceptPage = await (await fetch(base + `/e/${evId}/join-side?invite=${inviteToken}`, { headers: { cookie } })).text();
ok('invitee sees the accept page', /invited to co-organise/i.test(acceptPage));

const acceptResp = await fetch(base + `/e/${evId}/join-side`, form({ invite: inviteToken }, cookie));
ok('accepting redirects to the event', acceptResp.status === 303 && (acceptResp.headers.get('location') || '').includes(`/e/${evId}`));
ok('the invitee is now a co-organizer', await isCoOrganizer(app.db, evId, invitee!.accountId));

// A co-organizer can promote (their own link) and see stats, but CANNOT add
// bouts or edit the main event — only the main organiser can.
const coOrgView = await (await fetch(base + `/e/${evId}`, { headers: { cookie } })).text();
ok('co-organizer does NOT see "Add a bout" (main organiser only)', !coOrgView.includes('Add a bout'));
ok('co-organizer sees the "You\'re co-organising" panel', coOrgView.includes("You're co-organising"));
ok('co-organizer gets their own promo/share link (?p=)', /\/e\/[^"?]+\?p=p[a-f0-9]+/.test(coOrgView));
ok('co-organizer sees event stats (going)', /Event so far/.test(coOrgView) && coOrgView.includes('going'));
ok('co-organizer does NOT get the host-only "Manage" affordance', !coOrgView.includes(`/manage/${evId}`));

// The MAIN organiser still can add a bout.
const hostView = await (await fetch(base + `/e/${evId}`)).text();  // no cookie = demo = host
ok('the main organiser sees "Add a bout / sub-event"', hostView.includes('Add a bout'));

// A random logged-in fan is NOT a co-organizer and sees neither.
const rando = await signup(app.db, `rando_${Date.now()}@x.io`, 'Rando', 'pw123456');
const rcookie = `hz_session=${await createSession(app.db, rando!.accountId)}`;
const randoView = await (await fetch(base + `/e/${evId}`, { headers: { cookie: rcookie } })).text();
ok('a random fan cannot add a bout and sees no co-organiser panel', !randoView.includes('Add a bout') && !randoView.includes("You're co-organising"));

// Same-day rule: a sub-event created on a different date is pulled onto the main day.
const sub = await fetch(base + '/events', form({
  host_kind: 'club', host_id: club, title: 'Undercard', starts_at: '2028-03-15T17:00',
  timezone: 'Europe/Berlin', location_kind: 'in_person', location: 'Berlin', admission: 'open',
  access_mode: 'ticket', parent_id: evId, fmt_inperson: '1', ip_cost: 'open',
}));
const subId = (sub.headers.get('location') || '').match(/[0-9a-f]{8}-[0-9a-f-]+/)?.[0] || '';
const subDay = (await app.db.query<{ d: string }>(`SELECT to_char(starts_at,'YYYY-MM-DD') d FROM event WHERE id=$1`, [subId])).rows[0]?.d;
const mainDay = (await app.db.query<{ d: string }>(`SELECT to_char(starts_at,'YYYY-MM-DD') d FROM event WHERE id=$1`, [evId])).rows[0]?.d;
ok('a sub-event is forced onto the main event\'s day (not its own date)', !!subDay && subDay === mainDay, `sub=${subDay} main=${mainDay}`);

console.log(`\n──────── coorg: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
