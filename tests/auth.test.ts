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
ok('logged-in fan CAN act (follow form posts to /follow, not gated to signup)', athletePage.includes('action="/follow"') && athletePage.includes('crowd'));

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

console.log('\n[auth · passwordless magic link + OTP (Build Order item 1)]');
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc(o) });
// signup/login pages are now email-first (magic link primary)
const loginPage = await fetch(base + '/login').then(r => r.text());
ok('login is email-first (magic link primary, password is a fallback)', loginPage.includes('/auth/start') && loginPage.includes('sign-in link') && loginPage.includes('Use a password instead'));
// start a magic link for a brand-new email → dev mode surfaces link + code
const mlEmail = 'magic_' + Date.now() + '@horda.app';
const startPage = await fetch(base + '/auth/start', post({ email: mlEmail })).then(r => r.text());
const mlTok = (startPage.match(/\/auth\/verify\?token=([a-f0-9-]+)/) || [])[1] || '';
const mlCode = (startPage.match(/Code: <b[^>]*>(\d{6})/) || [])[1] || '';
ok('magic-link start emails a link + a 6-digit code (dev-surfaced)', mlTok !== '' && /^\d{6}$/.test(mlCode));
const noAcctYet = (await app.db.query<{ n: number }>(`SELECT count(*)::int n FROM account WHERE email=$1`, [mlEmail])).rows[0].n;
ok('no account is created until the link/code is used', noAcctYet === 0);
// verify via the magic link → creates a passwordless Fan account + session
const verifyRes = await fetch(base + '/auth/verify?token=' + mlTok, { redirect: 'manual' });
ok('magic link signs in (session cookie) + routes a new user to onboarding', (verifyRes.headers.get('set-cookie') || '').includes('hz_session=') && (verifyRes.headers.get('location') || '') === '/onboarding/fan');
const newAcct = (await app.db.query<{ password_hash: string | null }>(`SELECT password_hash FROM account WHERE email=$1`, [mlEmail])).rows[0];
ok('the created account is passwordless (no password hash)', !!newAcct && newAcct.password_hash === null);
// the link is single-use
const reuse = await fetch(base + '/auth/verify?token=' + mlTok, { redirect: 'manual' });
ok('a magic link is single-use (reuse is rejected)', (reuse.headers.get('set-cookie') || '') === '' || !(reuse.headers.get('set-cookie') || '').includes('hz_session='));
// OTP path for a second email
const otpEmail = 'otp_' + Date.now() + '@horda.app';
const otpStart = await fetch(base + '/auth/start', post({ email: otpEmail })).then(r => r.text());
const otpCode = (otpStart.match(/Code: <b[^>]*>(\d{6})/) || [])[1] || '';
const otpRes = await fetch(base + '/auth/code', post({ email: otpEmail, code: otpCode }));
ok('entering the 6-digit code signs in too', otpCode !== '' && (otpRes.headers.get('set-cookie') || '').includes('hz_session='));
ok('a wrong code is rejected', !((await fetch(base + '/auth/code', post({ email: otpEmail, code: '000000' }))).headers.get('set-cookie') || '').includes('hz_session='));

console.log('\n[auth · logout]');
const lo = await fetch(base + '/logout', { headers: { cookie }, redirect: 'manual' });
ok('logout clears the cookie', (lo.headers.get('set-cookie') ?? '').includes('Max-Age=0'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
