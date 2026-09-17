// otp.ts — phone verification behind a swappable adapter (same shape as payments).
//
// Default is a STUB that sends nothing. The identity spine captures and keys the
// phone now; real SMS/WhatsApp verification is plugged in later by config WITHOUT
// adding a dependency (AGENTS.md keeps deps at three). The phone is never a login
// factor — this only flips person.verified_at once a code is confirmed.
export interface Otp {
  readonly enabled: boolean;
  /** Deliver a one-time code to a number. The stub is a no-op. */
  send(phoneE164: string, code: string): Promise<void>;
}

class StubOtp implements Otp {
  readonly enabled = false;
  async send(phoneE164: string, code: string): Promise<void> {
    // Dev/test: don't send anything. OTP_DEBUG=1 logs the code so a developer can
    // finish a flow locally.
    if (process.env.OTP_DEBUG === '1') console.log(`[otp:stub] ${phoneE164} -> ${code}`);
  }
}

// Factory. When a real provider is wired (e.g. Twilio, or WhatsApp Business to
// match the presale channel), branch on OTP_PROVIDER here and return it; until
// then, always the stub.
export function makeOtp(): Otp {
  // if (process.env.OTP_PROVIDER === 'twilio') return new TwilioOtp(...);
  return new StubOtp();
}

export const genOtpCode = (): string => String(Math.floor(100000 + Math.random() * 900000));
