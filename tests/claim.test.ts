// claim.test.ts — claiming is a verified request, never instant ownership.
// Covers: email-domain auto-verify, channel-code (fail then pass), admin review,
// association vouching, and that strangers can neither edit nor approve.
// Run: node tests/claim.test.ts
import { startServer } from '../src/web/server.ts';
import { signup, owns } from '../src/db/auth_repo.ts';
import { grantOwnership } from '../src/db/auth_repo.ts';
import { createClubWithTeam } from '../src/db/repo.ts';
import { setBranding, createAssociation, createLeague, assignTeamToLeague } from '../src/db/entity_repo.ts';
import { requestClaim, verifyByChannelCode, listClaimsForReviewer, decideClaim, getClaimFor } from '../src/db/claim_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, cond: boolean) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${n}`); cond ? pass++ : fail++; };

const app = await startServer(0);
const db = app.db;
const football = app.ids.football!;
const v11 = app.ids.v11!;
const acct = async (email: string) => (await signup(db, email, email.split('@')[0], 'pw123456'))!.accountId;

console.log('\n[claim] verification');

// helper: a fresh unclaimed club with an official website on file
async function freshClub(name: string, site: string | null) {
  const { clubId } = await createClubWithTeam(db, name, football);
  if (site) await setBranding(db, 'club', clubId, { links: { website: site } });
  return clubId;
}

// 1) EMAIL-DOMAIN AUTO-VERIFY -------------------------------------------------
{
  const club = await freshClub('FC Domain', 'https://www.fcdomain.de');
  const boss = await acct('boss@fcdomain.de');
  ok('before claim: not an owner', !(await owns(db, boss, 'club', club)));
  const r = await requestClaim(db, { id: boss, email: 'boss@fcdomain.de' }, 'club', club);
  ok('matching email domain → auto-verified', r.status === 'verified' && r.method === 'email_domain');
  ok('email-domain claim grants ownership', await owns(db, boss, 'club', club));
  const cs = (await db.query<{ claim_status: string }>(`SELECT claim_status FROM club WHERE id=$1`, [club])).rows[0];
  ok('club marked claimed', cs.claim_status === 'claimed');
}

// 2) NO MATCH → PENDING, NO OWNERSHIP; CHANNEL CODE (fail then pass) ----------
{
  const club = await freshClub('FC Channel', 'https://fcchannel.de');
  const rando = await acct('someone@gmail.com');
  const r = await requestClaim(db, { id: rando, email: 'someone@gmail.com' }, 'club', club);
  ok('mismatched email → pending (not granted)', r.status === 'pending' && !!r.code);
  ok('pending claim gives NO ownership', !(await owns(db, rando, 'club', club)));
  const claim = (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE account_id=$1 AND target_id=$2`, [rando, club])).rows[0];
  // re-check with a site that does NOT contain the code → stays pending
  const noCode = await verifyByChannelCode(db, claim.id, async () => '<html>nothing here</html>');
  ok('channel-code recheck fails when code absent', noCode === false && !(await owns(db, rando, 'club', club)));
  // re-check with the code present on the "site" → verified
  const yesCode = await verifyByChannelCode(db, claim.id, async () => `<html><meta>${r.code}</meta></html>`);
  ok('channel-code recheck passes when code present', yesCode === true);
  ok('channel-code verification grants ownership', await owns(db, rando, 'club', club));
}

// 3) ADMIN REVIEW QUEUE -------------------------------------------------------
{
  const club = await freshClub('FC NoSite', null);   // no website → must be reviewed
  const claimant = await acct('hopeful@outlook.com');
  await requestClaim(db, { id: claimant, email: 'hopeful@outlook.com' }, 'club', club);
  const admin = { id: app.ids.demoAccountId, email: 'demo@furia.app', isAdmin: true };
  const queue = await listClaimsForReviewer(db, admin);
  ok('admin sees the pending claim in the queue', queue.some(c => c.targetId === club));
  // a normal non-admin sees nothing of it
  const nobody = { id: await acct('nobody@x.com'), email: 'nobody@x.com', isAdmin: false };
  ok('non-admin / non-governor sees no queue entry for it', !(await listClaimsForReviewer(db, nobody)).some(c => c.targetId === club));
  ok('non-reviewer cannot approve', !(await decideClaim(db, (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE target_id=$1`, [club])).rows[0].id, nobody, true)));
  ok('and still not an owner after a blocked approve', !(await owns(db, claimant, 'club', club)));
  const cid = (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE target_id=$1`, [club])).rows[0].id;
  ok('admin approve grants ownership', (await decideClaim(db, cid, admin, true)) && await owns(db, claimant, 'club', club));
}

// 4) ADMIN REJECT -------------------------------------------------------------
{
  const club = await freshClub('FC Reject', null);
  const claimant = await acct('chancer@x.com');
  await requestClaim(db, { id: claimant, email: 'chancer@x.com' }, 'club', club);
  const cid = (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE target_id=$1`, [club])).rows[0].id;
  const admin = { id: app.ids.demoAccountId, email: 'demo@furia.app', isAdmin: true };
  ok('admin reject succeeds', await decideClaim(db, cid, admin, false));
  ok('rejected claimant gets no ownership', !(await owns(db, claimant, 'club', club)));
  ok('claim recorded as rejected', (await getClaimFor(db, claimant, 'club', club))?.status === 'rejected');
}

// 5) ASSOCIATION VOUCHING -----------------------------------------------------
{
  const assoc = await createAssociation(db, 'tsv-test', 'TSV Test-Verband');
  const league = await createLeague(db, 'Kreisliga Z', football, v11, assoc);
  const { clubId, teamId } = await createClubWithTeam(db, 'SV Governed', football);
  await assignTeamToLeague(db, teamId, league);

  const assocOwner = { id: await acct('chair@tsv-test.de'), email: 'chair@tsv-test.de', isAdmin: false };
  await grantOwnership(db, assocOwner.id, 'association', assoc);

  const claimant = await acct('coach@svgoverned.de');
  await requestClaim(db, { id: claimant, email: 'coach@svgoverned.de' }, 'club', clubId);
  const cid = (await db.query<{ id: string }>(`SELECT id FROM claim_request WHERE target_id=$1`, [clubId])).rows[0].id;

  ok('governing association owner sees the member-club claim', (await listClaimsForReviewer(db, assocOwner)).some(c => c.targetId === clubId));
  const unrelated = { id: await acct('rival@other.de'), email: 'rival@other.de', isAdmin: false };
  ok('an unrelated association owner does NOT see it', !(await listClaimsForReviewer(db, unrelated)).some(c => c.targetId === clubId));
  ok('association owner can vouch (approve) → ownership granted', (await decideClaim(db, cid, assocOwner, true)) && await owns(db, claimant, 'club', clubId));
}

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
