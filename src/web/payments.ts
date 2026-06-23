// payments.ts — real money via Stripe Checkout (hosted, PCI-safe). No card data
// ever touches Horda: we create a Checkout Session server-side and redirect the
// buyer to Stripe's page; on return we verify the session and grant access.
//
// With STRIPE_SECRET_KEY set → real charges. Without it → a stub that grants
// instantly (local dev + tests). Same shape as the DB adapter swap.
//
// One-time payment for event tickets; monthly subscription for membership tiers.

export interface CheckoutReq {
  mode: 'payment' | 'subscription';
  amountCents: number; currency: string; productName: string;
  interval?: 'month' | 'year';   // subscription billing period (default month)
  successUrl: string;   // must contain {CHECKOUT_SESSION_ID}
  cancelUrl: string;
  metadata: Record<string, string>;
}
export interface Payments {
  readonly enabled: boolean;
  createCheckout(o: CheckoutReq): Promise<{ url: string }>;
  retrieve(sessionId: string): Promise<{ paid: boolean; metadata: Record<string, string> } | null>;
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

  async retrieve(sessionId: string): Promise<{ paid: boolean; metadata: Record<string, string> } | null> {
    const s = await this.api('checkout/sessions/' + encodeURIComponent(sessionId), 'GET');
    const paid = s.payment_status === 'paid' || s.status === 'complete';
    return { paid, metadata: (s.metadata ?? {}) as Record<string, string> };
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
