-- 0061_person.sql — canonical Fan ID: a phone-keyed identity spine.
--
-- A `person` is ONE human across all tenants, keyed on the normalized (E.164)
-- phone number. Accounts attach to a person via the append-only `person_link`
-- (history is the asset — a re-link after a number change is a NEW row, never an
-- UPDATE). Same normalized number on two accounts → the same person (merge by
-- phone), which is what makes cross-tenant recognition possible.
--
-- ADDITIVE + reversible: account/fan are untouched and keep working; person is a
-- layer above them. The phone is NEVER a login factor — sign-in stays magic-link
-- / email only (decision 0046). `verified_at` is set later, once an OTP proves the
-- number; null means captured-but-unproven.
CREATE TABLE IF NOT EXISTS person (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164  text UNIQUE NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person_link (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'furia',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_link_account_idx ON person_link (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS person_link_person_idx  ON person_link (person_id);
