import { startServer } from './src/web/server.ts';
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const origin = base;
// public paid event with a cover + capacity
const club = (await app.db.query(`SELECT id FROM club LIMIT 1`)).rows[0].id;
await app.db.query(`UPDATE club SET region='Berlin' WHERE id=$1`,[club]);
const ev = (await app.db.query(`INSERT INTO event (name, description, starts_at, timezone, location, location_kind, host_kind, host_id, admission, price_cents, currency, capacity, visibility) VALUES ('Berlin Derby Night','Two clubs, one city.', now()+interval '4 days','Europe/Berlin','Poststadion, Berlin','in_person','club',$1,'paid',1500,'EUR',200,'public') RETURNING id`,[club])).rows[0].id;
const page = await (await fetch(`${base}/e/${ev}`)).text();
const m = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
console.log('--- JSON-LD present:', !!m);
if (m) { const j = JSON.parse(m[1]); console.log(JSON.stringify(j, null, 2)); console.log('parses as valid JSON:', typeof j === 'object', '| @type:', j['@type']); }
console.log('--- sitemap includes the event:', (await (await fetch(`${base}/sitemap.xml`)).text()).includes(`/e/${ev}`));
// unlisted must NOT emit JSON-LD
await app.db.query(`UPDATE event SET visibility='unlisted' WHERE id=$1`,[ev]);
const unl = await (await fetch(`${base}/e/${ev}`)).text();
console.log('--- unlisted event emits NO JSON-LD:', !unl.includes('application/ld+json'));
console.log('--- unlisted NOT in sitemap:', !(await (await fetch(`${base}/sitemap.xml`)).text()).includes(`/e/${ev}`));
await app.close();
