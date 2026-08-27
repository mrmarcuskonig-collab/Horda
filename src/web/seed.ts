// seed.ts — a demo world so the app has something to show on boot:
// a boxing idol (Rico) with a record, a callout, and an upcoming fight; a
// football club with a table; and a fan ("You") who follows both.
import type { Database } from '../db/index.ts';
import { applySchema } from '../db/index.ts';
import { getOrCreateSport, getOrCreateVariant, createClubWithTeam, commitResults, commitFixtures } from '../db/repo.ts';
import { createAthlete, createFan, followEntity, createPost, createBout, commitBoutResult, setAthleteProfile, setEventSpectator, addAffiliation } from '../db/engagement_repo.ts';
import { createAssociation, createLeague, assignTeamToLeague, addToTeam, setBranding, getNextFixtureForTeam } from '../db/entity_repo.ts';
import { createScheduledEvent, rsvp, featureEvent, markPaid, getTicketFor, listTicket } from '../db/events_repo.ts';
import { grantOwnership } from '../db/auth_repo.ts';
import { ingestUserUpload } from '../pipeline/index.ts';

export interface DemoIds {
  fanId: string;
  demoAccountId: string;
  athletes: { id: string; name: string }[];
  clubs: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  association: { id: string; name: string };
  football: string; v11: string;
}

