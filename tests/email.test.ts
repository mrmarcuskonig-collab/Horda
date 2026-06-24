// email.test.ts — email adapter + end-to-end password reset.
// Run: node tests/email.test.ts
import { ResendEmailer, ConsoleEmailer, resetEmail } from '../src/web/email.ts';
import { startServer } from '../src/web/server.ts';
import { signup, verifyLogin } from '../src/db/auth_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[email · adapter]');
let lastUrl = '', lastInit: any = null;
const fakeFetch: any = async (u: string, init: any) => { lastUrl = u; lastInit = init; return { ok: true, json: async () => ({ id: 'e_1' }) }; };
const re = new ResendEmailer('re_test_key', 'Horda <noreply@joinhorda.com>', fakeFetch);
const sent = await re.send({ to: 'a@x.com', subject: 'Hi', html: '<b>hi</b>', text: 'hi' });
const body = JSON.parse(lastInit.body);
ok('resend send returns true on ok', sent === true);
ok('posts to the Resend endpoint', lastUrl === 'https://api.resend.com/emails');
ok('authorizes with the api key', lastInit.headers.Authorization === 'Bearer re_test_key');
ok('payload carries from/to/subject/html', body.from.includes('joinhorda.com') && body.to[0] === 'a@x.com' && body.subject === 'Hi' && body.html === '<b>hi</b>');

const console_ = new ConsoleEmailer();
ok('console emailer is disabled (fallback)', console_.enabled === false);
await console_.send({ to: 'b@x.com', subject: 'S', html: 'H' });
ok('console emailer captures the last message', console_.last?.to === 'b@x.com' && console_.last?.subject === 'S');

console.log('\n[email · reset template]');
const tpl = resetEmail('https://joinhorda.com/reset?token=ABC');
ok('reset email links to the reset url', tpl.html.includes('/reset?token=ABC') && tpl.text.includes('/reset?token=ABC'));
ok('reset email mentions 1-hour expiry', /1 hour/.test(tpl.text));

console.log('\n[email · end-to-end password reset (no provider configured)]');
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const enc = (o: Record<string, string>) => new URLSearchParams(o);
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: enc(o) });

await signup(app.db, 'reset@x.com', 'Reset User', 'oldpassword1');
ok('user can log in with the original password', !!(await verifyLogin(app.db, 'reset@x.com', 'oldpassword1')));

// unknown email → same confirmation, no dev link (no enumeration)
const unknown = await (await fetch(base + '/forgot', post({ email: 'nobody@x.com' }))).text();
ok('unknown email still shows generic confirmation', unknown.includes('Check your email'));
ok('unknown email yields no reset link', !/\/reset\?token=/.test(unknown));

// real email → dev link surfaced (since no RESEND_API_KEY in tests)
const forgotHtml = await (await fetch(base + '/forgot', post({ email: 'reset@x.com' }))).text();
const m = forgotHtml.match(/\/reset\?token=([A-Za-z0-9-]+)/);
ok('known email surfaces a dev reset link', !!m);
const token = m![1];

// stale/garbage token is rejected
const badReset = await (await fetch(base + '/reset', post({ token: 'not-a-real-token', password: 'whatever12' }))).text();
ok('invalid token → error page, no reset', badReset.includes('invalid or expired'));
ok('password unchanged after bad token', !!(await verifyLogin(app.db, 'reset@x.com', 'oldpassword1')));

// valid token resets the password
const doneHtml = await (await fetch(base + '/reset', post({ token, password: 'brandnew123' }))).text();
ok('valid token → success page', doneHtml.includes('Password updated'));
ok('old password no longer works', !(await verifyLogin(app.db, 'reset@x.com', 'oldpassword1')));
ok('new password works', !!(await verifyLogin(app.db, 'reset@x.com', 'brandnew123')));

// token is single-use
const reuse = await (await fetch(base + '/reset', post({ token, password: 'tryagain123' }))).text();
ok('token cannot be reused', reuse.includes('invalid or expired'));

await app.close();
console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
