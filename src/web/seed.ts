// seed.ts — a demo world so the app has something to show on boot:
// a boxing idol (Rico) with a record, a callout, and an upcoming fight; a
// football club with a table; and a fan ("You") who follows both.
import type { Database } from '../db/index.ts';
import { applySchema } from '../db/index.ts';
import { getOrCreateSport, getOrCreateVariant, createClubWithTeam, commitResults, commitFixtures } from '../db/repo.ts';
import { createAthlete, createFan, followEntity, createPost, createBout, commitBoutResult, setAthleteProfile, setEventSpectator, addAffiliation } from '../db/engagement_repo.ts';
import { createAssociation, createLeague, assignTeamToLeague, addToTeam, setBranding, getNextFixtureForTeam } from '../db/entity_repo.ts';
import { createScheduledEvent, rsvp, featureEvent, markPaid, getTicketFor, listTicket } from '../db/events_repo.ts';
import { setTier, joinMembership } from '../db/membership_repo.ts';
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
  const b1 = await createBout(db, boxing, bout, rico, tariq, '2025-11-15T20:00:00Z', names[rico], names[tariq]);
  await commitBoutResult(db, b1, bout, rico, tariq, names, { method: 'UD' });
  const b2 = await createBout(db, boxing, bout, rico, otto, '2026-03-08T20:00:00Z', names[rico], names[otto]);
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
  await createPost(db, 'club', cid['FC Beispiel'], 'Dauerkarten für die Rückrunde sind da. Auf geht’s, Horda! 🖤');

  // ---- the fan ("You") follows the idol + the club ----
  const fanId = await createFan(db, 'you', 'You');
  await followEntity(db, fanId, 'athlete', rico);
  await followEntity(db, fanId, 'club', cid['FC Beispiel']);

  await createPost(db, 'athlete', rico, 'Camp is done. June 27 I take the belt. 🐦‍⬛');
  const nextBout = await createBout(db, boxing, bout, rico, max, '2026-06-27T20:00:00Z', names[rico], names[max]);
  await setEventSpectator(db, nextBout, 'free', 'https://tickets.horda.app/rico-max', 'https://stream.horda.app/rico-max');

  // matchday: offer ticket + stream on FC Beispiel's next fixture too
  const nf = await getNextFixtureForTeam(db, tid['FC Beispiel']);
  if (nf) await setEventSpectator(db, nf.eventId, 'free', 'https://tickets.horda.app/fcb', 'https://stream.horda.app/fcb');

  // scheduled (Luma-style) events — one per admission type, across hosts
  const ev1 = await createScheduledEvent(db, { hostKind: 'athlete', hostId: rico, title: 'Open sparring & meet — Kreuzberg BC', startsAt: '2026-06-24T18:00:00Z', location: 'Kreuzberg Boxing Club, Berlin', description: 'Watch the final session before fight night, then stick around for photos. Open to all.', admission: 'open', streams: { youtube: 'https://youtube.com/@ricotheraven/live', twitch: 'https://twitch.tv/ricotheraven' }, capacity: 60 });
  const ev2 = await createScheduledEvent(db, { hostKind: 'club', hostId: cid['FC Beispiel'], title: 'Season launch night', startsAt: '2026-08-01T19:00:00Z', location: 'Vereinsheim, FC Beispiel', description: 'Meet the squad for the new Kreisliga A season. Bratwurst, the new kit, and the fixture reveal.', admission: 'paid', priceCents: 1500, capacity: 200 });
  const ev3 = await createScheduledEvent(db, { hostKind: 'association', hostId: bfv, title: 'Kreisliga A — season opening ceremony', startsAt: '2026-08-08T17:00:00Z', location: 'Rathaus Berlin', description: 'Federation welcome for all clubs entering Kreisliga A. Club delegates apply for seats.', admission: 'apply', capacity: 120 });
  await rsvp(db, fanId, ev1, 'going');

  // cross-posting (feature): the athlete shares a club event; the club shares a federation event
  await featureEvent(db, 'athlete', rico, ev2);
  await featureEvent(db, 'club', cid['FC Beispiel'], ev3);

  // closeness monetization: paid supporter tiers
  await setTier(db, 'athlete', rico, { name: "Raven's Corner", priceCents: 499, currency: 'EUR', perks: ['Members-only fight-week drops', 'Early & discounted tickets', 'Founding member badge'] });
  await setTier(db, 'club', cid['FC Beispiel'], { name: 'Kurve Club', priceCents: 300, currency: 'EUR', perks: ['Members-only matchday vlog', 'Priority tickets', 'Crest badge'] });
  // a members-only drop (FOMO) + a couple of founding members ("You" stays a non-member, so the lock shows)
  await createPost(db, 'athlete', rico, 'Camp diary, week 3 — sparring footage + my game plan for Saturday. Members only. 🔒', undefined, 'members');
  for (const [h, n] of [['ines', 'Ines'], ['karl', 'Karl']] as const) { const f = await createFan(db, h, n); await joinMembership(db, f, 'athlete', rico); }

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
  // usable without login (HORDA_DEMO); real signups get their own scoped identity.
  const demoAccountId = (await db.query<{ id: string }>(`INSERT INTO account (email,display_name) VALUES ('demo@horda.app','You') RETURNING id`)).rows[0].id;
  await db.query(`UPDATE fan SET account_id=$1 WHERE id=$2`, [demoAccountId, fanId]);
  await db.query(`UPDATE athlete SET account_id=$1 WHERE id=$2`, [demoAccountId, rico]);
  await grantOwnership(db, demoAccountId, 'athlete', rico);
  await grantOwnership(db, demoAccountId, 'club', cid['FC Beispiel']);
  await grantOwnership(db, demoAccountId, 'team', tid['FC Beispiel']);
  await grantOwnership(db, demoAccountId, 'association', bfv);

  return {
    fanId, demoAccountId,
    athletes: [{ id: rico, name: names[rico] }, { id: max, name: names[max] }],
    clubs: [{ id: cid['FC Beispiel'], name: 'FC Beispiel' }],
    teams: [{ id: tid['FC Beispiel'], name: 'FC Beispiel' }],
    association: { id: bfv, name: 'Berliner Fußball-Verband' },
    football, v11,
  };
}