// Demo dates are RELATIVE TO NOW, never absolute. An absolute date is a time
// bomb: the seeded "Season launch night" was pinned to 2026-08-01, and on
// 2026-08-02 the demo silently started showing its flagship paid event as
// already finished — the event page drops the price and the claim CTA for a
// past event, and tests/web.test.ts went red on its own with nobody touching
// the code. Offsets keep the demo world alive on whatever day it is opened.
const DAY_MS = 86_400_000;
/** ISO timestamp `days` from now (negative = past), at `hourUtc` on the hour. */
function at(days: number, hourUtc: number): string {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}
/** "27 August" — for demo copy that has to name the date in prose. */
function prose(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export async function seedDemo(db: Database): Promise<DemoIds> {
  await applySchema(db);

  // ---- boxing: the idol surface ----
  const boxing = await getOrCreateSport(db, 'boxing', 'Boxing');
  const bout = await getOrCreateVariant(db, boxing, 'bout', 'Bout', 'individual', 'matchup');
  const rico = await createAthlete(db, "Rico 'The Raven' Vargas", 'rico');
  await setAthleteProfile(db, rico, {
    tagline: 'Southpaw out of Kreuzberg. Welterweight. I don’t miss.',
    links: { instagram: 'https://instagram.com/ricotheraven', x: 'https://x.com/ricotheraven', tiktok: 'https://tiktok.com/@ricotheraven', youtube: 'https://youtube.com/@ricotheraven', website: 'https://ricovargas.box' },
  });
  // affiliations the athlete CHOSE to show (clubs/teams/leagues/gym/promotion/events)
  await addAffiliation(db, rico, 'gym', 'Kreuzberg Boxing Club', '#', 1);
  await addAffiliation(db, rico, 'league', 'WBO Welterweight', '#', 2);
  await addAffiliation(db, rico, 'promotion', 'Raven Promotions', '#', 3);
  await addAffiliation(db, rico, 'event', 'Berlin Fight Night XII', '#', 4);
  const tariq = await createAthlete(db, 'Tariq Bello', 'tariq');
  const otto = await createAthlete(db, 'Otto Kahn', 'otto');
  const max = await createAthlete(db, 'Max Stein', 'max');
  const names: Record<string, string> = { [rico]: "Rico 'The Raven' Vargas", [tariq]: 'Tariq Bello', [otto]: 'Otto Kahn', [max]: 'Max Stein' };

  // two past wins -> record 2-0 (settled before anyone follows, so no stale notifications)
  const b1 = await createBout(db, boxing, bout, rico, tariq, at(-261, 20), names[rico], names[tariq]);
  await commitBoutResult(db, b1, bout, rico, tariq, names, { method: 'UD' });
  const b2 = await createBout(db, boxing, bout, rico, otto, at(-148, 20), names[rico], names[otto]);
  await commitBoutResult(db, b2, bout, rico, otto, names, { method: 'KO', round: 5 });

  // ---- football: a club surface ----
  const football = await getOrCreateSport(db, 'football', 'Football');
  const v11 = await getOrCreateVariant(db, football, '11_a_side', '11-a-side', 'team', 'matchup');
  const clubNames = ['FC Beispiel', 'TSV Musterstadt', 'SV Example', 'SpVgg Altdorf', 'Berliner SC'];
  const tid: Record<string, string> = {}; const cid: Record<string, string> = {};
  for (const n of clubNames) { const x = await createClubWithTeam(db, n, football); tid[n] = x.teamId; cid[n] = x.clubId; }
  const known = clubNames.map(n => ({ id: tid[n], name: n }));
  const r = ingestUserUpload({ text: `
FC Beispiel 3-1 TSV Musterstadt
SV Example 2:2 FC Beispiel
SpVgg Altdorf 0-4 FC Beispiel
Berliner SC 1-3 FC Beispiel
TSV Musterstadt 1-1 SV Example
SpVgg Altdorf 2-2 Berliner SC`, mode: 'results', known, sportKey: 'football', variantKey: '11_a_side' });
  const f = ingestUserUpload({ text: `
Sa 28.06. 15:00 FC Beispiel – TSV Musterstadt
05.07 Berliner SC vs FC Beispiel 16:00`, mode: 'fixtures', known, sportKey: 'football', variantKey: '11_a_side' });
  await commitResults(db, r, football, v11);
  await commitFixtures(db, f, football, v11);

  // an association sanctions a league; the teams join it (drives the association's member lists)
  const bfv = await createAssociation(db, 'bfv', 'Berliner Fußball-Verband');
  const kreisliga = await createLeague(db, 'Kreisliga A', football, v11, bfv);
  for (const n of clubNames) await assignTeamToLeague(db, tid[n], kreisliga);

  // FC Beispiel's squad — players self-create, then join the roster
  for (const s of ['Jonas Weber', 'Luka Petrović', 'Emre Demir', 'Finn Albrecht']) {
    const a = await createAthlete(db, s); await addToTeam(db, a, tid['FC Beispiel']);
  }

  // owner-controlled branding for the club, its team, and the association
  await setBranding(db, 'club', cid['FC Beispiel'], { tagline: 'Kreuzberg · gegründet 1924 · Kreisliga A', links: { instagram: 'https://instagram.com/fcbeispiel', x: 'https://x.com/fcbeispiel', website: 'https://fcbeispiel.de' } });
  await setBranding(db, 'team', tid['FC Beispiel'], { tagline: '1. Herren · Kreisliga A', links: { instagram: 'https://instagram.com/fcbeispiel1' } });
  await setBranding(db, 'association', bfv, { tagline: 'Governing body for Berlin football.', links: { website: 'https://berlinerfv.de', x: 'https://x.com/berlinerfv' } });

  // a club broadcast (the hub speaks — author is the club, never a fan)
  await createPost(db, 'club', cid['FC Beispiel'], 'Dauerkarten für die Rückrunde sind da. Auf geht’s, Furia! 🖤');

  // ---- the fan ("You") follows the idol + the club ----
  const fanId = await createFan(db, 'you', 'You');
  await followEntity(db, fanId, 'athlete', rico);
  await followEntity(db, fanId, 'club', cid['FC Beispiel']);

  const boutDate = at(24, 20);
  await createPost(db, 'athlete', rico, `Camp is done. ${prose(boutDate)} I take the belt. 🐦‍⬛`);
  const nextBout = await createBout(db, boxing, bout, rico, max, boutDate, names[rico], names[max]);
  await setEventSpectator(db, nextBout, 'free', 'https://tickets.joinfuria.com/rico-max', 'https://stream.joinfuria.com/rico-max');

  // matchday: offer ticket + stream on FC Beispiel's next fixture too
  const nf = await getNextFixtureForTeam(db, tid['FC Beispiel']);
  if (nf) await setEventSpectator(db, nf.eventId, 'free', 'https://tickets.joinfuria.com/fcb', 'https://stream.joinfuria.com/fcb');

  // scheduled (Luma-style) events — one per admission type, across hosts
  const ev1 = await createScheduledEvent(db, { hostKind: 'athlete', hostId: rico, title: 'Open sparring & meet — Kreuzberg BC', startsAt: at(21, 18), location: 'Kreuzberg Boxing Club, Berlin', description: 'Watch the final session before fight night, then stick around for photos. Open to all.', admission: 'open', streams: { youtube: 'https://youtube.com/@ricotheraven/live', twitch: 'https://twitch.tv/ricotheraven' }, capacity: 60 });
  const ev2 = await createScheduledEvent(db, { hostKind: 'club', hostId: cid['FC Beispiel'], title: 'Season launch night', startsAt: at(10, 19), location: 'Vereinsheim, FC Beispiel', description: 'Meet the squad for the new Kreisliga A season. Bratwurst, the new kit, and the fixture reveal.', admission: 'paid', priceCents: 1500, capacity: 200 });
  const ev3 = await createScheduledEvent(db, { hostKind: 'association', hostId: bfv, title: 'Kreisliga A — season opening ceremony', startsAt: at(17, 17), location: 'Rathaus Berlin', description: 'Federation welcome for all clubs entering Kreisliga A. Club delegates apply for seats.', admission: 'apply', capacity: 120 });
  await rsvp(db, fanId, ev1, 'going');

  // cross-posting (feature): the athlete shares a club event; the club shares a federation event
  await featureEvent(db, 'athlete', rico, ev2);
  await featureEvent(db, 'club', cid['FC Beispiel'], ev3);

  // (Fan tier/superfan seeding removed 28 Jul 2026 — the fan → athlete
  // subscription system was retired. A couple of public posts stay for the feed.)
  await createPost(db, 'athlete', rico, 'Camp diary, week 3 — game plan notes for Saturday.', undefined, 'public');
  await createPost(db, 'athlete', rico, 'Full sparring footage + corner audio from today’s session.', undefined, 'public');
  const maja = await createFan(db, 'maja', 'Maja');
  await followEntity(db, maja, 'athlete', rico);

  // tickets: a reseller holds one and lists it ("You" stays unpaid so the buy flow shows)
  const seller = await createFan(db, 'rieke', 'Rieke');
  await markPaid(db, ev2, seller);
  const st = await getTicketFor(db, ev2, seller);
  if (st) await listTicket(db, st.id, 1800);

  // regions — for the start-screen taste filter (beachhead set)
  const clubRegion: Record<string, string> = { 'FC Beispiel': 'Berlin', 'TSV Musterstadt': 'Hamburg', 'SV Example': 'Cologne', 'SpVgg Altdorf': 'Bavaria', 'Berliner SC': 'Berlin' };
  for (const [n, reg] of Object.entries(clubRegion)) await db.query(`UPDATE club SET region=$2 WHERE id=$1`, [cid[n], reg]);
  await db.query(`UPDATE athlete SET region='Berlin' WHERE id=$1`, [rico]);
  await db.query(`UPDATE athlete SET region='Hamburg' WHERE id=$1`, [max]);
  await db.query(`UPDATE athlete SET region='Cologne' WHERE id=$1`, [tariq]);
  await db.query(`UPDATE athlete SET region='Bavaria' WHERE id=$1`, [otto]);

  // demo account: the "You" fan + owner of the seeded entities. Keeps the app
  // usable without login (FURIA_DEMO); real signups get their own scoped identity.
  const demoAccountId = (await db.query<{ id: string }>(`INSERT INTO account (email,display_name,is_admin) VALUES ('demo@furia.app','You',true) RETURNING id`)).rows[0].id;
  await db.query(`UPDATE fan SET account_id=$1 WHERE id=$2`, [demoAccountId, fanId]);
  await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [demoAccountId, rico]);
  await grantOwnership(db, demoAccountId, 'athlete', rico);
  await grantOwnership(db, demoAccountId, 'club', cid['FC Beispiel']);
  await grantOwnership(db, demoAccountId, 'team', tid['FC Beispiel']);
  await grantOwnership(db, demoAccountId, 'association', bfv);

  // an active entity connection so the athlete page shows a "Clubs & Leagues" card
  await db.query(`INSERT INTO entity_link (child_kind, child_id, parent_kind, parent_id, role, status, requested_by) VALUES ('athlete',$1,'club',$2,'player','active','child') ON CONFLICT DO NOTHING`, [rico, cid['FC Beispiel']]);
  await db.query(`INSERT INTO entity_link (child_kind, child_id, parent_kind, parent_id, role, status, requested_by) VALUES ('club',$1,'association',$2,'member','active','child') ON CONFLICT DO NOTHING`, [cid['FC Beispiel'], bfv]);

  return {
    fanId, demoAccountId,
    athletes: [{ id: rico, name: names[rico] }, { id: max, name: names[max] }],
    clubs: [{ id: cid['FC Beispiel'], name: 'FC Beispiel' }],
    teams: [{ id: tid['FC Beispiel'], name: 'FC Beispiel' }],
    association: { id: bfv, name: 'Berliner Fußball-Verband' },
    football, v11,
  };
}
