// email.ts — transactional email via Resend (simple REST, no SDK). Same adapter
// pattern as payments/AI: with RESEND_API_KEY set → real send; without it → a
// console emailer that logs the message and stashes the last one (dev + tests),
// so flows like password reset work end-to-end with no provider configured.
//
// Provider note: Resend's API is the default; any provider with a JSON "send"
// endpoint can be dropped in behind the Emailer interface.

export interface EmailMsg { to: string; subject: string; html: string; text?: string }
export interface Emailer {
  readonly enabled: boolean;
  send(m: EmailMsg): Promise<boolean>;
}

type Fetcher = typeof fetch;

export class ResendEmailer implements Emailer {
  readonly enabled = true;
  private key: string;
  private from: string;
  private fetcher: Fetcher;
  constructor(key: string, from: string, fetcher: Fetcher = fetch) { this.key = key; this.from = from; this.fetcher = fetcher; }
  async send(m: EmailMsg): Promise<boolean> {
    let r: any;
    try {
      r = await this.fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, ...(m.text ? { text: m.text } : {}) }),
      } as any);
    } catch (e: any) {
      console.error(`[email] Resend request failed (network): ${e?.message}`);
      return false;
    }
    if (!r.ok) {
      // The #1 cause of "magic link never arrives": Resend rejects sends from an
      // unverified domain. Log the status + body so the reason is visible in the
      // logs instead of being swallowed. Common: 403 "domain is not verified".
      let body = ''; try { body = await r.text(); } catch { /* ignore */ }
      console.error(`[email] Resend send FAILED ${r.status} from="${this.from}" to="${m.to}": ${body.slice(0, 400)}`);
      return false;
    }
    return true;
  }
}

// Dev/test fallback: never sends, never throws. Keeps the last message so the
// reset link is visible in logs (and assertable in tests).
export class ConsoleEmailer implements Emailer {
  readonly enabled = false;
  last: EmailMsg | null = null;
  async send(m: EmailMsg): Promise<boolean> {
    this.last = m;
    console.log(`[email:dev] → ${m.to} · "${m.subject}"`);
    return true;
  }
}

// The one address a human can write to: Impressum, support, legal, footer.
// Single source of truth — never hardcode a contact address anywhere else.
// Override per-environment with CONTACT_EMAIL.
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'marcus@spaghetti.ventures';

export function getEmailer(fetcher: Fetcher = fetch): Emailer {
  const key = process.env.RESEND_API_KEY;
  // Transactional sender (magic links, receipts). Deliberately the same address
  // for now so there is exactly one verified sending domain to maintain; set
  // EMAIL_FROM to move it to joinfuria.com once that domain has SPF/DKIM.
  // Reply-To is set to the contact address so replies always reach a human.
  const from = process.env.EMAIL_FROM || `Furia <${CONTACT_EMAIL}>`;
  return key ? new ResendEmailer(key, from, fetcher) : new ConsoleEmailer();
}

// --- message templates -------------------------------------------------------
// Passwordless sign-in: a magic link + a 6-digit code (either works). 15-min expiry.
export function loginEmail(link: string, code: string): { subject: string; html: string; text: string } {
  const subject = 'Your Furia sign-in link';
  const text = `Sign in to Furia:\n${link}\n\nOr enter this code: ${code}\n\nThis expires in 15 minutes. If you didn't request it, ignore this email.`;
  const html = `<div style="font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0B0B0C">
  <h2 style="font-weight:700;letter-spacing:-.01em">Sign in to Furia</h2>
  <p style="color:#444;line-height:1.6">Tap the button to sign in — no password needed. This link expires in 15 minutes.</p>
  <p style="margin:22px 0"><a href="${link}" style="background:#0B0B0C;color:#EDE9DF;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Sign in →</a></p>
  <p style="color:#444;line-height:1.6">Or enter this code:</p>
  <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:4px 0 18px">${code}</p>
  <p style="color:#888;font-size:13px;line-height:1.6">If the button doesn't work, paste this link:<br><a href="${link}" style="color:#555">${link}</a></p>
  <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
</div>`;
  return { subject, html, text };
}
export function resetEmail(link: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your Furia password';
  const text = `Reset your Furia password:\n${link}\n\nThis link expires in 1 hour. If you didn't request it, you can ignore this email.`;
  const html = `<div style="font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0B0B0C">
  <h2 style="font-weight:700;letter-spacing:-.01em">Reset your password</h2>
  <p style="color:#444;line-height:1.6">Tap the button to choose a new password. This link expires in 1 hour.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#0B0B0C;color:#EDE9DF;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Reset password</a></p>
  <p style="color:#888;font-size:13px;line-height:1.6">If the button doesn't work, paste this link:<br><a href="${link}" style="color:#555">${link}</a></p>
  <p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
</div>`;
  return { subject, html, text };
}
