// plus.test.ts — Furia Plus subscription billing end-to-end (organiser upgrade).
//   subscribe → account.plan='plus' → their paid tickets are 0% fee
//   cancel   → back to 'free' → fee returns to the platform rate
//   webhook-level activate/cancel helpers flip the plan by subscription id
// Payments run in stub mode here, so /plus/subscribe uses the dev-grant path.
// Run: node tests/plus.test.ts
// Make Plus purchasable, THEN load anything that reads pricing.ts. pricing.ts
// snapshots env at module-load, and static imports are hoisted above this line —
// so server/pricing must be pulled in dynamically, after the env is set.
process.env.FURIA_PLUS_LIVE = '1';
const { startServer } = await import('../src/web/server.ts');
const { createSession, getAccountPlan, planForHost, ownerAccountFor, setAccountPlan, clearPlanBySubscription } = await import('../src/db/auth_repo.ts');
const { feePctForPlan, PLATFORM_FEE_PCT } = await import('../src/web/pricing.ts');
const { createScheduledEvent } = await import('../src/db/events_repo.ts');

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
const app = await startServer(0);
const base = `http://localhost:${app.port}`;
const post = (p: string, body: string, cookie?: string) => fetch(base + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) } as any, body });

console.log('\n[plus] Furia Plus subscription → 0% fee');

const ath = app.ids.athletes[0].id;   // demo athlete, owned by the demo account
const acct = (await app.db.query<{ account_id: string }>(`SELECT account_id FROM athlete WHERE id=$1`, [ath])).rows[0].account_id;
const ev = await createScheduledEvent(app.db, { hostKind: 'athlete', hostId: ath, title: 'PAID NIGHT', startsAt: new Date(Date.now() + 864e5).toISOString(), location: 'Berlin', admission: 'open' });
ok('sanity: demo account owns the host', !!acct && (await ownerAccountFor(app.db, 'athlete', ath)) === acct);

// --- baseline: a Free organiser pays the platform fee ---
ok('Free organiser fee = platform fee', feePctForPlan(await planForHost(app.db, 'athlete', ath)) === PLATFORM_FEE_PCT && PLATFORM_FEE_PCT === 5);
ok('event exists to sell', !!ev);

// (Guest-gating is enforced in the route via `!account?.id → /signup`; the test
//  harness injects a default account for cookieless requests, so it can't be
//  exercised over HTTP here.)

// --- organiser subscribes (dev-grant path since payments are stubbed) ---
const cookie = `hz_session=${await createSession(app.db, acct)}`;
const sub = await post('/plus/subscribe', 'interval=annual', cookie);
ok('subscribe redirects', sub.status === 303);
ok('account is now on Plus', (await getAccountPlan(app.db, acct)) === 'plus');
ok('★ Plus organiser now pays 0% platform fee', feePctForPlan(await planForHost(app.db, 'athlete', ath)) === 0);

// --- settings reflects the active plan + offers cancel ---
const settings = await (await fetch(base + '/settings', { headers: { cookie } as any })).text();
ok('settings shows Furia Plus active + cancel', settings.includes('Furia Plus') && settings.includes('/plus/cancel') && settings.includes('Active'));

// --- cancel → back to Free ---
const can = await post('/plus/cancel', '', cookie);
ok('cancel redirects', can.status === 303);
ok('back on the Free plan', (await getAccountPlan(app.db, acct)) === 'free');
ok('fee returns to the platform rate', feePctForPlan(await planForHost(app.db, 'athlete', ath)) === PLATFORM_FEE_PCT);

// --- webhook-level helpers (what checkout.session.completed / subscription.deleted call) ---
await setAccountPlan(app.db, acct, 'plus', 'sub_wh_test');
ok('webhook activate: setAccountPlan puts them on Plus + records the sub', (await getAccountPlan(app.db, acct)) === 'plus'
  && (await app.db.query<{ s: string }>(`SELECT stripe_subscription_id s FROM account WHERE id=$1`, [acct])).rows[0].s === 'sub_wh_test');
const cleared = await clearPlanBySubscription(app.db, 'sub_wh_test');
ok('webhook cancel: clearPlanBySubscription downgrades by sub id', cleared && (await getAccountPlan(app.db, acct)) === 'free');

// --- unresolved / host-less events never accidentally get 0% ---
ok('host-less event defaults to Free fee (never 0% by accident)', feePctForPlan(await planForHost(app.db, null, null)) === PLATFORM_FEE_PCT);

await app.close();
console.log(`\n──────── plus: ${pass} passed, ${fail} failed ────────`);
process.exit(fail ? 1 : 0);
