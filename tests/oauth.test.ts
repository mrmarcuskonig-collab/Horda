// oauth.test.ts — social login (OAuth2): provider gating, redirect, code
// exchange (faked), and find-or-create-account-by-email. Run: node tests/oauth.test.ts
import { oauthProviders, authUrl, exchange, isEnabled } from '../src/web/oauth.ts';
import { PGliteDatabase } from '../src/db/index.ts';
import { seedDemo } from '../src/web/seed.ts';
import { upsertOauthAccount } from '../src/db/auth_repo.ts';
import { startServer } from '../src/web/server.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };

console.log('\n[oauth · gating + url]');
ok('no providers until env keys are set', oauthProviders().length === 0);
process.env.GOOGLE_CLIENT_ID = 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
ok('google enabled once configured', isEnabled('google') && oauthProviders().some(p => p.id === 'google'));
ok('unknown provider stays disabled', !isEnabled('twitter'));
const u = authUrl('google', 'https://joinhorda.com/auth/google/callback', 'STATE123');
ok('authUrl points at Google with client_id + state + redirect', u.startsWith('https://accounts.google.com/') && u.includes('client_id=test-google-id') && u.includes('state=STATE123') && u.includes('callback'));

console.log('\n[oauth · code exchange (faked transport)]');
const fakeFetch: any = async (url: string) => url.includes('oauth2.googleapis.com/token')
  ? { json: async () => ({ access_token: 'AT' }) }
  : { json: async () => ({ email: 'sam@gmail.com', name: 'Sam G' }) };
const prof = await exchange('google', 'code123', 'https://joinhorda.com/auth/google/callback', fakeFetch);
ok('exchange returns the verified email + name', prof!.email === 'sam@gmail.com' && prof!.name === 'Sam G');

console.log('\n[oauth · find-or-create account by email]');
const db = await PGliteDatabase.open();
await seedDemo(db);
const a1 = await upsertOauthAccount(db, 'NewUser@Gmail.com', 'New User');
ok('first sign-in creates a passwordless account + fan', !!a1.accountId && !!a1.fanId);
const a2 = await upsertOauthAccount(db, 'newuser@gmail.com', 'New User');
ok('same email links to the same account (no duplicate)', a2.accountId === a1.accountId);
ok('oauth account has no password (can’t password-login)', (await db.query<{ password_hash: string | null }>(`SELECT password_hash FROM account WHERE id=$1`, [a1.accountId])).rows[0].password_hash === null);
await db.close();

console.log('\n[oauth · routes]');
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const r = await fetch(base + '/auth/google?next=/onboarding/fan', { redirect: 'manual' });
ok('/auth/google → 303 to Google with state cookie', r.status === 303 && (r.headers.get('location') || '').includes('accounts.google.com') && (r.headers.get('set-cookie') || '').includes('hz_oauth='));
ok('login page shows “Continue with Google”', (await (await fetch(base + '/login')).text()).includes('Continue with Google'));
const bad = await fetch(base + '/auth/twitter', { redirect: 'manual' });
ok('unconfigured provider falls back to /login', (bad.headers.get('location') || '') === '/login');
await app.close();

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
