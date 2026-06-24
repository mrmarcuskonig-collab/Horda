-- 0020: password reset tokens. We store only a SHA-256 hash of the token, so a
-- DB leak can't be used to reset anyone's password. Tokens are single-use and
-- short-lived (expiry enforced in app code).
CREATE TABLE IF NOT EXISTS password_reset (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_acct_idx ON password_reset(account_id);
