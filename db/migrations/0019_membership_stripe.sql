-- 0019: link a membership to its Stripe subscription so webhooks can grant on
-- checkout.session.completed and revoke on customer.subscription.deleted.
ALTER TABLE membership ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS membership_sub_idx ON membership(stripe_subscription_id);
