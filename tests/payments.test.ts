// payments.test.ts — Stripe Checkout adapter, verified with an injected fetch
// (no real network, no keys). Run: node tests/payments.test.ts
import { StripePayments, StubPayments } from '../src/web/payments.ts';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}`); c ? pass++ : fail++; };
console.log('\n[payments]');

// --- stub (no STRIPE_SECRET_KEY) ---
const stub = new StubPayments();
ok('stub is disabled', stub.enabled === false);
ok('stub retrieve returns null (caller grants directly)', (await stub.retrieve('x')) === null);

// --- stripe with a fake fetch ---
let lastUrl = '', lastInit: any = null;
const fakeFetch: any = async (u: string, init: any) => {
  lastUrl = u; lastInit = init;
  if (u.includes('/checkout/sessions/')) return { ok: true, json: async () => ({ id: 'cs_1', payment_status: 'paid', status: 'complete', metadata: { kind: 'ticket', event_id: 'e1', fan_id: 'f1' } }) };
  return { ok: true, json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }) };
};
const sp = new StripePayments('sk_test_123', fakeFetch);

const r = await sp.createCheckout({
  mode: 'payment', amountCents: 1500, currency: 'EUR', productName: 'Ticket · Season launch',
  successUrl: 'https://joinhorda.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://joinhorda.com/e/e1', metadata: { kind: 'ticket', event_id: 'e1', fan_id: 'f1' },
});
const decoded = decodeURIComponent(lastInit.body);
ok('createCheckout returns the hosted Stripe url', r.url.startsWith('https://checkout.stripe.com/'));
ok('posts to the Stripe checkout-sessions endpoint', lastUrl === 'https://api.stripe.com/v1/checkout/sessions');
ok('authorizes with the secret key', lastInit.headers.Authorization === 'Bearer sk_test_123');
ok('body carries amount, currency, product name', decoded.includes('[unit_amount]=1500') && decoded.includes('[currency]=eur') && decoded.includes('[product_data][name]=Ticket'));
ok('session-id placeholder stays literal (not %7B-encoded)', lastInit.body.includes('{CHECKOUT_SESSION_ID}') && !lastInit.body.includes('%7B'));
ok('metadata passes through for the return grant', decoded.includes('metadata[kind]=ticket') && decoded.includes('metadata[event_id]=e1'));

await sp.createCheckout({
  mode: 'subscription', amountCents: 499, currency: 'EUR', productName: 'Raven’s Corner',
  successUrl: 'https://x/y?session_id={CHECKOUT_SESSION_ID}', cancelUrl: 'https://x/y', metadata: { kind: 'membership' },
});
ok('subscription mode = monthly recurring', lastInit.body.includes('mode=subscription') && decodeURIComponent(lastInit.body).includes('[recurring][interval]=month'));

const got = await sp.retrieve('cs_1');
ok('retrieve reports paid + returns metadata', got!.paid === true && got!.metadata.event_id === 'e1');

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
