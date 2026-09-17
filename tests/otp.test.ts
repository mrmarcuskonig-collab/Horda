// otp.test.ts — phone verification flow (adapter-backed, stub by default).
//   * start stores a code; confirm with the right code flips person.verified_at
//   * wrong/expired code fails; login stays email-only (this only strengthens id)
//   * end-to-end over HTTP: send code → enter it → verified
// Run: node tests/otp.test.ts
import { startServer } from '../src/web/server.ts';
import { updateAccountPhone } from '../src/db/auth_repo.ts';
import { linkPersonByPhone, personFor, startPhoneVerification, confirmPhoneVerification, normalizePhone } from '../src/db/identity_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const mkAccount = async (email: string) => (await db.query<{ id: string }>(`INSERT INTO account (email) VALUES ($1) RETURNING id`, [email])).rows[0].id;

console.log('\n[otp · phone verification]');

// --- repo: start + confirm flips verified ---
const a = await mkAccount('otp-a@x.com');
await linkPersonByPhone(db, a, '0176 5555 111');   // person exists, unverified
ok('a freshly linked person is unverified', (await personFor(db, a))?.verified === false);
const started = await startPhoneVerification(db, '0176 5555 111');
ok('start returns a phone + code', !!started && /^[0-9]{6}$/.test(started!.code) && started!.phone === '+491765555111');
ok('a wrong code does not verify', (await confirmPhoneVerification(db, '0176 5555 111', '000000')) === false && (await personFor(db, a))?.verified === false);
ok('the right code verifies the person', (await confirmPhoneVerification(db, '0176 5555 111', started!.code)) === true && (await personFor(db, a))?.verified === true);
ok('the code is single-use (cleared after confirm)', (await confirmPhoneVerification(db, '0176 5555 111', started!.code)) === false);

// --- expiry ---
const b = await mkAccount('otp-b@x.com');
await linkPersonByPhone(db, b, '0176 5555 222');
const exp = await startPhoneVerification(db, '0176 5555 222', -1);   // already expired
ok('an expired code does not verify', (await confirmPhoneVerification(db, '0176 5555 222', exp!.code)) === false && (await personFor(db, b))?.verified === false);

// --- HTTP end-to-end (demo account) ---
await updateAccountPhone(db, app.ids.demoAccountId, '0176 5555 000');
const s1 = await (await fetch(`${base}/verify-phone`)).text();
ok('GET /verify-phone offers to send a code', s1.includes('Send code'));
const s2 = await (await fetch(`${base}/verify-phone/start`, post({}))).text();
ok('POST start moves to the code step', s2.includes('Verify') && s2.includes('+491765555000'));
const code = (await db.query<{ code: string }>(`SELECT code FROM phone_otp WHERE phone_e164=$1`, [normalizePhone('0176 5555 000')])).rows[0].code;
const s3 = await (await fetch(`${base}/verify-phone/confirm`, post({ code }))).text();
ok('POST confirm with the code verifies', s3.includes('verified'));
ok('the demo person is now verified', (await personFor(db, app.ids.demoAccountId))?.verified === true);

await app.close();
console.log(`\n──────── otp: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
