-- 0038_payout_account.sql — Stripe Connect payout accounts (Build Order item 4).
-- Paid tickets are gated behind the ORGANIZER connecting a Stripe account (KYC is
-- handled by Stripe's onboarding). Horda charges the buyer, takes its 10% via an
-- application fee, and routes the rest to the connected account. Web-first (never
-- the native app stores). One payout account per host entity.
CREATE TABLE IF NOT EXISTS payout_account (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_kind         text NOT NULL,             -- athlete | club | team | association
  host_id           text NOT NULL,
  stripe_account_id text,                      -- acct_… from Stripe Connect
  charges_enabled   boolean NOT NULL DEFAULT false,  -- can accept payments (KYC passed)
  payouts_enabled   boolean NOT NULL DEFAULT false,  -- can receive payouts
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_kind, host_id)
);
