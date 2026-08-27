// payments.test.ts — Stripe Checkout adapter, verified with an injected fetch
// (no real network, no keys). Run: node tests/payments.test.ts
import { StripePayments, StubPayments, verifyWebhook } from '../src/web/payments.ts';
import { createHmac } from 'node:crypto';

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
  successUrl: 'https://joinfuria.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://joinfuria.com/e/e1', metadata: { kind: 'ticket', event_id: 'e1', fan_id: 'f1' },
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

// retrieve surfaces the subscription id (needed to map cancellations back to a member)
let subFetch: any = async (u: string) => u.includes('/checkout/sessions/')
  ? { ok: true, json: async () => ({ id: 'cs_2', status: 'complete', subscription: 'sub_ABC', metadata: { kind: 'membership' } }) }
  : { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_2' }) };
const got2 = await new StripePayments('sk_test_123', subFetch).retrieve('cs_2');
ok('retrieve surfaces the subscription id', got2!.subscriptionId === 'sub_ABC');

// --- Stripe Connect: destination charges + 10% platform fee (Build Order item 4) ---
console.log('\n[payments · Stripe Connect]');
let connUrl = '', connBody = '';
const connFetch: any = async (u: string, init: any) => {
  connUrl = u; connBody = init?.body ? decodeURIComponent(init.body) : '';
  if (u.includes('/accounts/acct_')) return { ok: true, json: async () => ({ id: 'acct_X', charges_enabled: true, payouts_enabled: true }) };
  if (u.endsWith('/accounts')) return { ok: true, json: async () => ({ id: 'acct_X' }) };
  if (u.endsWith('/account_links')) return { ok: true, json: async () => ({ url: 'https://connect.stripe.com/setup/acct_X' }) };
  return { ok: true, json: async () => ({ id: 'cs_9', url: 'https://checkout.stripe.com/c/pay/cs_9' }) };
};
const cp = new StripePayments('sk_test_123', connFetch);
const acct = await cp.createConnectAccount({ email: 'club@x.co' });
ok('createConnectAccount → Express account with transfers capability', acct.accountId === 'acct_X' && connUrl.endsWith('/accounts') && connBody.includes('type=express') && connBody.includes('[transfers][requested]=true'));
const linkR = await cp.accountLink({ accountId: 'acct_X', refreshUrl: 'https://h/r', returnUrl: 'https://h/ret' });
ok('accountLink → hosted Stripe onboarding url', linkR.url.startsWith('https://connect.stripe.com/') && connBody.includes('type=account_onboarding'));
const st = await cp.getAccount('acct_X');
ok('getAccount reports charges + payouts enabled', st!.chargesEnabled === true && st!.payoutsEnabled === true);
// a paid-ticket checkout with a connected destination + 10% fee
await cp.createCheckout({
  mode: 'payment', amountCents: 2000, currency: 'EUR', productName: 'Ticket',
  successUrl: 'https://h/s?session_id={CHECKOUT_SESSION_ID}', cancelUrl: 'https://h/e',
  metadata: { kind: 'ticket' }, applicationFeeCents: 200, destinationAccount: 'acct_X',
});
ok('checkout routes funds to the connected account + keeps the 10% fee', connBody.includes('[application_fee_amount]=200') && connBody.includes('[transfer_data][destination]=acct_X'));
// stub Connect: dev shortcut that flips to enabled so the flow is exercisable
ok('stub Connect account is instantly enabled (dev)', (await stub.getAccount('acct_dev')).chargesEnabled === true);

// --- webhook signature verification ---
console.log('\n[payments · webhook signatures]');
const secret = 'whsec_test_secret';
const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { kind: 'membership', fan_id: 'f1' }, subscription: 'sub_9' } } });
const now = Math.floor(Date.now() / 1000);
const sign = (t: number, b: string, sec = secret) => `t=${t},v1=${createHmac('sha256', sec).update(`${t}.${b}`).digest('hex')}`;

const evt = verifyWebhook(body, sign(now, body), secret, now);
ok('valid signature → parsed event', evt?.type === 'checkout.session.completed' && evt.data.object.subscription === 'sub_9');
ok('wrong secret → rejected', verifyWebhook(body, sign(now, body, 'whsec_wrong'), secret, now) === null);
ok('tampered body → rejected', verifyWebhook(body + ' ', sign(now, body), secret, now) === null);
ok('stale timestamp → rejected (replay guard)', verifyWebhook(body, sign(now - 1000, body), secret, now) === null);
ok('missing signature header → rejected', verifyWebhook(body, undefined, secret, now) === null);
ok('no secret configured → rejected', verifyWebhook(body, sign(now, body), undefined, now) === null);
ok('malformed header → rejected', verifyWebhook(body, 'garbage', secret, now) === null);

console.log(`\n──────────── ${pass} passed, ${fail} failed ────────────`);
if (fail > 0) process.exit(1);
