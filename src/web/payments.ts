// payments.ts — real money via Stripe Checkout (hosted, PCI-safe). No card data
// ever touches Horda: we create a Checkout Session server-side and redirect the
// buyer to Stripe's page; on return we verify the session and grant access.
//
// With STRIPE_SECRET_KEY set → real charges. Without it → a stub that grants
// instantly (local dev + tests). Same shape as the DB adapter swap.
//
// One-time payment for event tickets; monthly subscription for membership tiers.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CheckoutReq {
  mode: 'payment' | 'subscription';
  amountCents: number; currency: string; productName: string;
  interval?: 'month' | 'year';   // subscription billing period (default month)
  successUrl: string;   // must contain {CHECKOUT_SESSION_ID}
  cancelUrl: string;
  metadata: Record<string, string>;
}
export interface CheckoutResult { paid: boolean; metadata: Record<string, string>; subscriptionId: string | null }
export interface Payments {
  readonly enabled: boolean;
  createCheckout(o: CheckoutReq): Promise<{ url: string }>;
  retrieve(sessionId: string): Promise<CheckoutResult | null>;
}

type Fetcher = typeof fetch;

export class StripePayments implements Payments {
  readonly enabled = true;
  private key: string;
  private fetcher: Fetcher;
  constructor(key: string, fetcher: Fetcher = fetch) { this.key = key; this.fetcher = fetcher; }

  private async api(path: string, method: 'GET' | 'POST', body?: string): Promise<any> {
    const r = await this.fetcher('https://api.stripe.com/v1/' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + this.key,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body,
    } as any);
    const json: any = await r.json();
    if (!r.ok) throw new Error('stripe: ' + (json?.error?.message ?? r.status));
    return json;
  }

  async createCheckout(o: CheckoutReq): Promise<{ url: string }> {
    const p = new URLSearchParams();
    p.set('mode', o.mode);
    // sentinel keeps Stripe's {CHECKOUT_SESSION_ID} placeholder literal (un-encoded)
    p.set('success_url', o.successUrl.replace('{CHECKOUT_SESSION_ID}', '__HZSID__'));
    p.set('cancel_url', o.cancelUrl);
    p.set('line_items[0][quantity]', '1');
    p.set('line_items[0][price_data][currency]', o.currency.toLowerCase());
    p.set('line_items[0][price_data][unit_amount]', String(o.amountCents));
    p.set('line_items[0][price_data][product_data][name]', o.productName);
    if (o.mode === 'subscription') p.set('line_items[0][price_data][recurring][interval]', o.interval ?? 'month');
    for (const [k, v] of Object.entries(o.metadata)) p.set('metadata[' + k + ']', v);
    const body = p.toString().replace('__HZSID__', '{CHECKOUT_SESSION_ID}');
    const s = await this.api('checkout/sessions', 'POST', body);
    return { url: s.url as string };
  }

  async retrieve(sessionId: string): Promise<CheckoutResult | null> {
    const s = await this.api('checkout/sessions/' + encodeURIComponent(sessionId), 'GET');
    const paid = s.payment_status === 'paid' || s.status === 'complete';
    const subscriptionId = typeof s.subscription === 'string' ? s.subscription : (s.subscription?.id ?? null);
    return { paid, metadata: (s.metadata ?? {}) as Record<string, string>, subscriptionId };
  }
}

export class StubPayments implements Payments {
  readonly enabled = false;
  async createCheckout(): Promise<{ url: string }> { throw new Error('payments not configured'); }
  async retrieve(): Promise<null> { return null; }
}

export function getPayments(fetcher: Fetcher = fetch): Payments {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new StripePayments(key, fetcher) : new StubPayments();
}

// --- Stripe webhook signature verification -----------------------------------
// Stripe signs the raw request body and sends `Stripe-Signature: t=…,v1=…`.
// We recompute HMAC-SHA256 over `${t}.${rawBody}` with the endpoint's signing
// secret (whsec_…) and constant-time compare. On success we return the parsed
// event; on any mismatch/parse failure we return null (caller responds 400).
// `toleranceSec` guards against replay (default 5 min); pass 0 to disable.
export function verifyWebhook(
  rawBody: string,
  sigHeader: string | undefined,
  secret: string | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): any | null {
  if (!rawBody || !secret || !sigHeader) return null;
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts['t'], v1 = parts['v1'];
  if (!t || !v1) return null;
  if (toleranceSec > 0 && Math.abs(nowSec - Number(t)) > toleranceSec) return null;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  let okSig = false;
  try {
    const a = Buffer.from(expected), b = Buffer.from(v1);
    okSig = a.length === b.length && timingSafeEqual(a, b);
  } catch { return null; }
  if (!okSig) return null;
  try { return JSON.parse(rawBody); } catch { return null; }
}
