// identity.test.ts — canonical Fan ID: one person per human, keyed on phone.
//   * E.164 normalization (German-first)
//   * same number (any format) on two accounts → ONE person (merge)
//   * different numbers → different persons; relink is append-only history
//   * a claim with a phone links the account to a person (HTTP)
//   * identity is NOT auth: linking creates no session; login stays email-only
// Run: node tests/identity.test.ts
import { startServer } from '../src/web/server.ts';
import { createScheduledEvent } from '../src/db/events_repo.ts';
import { normalizePhone, linkPersonByPhone, personFor, accountsForPerson } from '../src/db/identity_repo.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const db = app.db, base = `http://localhost:${app.port}`;
const post = (o: Record<string, string>) => ({ method: 'POST', redirect: 'manual' as const, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const mkAccount = async (email: string) => (await db.query<{ id: string }>(`INSERT INTO account (email) VALUES ($1) RETURNING id`, [email])).rows[0].id;
const linkCount = async (accountId: string) => (await db.query<{ n: number }>(`SELECT count(*)::int n FROM person_link WHERE account_id=$1`, [accountId])).rows[0].n;

console.log('\n[identity · canonical fan id]');

// --- normalization: three formats of one German mobile collapse to one E.164 ---
const E = '+4917612345678';
ok('national 0176… → +49…', normalizePhone('0176 1234 5678') === E);
ok('international +49… kept', normalizePhone('+49 176 12345678') === E);
ok('00-prefixed 0049… → +49…', normalizePhone('0049 176 12345678') === E);
ok('garbage → null', normalizePhone('123') === null && normalizePhone('') === null && normalizePhone(null) === null);

// --- merge: same number (different formats) on two accounts → ONE person ---
const a = await mkAccount('a@x.com'), b = await mkAccount('b@x.com'), c = await mkAccount('c@x.com');
const pA = await linkPersonByPhone(db, a, '0176 1234 5678');
const pB = await linkPersonByPhone(db, b, '+49 176 12345678');   // same human, different format
ok('same number on two accounts → same person', !!pA && pA === pB);
const pC = await linkPersonByPhone(db, c, '0170 0000000');       // different number
ok('a different number → a different person', !!pC && pC !== pA);
ok('the person carries both accounts (the merge view)', (await accountsForPerson(db, pA!)).sort().join() === [a, b].sort().join());
ok('personFor resolves the E.164', (await personFor(db, a))?.phone === E);
ok('captured but unproven → not verified yet', (await personFor(db, a))?.verified === false);

// --- relink is append-only history, not an overwrite ---
await linkPersonByPhone(db, a, '0155 5555555');
ok('a number change re-links to a new person', (await personFor(db, a))?.phone === '+491555555555');
ok('…and keeps the old link (append-only history)', (await linkCount(a)) === 2);
ok('an unnormalizable phone links nothing', (await linkPersonByPhone(db, a, 'nope')) === null && (await linkCount(a)) === 2);

// --- identity is NOT authentication ---
const sessA = (await db.query<{ n: number }>(`SELECT count(*)::int n FROM session WHERE account_id=$1`, [a])).rows[0].n;
ok('linking a person creates NO session (phone is not a login factor)', sessA === 0);

// --- HTTP: a claim with a phone keys the account to a canonical person ---
const club = (await db.query<{ id: string }>(`SELECT id FROM club LIMIT 1`)).rows[0].id;
const ev = await createScheduledEvent(db, { hostKind: 'club', hostId: club, title: 'Fan ID e2e', startsAt: new Date(Date.now() + 7 * 86400000).toISOString(), admission: 'open' });
await fetch(`${base}/claim/${ev}`, post({ phone: '0176 999 8888' }));   // demo account (no cookie) claims
const demoPerson = await personFor(db, app.ids.demoAccountId);
ok('a claim with a phone links the demo account to a person', !!demoPerson);
ok('…and the linked phone is normalized to E.164', demoPerson?.phone === '+491769998888');

await app.close();
console.log(`\n──────── identity: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
