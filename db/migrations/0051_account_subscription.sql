-- 0051 — Horda Plus subscription link on the account.
-- account.plan (0050) says which plan an organiser is on; this stores the Stripe
-- subscription that put them there, so a cancellation webhook can find the
-- account and downgrade it back to 'free'. Null = no active Plus subscription.
ALTER TABLE account ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS account_sub_idx ON account (stripe_subscription_id);
