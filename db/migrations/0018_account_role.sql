-- 0018_account_role.sql
-- Onboarding: remember which journey a new account chose, and whether they've
-- finished first-run, so we can route them and nudge activation.
ALTER TABLE account ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'fan';
ALTER TABLE account ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
