import { startServer } from './src/web/server.ts';
import { followEntity, unfollowEntity } from './src/db/engagement_repo.ts';
import { getDiscover } from './src/db/discover_repo.ts';

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const club = app.ids.clubs[0].id;
const fan = app.ids.fanId;
const cnt = async () => (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM follow WHERE target_type='club' AND target_id=$1`, [club])).rows[0].n;

const c0 = await cnt();
await followEntity(app.db, fan, 'club', club); const c1 = await cnt();
await followEntity(app.db, fan, 'club', club); const c2 = await cnt();
console.log(`follower count: base=${c0} after1=${c1} afterDouble=${c2}  idempotent=${c1 === c2}`);
await unfollowEntity(app.db, fan, 'club', club); const c3 = await cnt();
console.log(`after unfollow=${c3}  backToBase=${c3 === c0}`);

await followEntity(app.db, fan, 'club', club);
const d = await getDiscover(app.db, {});
const evt = d.upcoming[0];
console.log(`event card followers field type: ${evt ? typeof evt.followers : 'no events'}`);

const evId = (await app.db.query<{ id: string }>(`SELECT id FROM event WHERE host_kind IS NOT NULL LIMIT 1`)).rows[0].id;
const page = await (await fetch(base + '/e/' + evId + '?guest=1')).text();
console.log(`CTA text: I am going=${page.includes("I'm going")}  Claim your spot=${page.includes('Claim your spot')}  Register=${page.includes('Register')}  Get ticket=${page.includes('Get ticket')}`);
await app.close();
process.exit(0);
