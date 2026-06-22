// auth.test.ts — real identity: signup → session → ownership → authz, over HTTP.
// Run: node tests/auth.test.ts
import { startServer } from '../src/web/server.ts';
import { signup, verifyLogin, owns } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const rico = app.ids.athletes[0].id;
const club = app.ids.clubs[0].id;
const enc = (o: Record<string, string>) => new URLSearchParams(o);

console.log('\n[auth · repo basics]');
const made = await signup(app.db, 'unit@horda.app', 'Unit', 'secret123');
ok('signup creates an account + fan', !!made?.accountId && !!made?.fanId);
ok('correct password verifies', (await verifyLogin(app.db, 'unit@horda.app', 'secret123')) === made!.accountId);
ok('wrong password rejected', (await verifyLogin(app.db, 'unit@horda.app', 'nope')) === null);
ok('duplicate email refused', (await signup(app.db, 'unit@horda.app', 'Dup', 'x')) === null);
ok('new account owns nothing', !(await owns(app.db, made!.accountId, 'athlete', rico)));

console.log('\n[auth · signup over HTTP sets a session]');
const sres = await fetch(base + '/signup', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc({ email: 'sam@horda.app', name: 'Sam', password: 'secret123', next: '/' }) });
const setCookie = sres.headers.get('set-cookie') ?? '';
ok('signup sets an hz_session cookie + redirects', setCookie.includes('hz_session=') && sres.status === 303);
const cookie = setCookie.split(';')[0];
const authed = (p: string) => fetch(base + p, { headers: { cookie } }).then(r => r.text());

console.log('\n[auth · a fan owns nothing → no owner tools, but can engage]');
const athletePage = await authed(`/athlete/${rico}`);
ok('logged-in fan does NOT see the owner edit panel', !athletePage.includes('Edit profile (owner)'));
ok('logged-in fan CAN act (become a member shown, not gated to signup)', athletePage.includes('Become a member') && athletePage.includes('action="/join"'));

console.log('\n[auth · claim grants ownership → owner tools appear]');
const before = await authed(`/club/${club}`);
ok('before claiming, no edit panel on the club', !before.includes('Edit profile (owner)'));
await fetch(base + `/claim/club/${club}`, { headers: { cookie }, redirect: 'manual' });
const after = await authed(`/club/${club}`);
ok('after claiming, the club shows the owner edit panel', after.includes('Edit profile (owner)'));

console.log('\n[auth · logout]');
const lo = await fetch(base + '/logout', { headers: { cookie }, redirect: 'manual' });
ok('logout clears the cookie', (lo.headers.get('set-cookie') ?? '').includes('Max-Age=0'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
