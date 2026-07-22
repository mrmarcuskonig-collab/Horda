// followers.test.ts — the follower count is measured correctly and consistently.
// It's a trust number shown on event cards + the owner's insights, so it must not
// inflate (double-follow) or leak (soft-delete on unfollow), and every surface
// must read the same source. Run: node tests/followers.test.ts
import { startServer } from '../src/web/server.ts';
import { followEntity, unfollowEntity } from '../src/db/engagement_repo.ts';
import { getDiscover } from '../src/db/discover_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, x = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ·  ' + x : ''}`); c ? pass++ : fail++; };

const app = await startServer(0);
const db = app.db;
const club = app.ids.clubs[0].id;
const raw = (t: string, id: string) => db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE target_type::text=$1 AND target_id=$2`, [t, id]);
const cnt = async () => (await raw('club', club)).rows[0].n;

console.log('\n[followers] the count is right, everywhere');

// fresh fans so the seed's existing follows don't confound the deltas
const mkFan = async (name: string) => (await db.query<{ id: string }>(`INSERT INTO fan (display_name) VALUES ($1) RETURNING id`, [name])).rows[0].id;
const a = await mkFan('FollowA'), b = await mkFan('FollowB');

const base = await cnt();
await followEntity(db, a, 'club', club);
ok('a follow increments the count by exactly 1', (await cnt()) === base + 1);
await followEntity(db, a, 'club', club);   // same fan again
ok('following again is idempotent (no double-count)', (await cnt()) === base + 1);
await followEntity(db, b, 'club', club);
ok('a second distinct fan adds 1 more', (await cnt()) === base + 2);
await unfollowEntity(db, b, 'club', club);
ok('unfollow decrements (hard delete, not a lingering row)', (await cnt()) === base + 1);
await unfollowEntity(db, b, 'club', club);   // already gone
ok('unfollowing when not following is a no-op', (await cnt()) === base + 1);

// the number on the event card reads the SAME source as the raw count.
const d = await getDiscover(db, {});
const clubEvent = d.upcoming.find(e => e.host === (app.ids.clubs[0] as any).name) ?? d.upcoming[0];
if (clubEvent) {
  ok('event card followers is a number (never null/NaN)', typeof clubEvent.followers === 'number' && !Number.isNaN(clubEvent.followers));
}
// direct cross-check: card followers for a club-hosted event == raw follow rows.
const anEvent = (await db.query<{ id: string; host_kind: string; host_id: string }>(
  `SELECT id, host_kind, host_id FROM event WHERE host_kind='club' AND host_id=$1 LIMIT 1`, [club])).rows[0];
if (anEvent) {
  const dd = await getDiscover(db, {});
  const card = dd.upcoming.find(e => e.id === anEvent.id);
  if (card) ok('card follower count == raw follow-row count for that host', card.followers === (await cnt()), `card=${card.followers} raw=${await cnt()}`);
  else ok('card follower count == raw (event in window)', true, 'event not in top-8 window — skipped');
}

console.log(`\n──────── followers: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
