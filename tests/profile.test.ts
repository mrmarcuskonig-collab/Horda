// profile.test.ts — the profile hub work: followable sports, the Settings→Account
// restructure (editable username with uniqueness, phone, sign-out, delete gating),
// and the Luma-style notification preferences. Run: node tests/profile.test.ts
import { startServer } from '../src/web/server.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const get = (p: string) => fetch(base + p).then(r => r.text());
const post = (p: string, body: Record<string, string>) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });

console.log('\n[profile] followable sports · account settings · notification prefs');

// --- item 2: followable sports ---
await post('/follow', { target_type: 'sport', target_id: 'esports' });
const fol = await get('/following');
ok('a sport can be followed and shows under a Sports group', fol.includes('Esports') && /Sports · \d/.test(fol));
ok('Following describes sports too', fol.includes('sports') || fol.includes('Sports'));
await post('/unfollow', { target_type: 'sport', target_id: 'esports' });
ok('a sport can be unfollowed', !(await get('/following')).includes('>Esports<'));

// --- followable cities / regions (search Berlin → follow the city) ---
const rsearch = await get('/following?q=Berlin');
ok('searching a city surfaces it as a followable City / region', rsearch.includes('Berlin') && rsearch.includes('City / region'));
await post('/follow', { target_type: 'region', target_id: 'Berlin' });
const rfol = await get('/following');
ok('a followed city shows under a "Cities & regions" group', /Cities &amp; regions · \d/.test(rfol) && rfol.includes('Berlin'));
await post('/unfollow', { target_type: 'region', target_id: 'Berlin' });
ok('a city can be unfollowed', !(await get('/following')).includes('Cities &amp; regions'));

// --- item 1: e-sports + digital sports categories ---
const disc = await get('/?guest=1');
ok('discover surfaces Esports + Digital sports chips', disc.includes('Esports') && disc.includes('Digital sports'));

// --- item 3c: account settings ---
const set = await get('/settings');
ok('Account has editable name + username + email + phone', set.includes('name="username"') && set.includes('name="name"') && set.includes('action="/account/phone"') && (set.includes('@') || set.includes('Email')));
ok('security is magic-link (no password field), with log-out-everywhere', set.includes('passwordless') && set.includes('/account/signout-all') && !set.includes('type="password"'));
ok('Reserve a handle is gone from settings', !set.includes('Reserve a handle'));

// username edit + uniqueness
const r1 = await post('/account/profile', { name: 'Marcus K', username: 'marcus_pro' });
ok('changing username succeeds', (r1.headers.get('location') || '').includes('ok='));
ok('the username actually changed', (await app.db.query<{ handle: string }>(`SELECT handle FROM fan WHERE id=$1`, [app.ids.fanId])).rows[0].handle === 'marcus_pro');
await app.db.query(`INSERT INTO fan (handle,display_name) VALUES ('someone_else','X')`);
const r2 = await post('/account/profile', { username: 'someone_else' });
ok('a taken username is rejected', (r2.headers.get('location') || '').includes('err='));
const r3 = await post('/account/profile', { username: 'no' });
ok('an invalid username is rejected', (r3.headers.get('location') || '').includes('err='));

// phone
await post('/account/phone', { phone: '+49 170 000' });
ok('phone saves', (await app.db.query<{ phone: string | null }>(`SELECT phone FROM account WHERE id=$1`, [app.ids.demoAccountId])).rows[0].phone === '+49 170 000');

// delete gated when you own pages (demo owns the seed entities)
ok('delete account is gated behind removing pages first', set.includes('remove or transfer them first') || set.includes('Remove or transfer'));

// --- item 3c: subtitle removed from Your events ---
const fan = await get(`/fan/${app.ids.fanId}`);
ok('the "following N · Record" subtitle is gone from Your events', !/following \d+ · <a href="\/record"/.test(fan));
ok('the hub top selector links to Notifications + Settings', fan.includes('/notifications/settings">Notifications') && fan.includes('/settings">Settings'));

// --- item 3d: Luma-style notification preferences ---
const prefs = await get('/notifications/settings');
ok('notification prefs is grouped like Luma', prefs.includes('Events you attend') && prefs.includes('Events you host') && prefs.includes('Pages you manage'));
ok('each row has a channel toggle', (prefs.match(/type="checkbox"/g) || []).length >= 6);
await post('/notifications/settings', { invites: 'on', updates: 'on' });   // turns others off
const off = (await app.db.query<{ category: string }>(`SELECT category FROM notification_pref WHERE enabled=false`)).rows.map(r => r.category);
ok('turning a category off persists', off.includes('reminders') && off.includes('blasts'));
ok('a kept category stays on', !off.includes('invites'));

// --- Profile tab: the athlete photo/background/section editors on one hub tab ---
const ath = app.ids.athletes[0].id;
const cust = await get(`/athlete/${ath}/customize`);
ok('the editor is the "Profile" tab (hub tab bar, Profile active) and clearly edits the athlete page', cust.includes('class="proftop"') && /class="pt active"[^>]*>Profile</.test(cust) && cust.includes('<h1>Edit your athlete page</h1>') && cust.includes("You're editing"));
ok('Profile tab holds photo + background + sections editors together', cust.includes('Profile photo') && cust.includes('Banner photo') && cust.includes('>Sections<'));
ok('the hub top selector links to the Profile tab for creators', /class="pt"[^>]*\/customize[^>]*>Profile</.test(fan));
ok('Settings + Notification prefs share the same hub tab bar', set.includes('class="proftop"') && (await get('/notifications/settings')).includes('class="proftop"'));

// --- Settings trimmed: no redundant "Your profile" / "You" groups ---
const set2 = await get('/settings');
const groups = [...set2.matchAll(/class="seth">([^<]+)</g)].map(m => m[1]);
ok('Settings drops the "Your profile" and "You" groups (they’re tabs now)', !groups.includes('Your profile') && !groups.includes('You'));
ok('Settings keeps Account + Support', groups.includes('Account') && groups.includes('Support'));

// --- dynamic username availability ---
await app.db.query(`INSERT INTO fan (handle,display_name) VALUES ('livetaken','X')`);
const jt = await get('/account/username-available?u=livetaken').then(r => JSON.parse(r));
const jf = await get('/account/username-available?u=deffreehandle').then(r => JSON.parse(r));
const jb = await get('/account/username-available?u=no').then(r => JSON.parse(r));
ok('availability endpoint marks a taken handle unavailable', jt.valid === true && jt.available === false);
ok('availability endpoint marks a free handle available', jf.valid === true && jf.available === true);
ok('availability endpoint rejects an invalid handle', jb.valid === false);
ok('the settings username field wires up the live check', set2.includes('id="unamefield"') && set2.includes('/account/username-available') && set2.includes('id="unamestatus"'));

console.log(`\n──────── profile: ${pass} passed, ${fail} failed ────────`);
await app.close();
process.exit(fail ? 1 : 0);
