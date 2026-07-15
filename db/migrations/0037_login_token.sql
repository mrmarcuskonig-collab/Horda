-- 0037_login_token.sql — passwordless sign-in (magic link + OTP). Item 1 of the
-- Master Build Order: email-only, Fan by default, never a standalone signup wall.
-- We store only the HASH of the magic-link token; the 6-digit code is short-lived.
-- One row per request; single-use (used_at) and short-expiry.
CREATE TABLE IF NOT EXISTS login_token (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  token_hash text NOT NULL UNIQUE,     -- sha256 of the magic-link token
  code       text NOT NULL,            -- 6-digit OTP (for people who'd rather type a code)
  name       text,                     -- display name to seed a brand-new account
  next       text,                     -- post-login redirect
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_token_email_idx ON login_token (lower(email), created_at DESC);
