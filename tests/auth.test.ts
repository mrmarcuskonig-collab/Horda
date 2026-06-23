// auth.test.ts — real identity: signup → session → ownership → authz, over HTTP.
// Run: node tests/auth.test.ts
import { startServer } from '../src/web/server.ts';
import { signup, verifyLogin, owns } from '../src/db/auth_repo.ts';
import { decideClaim } from '../src/db/claim_repo.ts';

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
ok('logged-in fan CAN act (join form posts to /join, not gated to signup)', athletePage.includes('action="/join"') && athletePage.includes("Raven's Corner"));

console.log('\n[auth · claim is a verified request, not instant ownership]');
const before = await authed(`/club/${club}`);
ok('before claiming, no edit panel on the club', !before.includes('Edit profile (owner)'));
const claimResp = await authed(`/claim/club/${club}`);
ok('claiming opens a verification request (not instant ownership)', claimResp.includes('Claim received'));
const stillGuarded = await authed(`/club/${club}`);
ok('pending claim still shows NO owner edit panel', !stillGuarded.includes('Edit profile (owner)'));
// admin verifies the claim → ownership is granted, owner tools unlock
const sam = (await app.db.query<{ id: string }>(`SELECT id FROM account WHERE email='sam@horda.app'`)).rows[0].id;
const claimId = (await app.db.query<{ id: string }>(`SELECT id FROM claim_request WHERE account_id=$1 AND target_id=$2`, [sam, club])).rows[0].id;
await decideClaim(app.db, claimId, { id: app.ids.demoAccountId, email: 'demo@horda.app', isAdmin: true }, true);
const after = await authed(`/club/${club}`);
ok('after admin verification, the club shows the owner edit panel', after.includes('Edit profile (owner)'));

console.log('\n[auth · logout]');
const lo = await fetch(base + '/logout', { headers: { cookie }, redirect: 'manual' });
ok('logout clears the cookie', (lo.headers.get('set-cookie') ?? '').includes('Max-Age=0'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
